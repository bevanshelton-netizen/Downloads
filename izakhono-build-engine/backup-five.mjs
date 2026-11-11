#!/usr/bin/env node
import { readFileSync, existsSync, statSync, createReadStream } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const ENV_FILE = process.env.IZAKHONO_BACKUP_ENV || "/etc/izakhono/backup-node.env";
const CONFIG_FILE = process.env.IZAKHONO_BUILD_BACKUPS || "/etc/izakhono/build-engine/five-backups.json";
const BASE_URL = process.env.IZAKHONO_BACKUP_URL || "http://127.0.0.1:8870";

function fail(message) { throw new Error(message); }
function readEnv(path) {
  const out = {};
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const at = line.indexOf("=");
    if (at < 1) continue;
    out[line.slice(0, at).trim()] = line.slice(at + 1);
  }
  return out;
}
async function request(path, key, method = "GET", body) {
  const response = await fetch(BASE_URL + path, {
    method,
    headers: { "x-izakhono-key": key, ...(body ? { "content-type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(120000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) fail("BACKUP_API_" + response.status + ":" + (payload.error || "request failed"));
  return payload;
}
function mountInfo(path) {
  const target = resolve(path);
  const mount = execFileSync("findmnt", ["-n", "-o", "TARGET,SOURCE,FSTYPE", "--target", target], { encoding: "utf8" }).trim();
  const [mountTarget, source, fsType] = mount.split(/\s+/);
  if (!mountTarget || resolve(mountTarget) !== target) fail("BACKUP_TARGET_NOT_MOUNT_ROOT:" + target);
  return { mountTarget, source, fsType, device: String(statSync(target).dev) };
}
async function sha256(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
async function main() {
  if (!existsSync(ENV_FILE) || !existsSync(CONFIG_FILE)) fail("BACKUP_CONFIGURATION_MISSING");
  const env = readEnv(ENV_FILE);
  const key = env.IZAKHONO_BACKUP_ADMIN_KEY;
  if (!key) fail("BACKUP_ADMIN_KEY_MISSING");
  const config = JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
  if (config.schema !== "izakhono.build-engine.backups/v1" || config.requiredCopies !== 5 ||
      !Array.isArray(config.targets) || config.targets.length !== 5) fail("EXACTLY_FIVE_BACKUP_TARGETS_REQUIRED");

  const ids = new Set(), kinds = new Set(), devices = new Set();
  const targets = config.targets.map(target => {
    if (!target || typeof target.id !== "string" || ids.has(target.id) || !target.required) fail("INVALID_BACKUP_TARGET");
    ids.add(target.id);
    if (typeof target.kind !== "string" || kinds.has(target.kind)) fail("DUPLICATE_BACKUP_FAILURE_DOMAIN");
    kinds.add(target.kind);
    if (typeof target.path !== "string" || !existsSync(target.path)) fail("BACKUP_TARGET_MISSING:" + target.id);
    const info = mountInfo(target.path);
    if (devices.has(info.device)) fail("BACKUP_TARGETS_SHARE_FILESYSTEM:" + target.id);
    devices.add(info.device);
    return { ...target, ...info };
  });
  const required = ["primary-encrypted", "separate-physical-disk", "separate-nas", "node02-replica", "offline-rotation"];
  if (required.some(kind => !kinds.has(kind))) fail("FIVE_REQUIRED_BACKUP_FAILURE_DOMAINS_NOT_CONFIGURED");

  const mirrorRoots = (env.IZAKHONO_BACKUP_MIRROR_ROOTS || "").split(",").map(x => x.trim()).filter(Boolean).map(resolve);
  const mirrorTargets = targets.filter(x => x.kind !== "primary-encrypted");
  if (mirrorRoots.length !== 4 || mirrorTargets.some(t => !mirrorRoots.includes(resolve(t.path)))) {
    fail("BACKUP_NODE_MUST_BE_CONFIGURED_WITH_THE_FOUR_EXTERNAL_MIRROR_ROOTS");
  }

  const sets = await request("/v1/sets", key);
  const set = (sets.sets || []).find(x => x.name === "owned-build-engine");
  if (!set) fail("OWNED_BUILD_ENGINE_BACKUP_SET_MISSING");
  const created = await request("/v1/sets/" + encodeURIComponent(set.id) + "/snapshots", key, "POST", {});
  const snapshot = created.snapshot;
  if (!snapshot || snapshot.state !== "complete" || !snapshot.archive_path || !snapshot.sha256) fail("PRIMARY_BACKUP_NOT_COMPLETE");
  const primary = targets.find(x => x.kind === "primary-encrypted");
  if (!resolve(snapshot.archive_path).startsWith(resolve(primary.path) + "/")) fail("PRIMARY_ARCHIVE_OUTSIDE_PRIMARY_TARGET");
  if (String(statSync(snapshot.archive_path).dev) !== primary.device) fail("PRIMARY_ARCHIVE_WRONG_FILESYSTEM");

  const verified = await request("/v1/snapshots/" + encodeURIComponent(snapshot.id) + "/verify", key, "POST", {});
  if (verified.verified !== true || verified.sha256 !== snapshot.sha256) fail("PRIMARY_BACKUP_CRYPTOGRAPHIC_VERIFICATION_FAILED");

  let mirrors = snapshot.mirror_json;
  if (typeof mirrors === "string") mirrors = JSON.parse(mirrors);
  if (!Array.isArray(mirrors) || mirrors.length !== 4) fail("FOUR_EXTERNAL_BACKUP_COPIES_NOT_REPORTED");
  for (const target of mirrorTargets) {
    const mirror = mirrors.find(x => resolve(x.root || "") === resolve(target.path));
    if (!mirror || mirror.status !== "complete" || !mirror.path || !existsSync(mirror.path)) fail("EXTERNAL_BACKUP_COPY_FAILED:" + target.id);
    const sidecar = mirror.path + ".sha256";
    if (!existsSync(sidecar) || !readFileSync(sidecar, "utf8").startsWith(snapshot.sha256 + "  ")) {
      fail("EXTERNAL_BACKUP_CHECKSUM_SIDECAR_MISSING_OR_INVALID:" + target.id);
    }
    if (String(statSync(mirror.path).dev) !== target.device) fail("EXTERNAL_BACKUP_WRONG_FILESYSTEM:" + target.id);
    if (await sha256(mirror.path) !== snapshot.sha256) fail("EXTERNAL_BACKUP_SHA256_MISMATCH:" + target.id);
  }

  const receipt = {
    schema: "izakhono.build-engine.backup-receipt/v1",
    status: "PASS",
    copies: 5,
    snapshotId: snapshot.id,
    sha256: snapshot.sha256,
    sizeBytes: snapshot.size_bytes,
    verifiedAt: new Date().toISOString(),
    targets: targets.map(t => ({ id: t.id, kind: t.kind, mount: t.mountTarget, source: t.source, filesystem: t.fsType }))
  };
  process.stdout.write(JSON.stringify(receipt, null, 2) + "\n");
}
main().catch(error => {
  process.stderr.write("[IZAKHONO BACKUP] " + String(error.message || error) + "\n");
  process.exitCode = 1;
});
