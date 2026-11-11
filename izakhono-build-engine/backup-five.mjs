#!/usr/bin/env node
import { readFileSync, existsSync, statSync, createReadStream } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const ENV_FILE = process.env.IZAKHONO_BACKUP_ENV || "/etc/izakhono/backup-node.env";
const REPLICA_ENV_FILE = process.env.IZAKHONO_REPLICA_ENV || "/etc/izakhono/replica-node.env";
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
async function requestAt(base, path, key, method = "GET", body, label = "API") {
  const response = await fetch(base + path, {
    method,
    headers: { "x-izakhono-key": key, ...(body ? { "content-type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(120000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) fail(label + "_" + response.status + ":" + (payload.error || "request failed"));
  return payload;
}
async function request(path, key, method = "GET", body) {
  return requestAt(BASE_URL, path, key, method, body, "BACKUP_API");
}
function mountInfo(path) {
  const target = resolve(path);
  const mount = execFileSync("findmnt", ["-n", "-o", "TARGET,SOURCE,FSTYPE", "--target", target], { encoding: "utf8" }).trim();
  const [mountTarget, source, fsType] = mount.split(/\s+/);
  if (!mountTarget || resolve(mountTarget) !== target) fail("BACKUP_TARGET_NOT_MOUNT_ROOT:" + target);
  if (["tmpfs", "ramfs", "overlay", "squashfs"].includes(fsType)) fail("BACKUP_TARGET_NOT_DURABLE:" + target);
  let failureDomain = source;
  let failureComponents = [];
  if (source.startsWith("/dev/")) {
    try {
      const rows = execFileSync("lsblk", ["-s", "-n", "-o", "NAME,TYPE", source], { encoding: "utf8" })
        .trim().split(/\r?\n/).map(line => line.trim().split(/\s+/));
      const disks = rows.filter(row => row[1] === "disk").map(row => row[0]).sort();
      if (!disks.length) fail("CANNOT_PROVE_PHYSICAL_BACKUP_DEVICE:" + target);
      failureComponents = disks.map(name => "disk:" + name);
      failureDomain = disks.join(",");
    } catch {
      fail("CANNOT_PROVE_PHYSICAL_BACKUP_DEVICE:" + target);
    }
  } else if (source.startsWith("//")) {
    failureDomain = source.slice(2).split("/")[0].toLowerCase();
    failureComponents = ["host:" + failureDomain];
  } else if (source.includes(":")) {
    failureDomain = source.split(":")[0].toLowerCase();
    failureComponents = ["host:" + failureDomain];
  } else {
    failureComponents = ["source:" + source];
  }
  return { mountTarget, source, fsType, device: String(statSync(target).dev), failureDomain, failureComponents };
}
async function sha256(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
async function main() {
  if (!existsSync(ENV_FILE) || !existsSync(REPLICA_ENV_FILE) || !existsSync(CONFIG_FILE)) fail("BACKUP_CONFIGURATION_MISSING");
  const env = readEnv(ENV_FILE);
  const key = env.IZAKHONO_BACKUP_ADMIN_KEY;
  if (!key) fail("BACKUP_ADMIN_KEY_MISSING");
  const replicaEnv = readEnv(REPLICA_ENV_FILE);
  const replicaKey = replicaEnv.IZAKHONO_REPLICA_ADMIN_KEY;
  if (!replicaKey) fail("REPLICA_NODE_ADMIN_KEY_MISSING");
  const replicaHost = process.env.IZAKHONO_REPLICA_HOST || replicaEnv.HOST || "127.0.0.1";
  const replicaPort = process.env.IZAKHONO_REPLICA_PORT || replicaEnv.PORT || "8890";
  const replicaBase = process.env.IZAKHONO_REPLICA_URL || "http://" + replicaHost + ":" + replicaPort;
  const config = JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
  if (config.schema !== "izakhono.build-engine.backups/v1" || config.requiredCopies !== 5 ||
      !Array.isArray(config.targets) || config.targets.length !== 5) fail("EXACTLY_FIVE_BACKUP_TARGETS_REQUIRED");

  const ids = new Set(), kinds = new Set(), devices = new Set(), failureComponents = new Set();
  const targets = config.targets.map(target => {
    if (!target || typeof target.id !== "string" || ids.has(target.id) || !target.required) fail("INVALID_BACKUP_TARGET");
    ids.add(target.id);
    if (typeof target.kind !== "string" || kinds.has(target.kind)) fail("DUPLICATE_BACKUP_FAILURE_DOMAIN");
    kinds.add(target.kind);
    if (target.kind === "node02-replica") {
      if (typeof target.peerName !== "string" || !/^[a-z0-9][a-z0-9-]{1,62}$/.test(target.peerName)) fail("NODE02_REPLICA_PEER_NAME_REQUIRED");
      return { ...target };
    }
    if (typeof target.path !== "string" || !existsSync(target.path)) fail("BACKUP_TARGET_MISSING:" + target.id);
    const info = mountInfo(target.path);
    if (["primary-encrypted", "separate-physical-disk", "offline-rotation"].includes(target.kind) && !info.source.startsWith("/dev/")) {
      fail("BACKUP_TARGET_REQUIRES_BLOCK_DEVICE:" + target.id);
    }
    if (target.kind === "separate-nas" && !(info.source.startsWith("//") || info.source.includes(":"))) {
      fail("BACKUP_TARGET_REQUIRES_REMOTE_HOST:" + target.id);
    }
    if (devices.has(info.device)) fail("BACKUP_TARGETS_SHARE_FILESYSTEM:" + target.id);
    devices.add(info.device);
    for (const component of info.failureComponents) {
      if (failureComponents.has(component)) fail("BACKUP_TARGETS_SHARE_PHYSICAL_FAILURE_DOMAIN:" + target.id);
      failureComponents.add(component);
    }
    return { ...target, ...info };
  });
  const required = ["primary-encrypted", "separate-physical-disk", "separate-nas", "node02-replica", "offline-rotation"];
  if (required.some(kind => !kinds.has(kind))) fail("FIVE_REQUIRED_BACKUP_FAILURE_DOMAINS_NOT_CONFIGURED");

  const mirrorRoots = (env.IZAKHONO_BACKUP_MIRROR_ROOTS || "").split(",").map(x => x.trim()).filter(Boolean).map(x => resolve(x));
  const mirrorTargets = targets.filter(x => ["separate-physical-disk", "separate-nas", "offline-rotation"].includes(x.kind));
  if (mirrorRoots.length !== 3 || mirrorTargets.some(t => !mirrorRoots.includes(resolve(t.path)))) {
    fail("BACKUP_NODE_MUST_BE_CONFIGURED_WITH_THREE_FILESYSTEM_MIRROR_ROOTS");
  }

  const replicaHealth = await requestAt(replicaBase, "/health", replicaKey, "GET", undefined, "REPLICA_API");
  if (replicaHealth.status !== "healthy") fail("REPLICA_NODE_UNHEALTHY");
  const peers = await requestAt(replicaBase, "/v1/peers", replicaKey, "GET", undefined, "REPLICA_API");
  const node02Config = targets.find(x => x.kind === "node02-replica");
  const peer = (peers.peers || []).find(x => x.name === node02Config.peerName && x.enabled);
  if (!peer) fail("NODE02_REPLICA_PEER_NOT_REGISTERED_OR_DISABLED");
  const peerUrl = new URL(peer.base_url);
  if (peerUrl.protocol !== "https:" || ["localhost", "127.0.0.1", "::1"].includes(peerUrl.hostname.toLowerCase())) {
    fail("NODE02_REPLICA_MUST_BE_A_SEPARATE_HTTPS_HOST");
  }
  node02Config.remoteHost = peerUrl.hostname;
  node02Config.peerId = peer.id;
  const replicaFailureDomain = "host:" + peerUrl.hostname.toLowerCase();
  if (failureComponents.has(replicaFailureDomain)) fail("BACKUP_TARGETS_SHARE_PHYSICAL_FAILURE_DOMAIN:node02");
  failureComponents.add(replicaFailureDomain);

  const args = process.argv.slice(2);
  const preflightOnly = args.includes("--preflight");
  const project = args.find(x => x !== "--preflight") || "";
  let setName = "owned-build-engine";
  if (project) {
    if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(project)) fail("INVALID_BACKUP_PROJECT_ID");
    const projectCurrentRoot = resolve("/var/lib/izakhono-build-engine/current", project);
    if (!preflightOnly && !existsSync(projectCurrentRoot)) fail("PROJECT_CURRENT_RELEASE_ROOT_MISSING");
    setName = "build-" + project;
  }
  let sets = await request("/v1/sets", key);
  if (preflightOnly) {
    const engineSet = (sets.sets || []).find(x => x.name === "owned-build-engine");
    if (!engineSet) fail("OWNED_BUILD_ENGINE_BACKUP_SET_MISSING");
    const engineSources = new Set(engineSet.sources || []);
    if (!engineSources.has("/opt/izakhono-build-engine") || !engineSources.has("/var/lib/izakhono-build-engine")) {
      fail("OWNED_BUILD_ENGINE_BACKUP_SET_INCOMPLETE");
    }
    if (project) {
      const projectSet = (sets.sets || []).find(x => x.name === setName);
      if (projectSet) {
        const expected = ["/opt/izakhono-build-engine", resolve("/var/lib/izakhono-build-engine/current", project)];
        const actual = new Set(projectSet.sources || []);
        if (expected.some(source => !actual.has(source))) fail("PROJECT_BACKUP_SET_SOURCE_MISMATCH:" + project);
      }
    }
    process.stdout.write(JSON.stringify({
      status: "BACKUP_PREFLIGHT_PASS",
      copies: 5,
      targets: targets.map(t => ({
        id: t.id,
        kind: t.kind,
        mount: t.mountTarget || null,
        failureDomain: t.failureDomain || t.remoteHost || null
      }))
    }, null, 2) + "\n");
    return;
  }
  let set = (sets.sets || []).find(x => x.name === setName);
  if (!set && project) {
    try {
      const registered = await request("/v1/sets", key, "POST", {
        name: setName,
        sources: ["/opt/izakhono-build-engine", resolve("/var/lib/izakhono-build-engine/current", project)],
        retentionCount: 30,
        enabled: true
      });
      set = registered.set;
    } catch (error) {
      if (!String(error.message || error).includes("BACKUP_API_409")) throw error;
      sets = await request("/v1/sets", key);
      set = (sets.sets || []).find(x => x.name === setName);
      if (!set) throw error;
    }
  }
  if (!set) fail("BUILD_ENGINE_BACKUP_SET_MISSING:" + setName);
  if (project) {
    const expectedSources = ["/opt/izakhono-build-engine", resolve("/var/lib/izakhono-build-engine/current", project)];
    const actualSources = new Set(set.sources || []);
    if (expectedSources.some(source => !actualSources.has(source))) fail("PROJECT_BACKUP_SET_SOURCE_MISMATCH:" + project);
  }
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
  if (!Array.isArray(mirrors) || mirrors.length !== 3) fail("THREE_EXTERNAL_BACKUP_COPIES_NOT_REPORTED");
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

  const replicaResult = await requestAt(replicaBase, "/v1/replicate", replicaKey, "POST", {
    peerId: peer.id,
    archivePath: snapshot.archive_path
  }, "REPLICA_API");
  const replication = replicaResult.replication;
  if (!replication || !["complete", "duplicate"].includes(replication.state) ||
      replication.sha256 !== snapshot.sha256 || Number(replication.size_bytes) !== Number(snapshot.size_bytes)) {
    fail("NODE02_REPLICA_COPY_NOT_VERIFIED");
  }

  const receipt = {
    schema: "izakhono.build-engine.backup-receipt/v1",
    status: "PASS",
    copies: 5,
    snapshotId: snapshot.id,
    sha256: snapshot.sha256,
    sizeBytes: snapshot.size_bytes,
    verifiedAt: new Date().toISOString(),
    node02Replica: {
      peerName: peer.name,
      remoteHost: peerUrl.hostname,
      state: replication.state,
      objectKey: replication.object_key,
      sha256: replication.sha256,
      sizeBytes: replication.size_bytes
    },
    targets: targets.map(t => ({
      id: t.id,
      kind: t.kind,
      mount: t.mountTarget || null,
      source: t.source || null,
      filesystem: t.fsType || null,
      failureDomain: t.failureDomain || t.remoteHost || null
    }))
  };
  process.stdout.write(JSON.stringify(receipt, null, 2) + "\n");
}
main().catch(error => {
  process.stderr.write("[IZAKHONO BACKUP] " + String(error.message || error) + "\n");
  process.exitCode = 1;
});
