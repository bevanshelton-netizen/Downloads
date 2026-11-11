#!/usr/bin/env node
import { readFileSync, existsSync, mkdirSync, cpSync, writeFileSync, readdirSync, lstatSync, createReadStream, rmSync } from "node:fs";
import { resolve, relative, join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

const execFileAsync = promisify(execFile);
const RUNTIME_URL = process.env.IZAKHONO_RUNTIME_URL || "http://127.0.0.1:8790";
const BACKUP_URL = process.env.IZAKHONO_BACKUP_URL || "http://127.0.0.1:8870";
const PACKAGE_URL = process.env.IZAKHONO_PACKAGE_URL || "http://127.0.0.1:8910/";
const STATE_ROOT = process.env.IZAKHONO_BUILD_STATE || "/var/lib/izakhono-build-engine";
const WORK_ROOT = process.env.IZAKHONO_BUILD_WORK || "/var/tmp/izakhono-build-engine";
const RELEASE_ROOT = process.env.IZAKHONO_RELEASE_ROOT || "/var/lib/izakhono-runtime/releases";
const ALLOWED_BUILD_COMMANDS = new Set(["npm", "node", "python3", "make"]);

function fail(message) { throw new Error(message); }
function parseEnv(path) {
  if (!existsSync(path)) fail("SERVICE_ENV_MISSING:" + path);
  const values = {};
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i > 0) values[line.slice(0, i).trim()] = line.slice(i + 1);
  }
  return values;
}
function safeRelative(value) {
  if (typeof value !== "string" || !value || value.startsWith("/") || value.split(/[\\/]/).includes("..")) fail("UNSAFE_RELATIVE_PATH");
  return value;
}
function validate(plan) {
  if (plan?.schema !== "izakhono.build-plan/v1") fail("INVALID_BUILD_PLAN_SCHEMA");
  const p = plan.project, s = plan.source, b = plan.build, r = plan.runtime;
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(p?.id || "") || p.name !== p.id) fail("INVALID_PROJECT_ID");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(p.hostname || "")) fail("INVALID_PROJECT_HOSTNAME");
  if (typeof s?.root !== "string" || typeof s?.path !== "string" || typeof s?.ref !== "string") fail("INVALID_SOURCE_CONFIG");
  safeRelative(s.path);
  if (!/^[A-Za-z0-9._/-]{1,180}$/.test(s.ref) || s.ref.includes("..")) fail("INVALID_SOURCE_REF");
  if (!Array.isArray(b?.commands) || b.commands.length < 1 || b.commands.length > 30) fail("INVALID_BUILD_COMMANDS");
  for (const step of b.commands) {
    if (!Array.isArray(step.run) || !step.run.length || !ALLOWED_BUILD_COMMANDS.has(step.run[0]) ||
        step.run.some(x => typeof x !== "string" || x.length > 2000)) fail("BUILD_COMMAND_NOT_ALLOWLISTED");
    if (step.network !== true && step.network !== false) fail("BUILD_NETWORK_POLICY_REQUIRED");
    if (step.network && !(step.run[0] === "npm" && ["ci", "install"].includes(step.run[1]))) {
      fail("NETWORK_ALLOWED_ONLY_FOR_NPM_INSTALL_STEPS");
    }
    if (step.run[0] === "npm" && !["ci", "install", "run"].includes(step.run[1])) fail("NPM_COMMAND_NOT_ALLOWLISTED");
  }
  if (!Array.isArray(b.artifacts) || !b.artifacts.length) fail("BUILD_ARTIFACTS_REQUIRED");
  b.artifacts.forEach(safeRelative);
  if (!Array.isArray(r?.command) || !["node", "npm"].includes(r.command[0]) ||
      r.command.some(x => typeof x !== "string" || x.length > 500)) fail("RUNTIME_COMMAND_NOT_ALLOWLISTED");
  if (r.envFile && !r.envFile.startsWith("/etc/izakhono/apps/")) fail("RUNTIME_ENV_FILE_OUTSIDE_ALLOWLIST");
  if (plan.backup?.requiredCopies !== 5) fail("FIVE_BACKUPS_REQUIRED");
  if (!plan.backup.targetsFile) fail("BACKUP_TARGET_MANIFEST_REQUIRED");
  if (b.healthPath && !b.healthPath.startsWith("/")) fail("INVALID_HEALTH_PATH");
  return plan;
}
async function api(base, path, key, method = "GET", body) {
  const response = await fetch(base + path, {
    method,
    headers: { "x-izakhono-key": key, ...(body ? { "content-type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) fail("API_" + response.status + ":" + (payload.error || "request failed"));
  return payload;
}
async function health(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
  if (!response.ok) fail("HEALTH_FAILED:" + url);
  const body = await response.json().catch(() => ({}));
  if (body.status !== "healthy") fail("UNHEALTHY_SERVICE:" + url);
  return body;
}
async function preflight(plan) {
  const root = resolve(plan.source.root);
  if (!existsSync(join(root, ".git"))) fail("SOURCE_CHECKOUT_NOT_FOUND:" + root);
  if (process.platform !== "linux") fail("LINUX_BUILD_HOST_REQUIRED");
  for (const command of ["git", "tar", "systemd-run", "findmnt"]) {
    if (spawnSync("bash", ["-lc", "command -v " + command], { stdio: "ignore" }).status !== 0) fail("REQUIRED_HOST_COMMAND_MISSING:" + command);
  }
  const runtimeEnv = parseEnv("/etc/izakhono/runtime-node.env");
  const backupEnv = parseEnv("/etc/izakhono/backup-node.env");
  await health(RUNTIME_URL + "/health");
  await health(BACKUP_URL + "/health");
  await health(PACKAGE_URL.replace(/\/$/, "") + "/health");
  if (!runtimeEnv.IZAKHONO_RUNTIME_KEY || !backupEnv.IZAKHONO_BACKUP_ADMIN_KEY) fail("SERVICE_AUTHORITY_KEY_MISSING");
  if (plan.runtime.envFile && !existsSync(plan.runtime.envFile)) fail("RUNTIME_APP_ENV_FILE_MISSING");
  const git = await execFileAsync("git", ["-C", root, "rev-parse", "--verify", plan.source.ref + "^{commit}"]);
  const commit = git.stdout.trim();
  const status = await execFileAsync("git", ["-C", root, "status", "--porcelain"]);
  if (status.stdout.trim()) fail("SOURCE_CHECKOUT_NOT_CLEAN");
  return { root, commit, runtimeKey: runtimeEnv.IZAKHONO_RUNTIME_KEY, backupKey: backupEnv.IZAKHONO_BACKUP_ADMIN_KEY };
}
function runSandbox(command, cwd, network, timeoutSeconds) {
  return new Promise((resolvePromise, reject) => {
    const args = ["--quiet", "--wait", "--collect", "--pipe", "--service-type=exec", "--uid=izakhono-ci",
      "--property=NoNewPrivileges=yes", "--property=PrivateTmp=yes", "--property=ProtectSystem=strict",
      "--property=ProtectHome=yes", "--property=PrivateDevices=yes", "--property=RestrictSUIDSGID=yes",
      "--property=LockPersonality=yes", "--property=MemoryMax=2048M", "--property=CPUQuota=200%",
      "--property=RuntimeMaxSec=" + timeoutSeconds, "--property=ReadWritePaths=" + cwd,
      "--working-directory=" + cwd, "--setenv=PATH=/usr/local/bin:/usr/bin:/bin",
      "--setenv=HOME=" + join(cwd, ".home"), "--setenv=CI=true", "--setenv=IZAKHONO_CI=1",
      "--setenv=NPM_CONFIG_REGISTRY=" + PACKAGE_URL, "--setenv=NPM_CONFIG_AUDIT=false", "--setenv=NPM_CONFIG_FUND=false"];
    if (!network) args.push("--property=PrivateNetwork=yes");
    args.push("--", ...command);
    const child = spawn("systemd-run", args, { stdio: "inherit", env: { PATH: process.env.PATH || "/usr/bin:/bin" } });
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolvePromise() : reject(new Error("BUILD_STEP_EXIT_" + code)));
  });
}
async function sha256(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
function runGitArchive(root, commit, sourcePath, destination) {
  return new Promise((resolvePromise, reject) => {
    const git = spawn("git", ["-C", root, "archive", commit, sourcePath], { stdio: ["ignore", "pipe", "inherit"] });
    const tar = spawn("tar", ["-x", "-C", destination], { stdio: ["pipe", "inherit", "inherit"] });
    git.stdout.pipe(tar.stdin);
    let gitCode = null, tarCode = null;
    const finish = () => {
      if (gitCode === null || tarCode === null) return;
      if (gitCode !== 0 || tarCode !== 0) reject(new Error("SOURCE_ARCHIVE_FAILED"));
      else resolvePromise();
    };
    git.on("error", reject); tar.on("error", reject);
    git.on("close", code => { gitCode = code; finish(); });
    tar.on("close", code => { tarCode = code; finish(); });
  });
}
async function deploy(planPath) {
  const plan = validate(JSON.parse(readFileSync(planPath, "utf8")));
  const ctx = await preflight(plan);
  const id = randomUUID();
  const work = join(WORK_ROOT, id);
  const sourceDir = join(work, "source");
  mkdirSync(sourceDir, { recursive: true, mode: 0o700 });
  await execFileAsync("chown", ["-R", "izakhono-ci:izakhono-ci", work]);
  await runGitArchive(ctx.root, ctx.commit, plan.source.path, sourceDir);
  const appSource = join(sourceDir, plan.source.path);
  if (!existsSync(appSource)) fail("SOURCE_PROJECT_DIRECTORY_NOT_FOUND");
  await execFileAsync("chown", ["-R", "izakhono-ci:izakhono-ci", appSource]);
  mkdirSync(join(appSource, ".home"), { recursive: true });
  for (let i = 0; i < plan.build.commands.length; i++) {
    const step = plan.build.commands[i];
    process.stdout.write("[IZAKHONO BUILD] Step " + (i + 1) + "/" + plan.build.commands.length + ": " + step.run.join(" ") + "\n");
    await runSandbox(step.run, appSource, step.network, Math.min(3600, Math.max(10, Number(step.timeoutSeconds || 900))));
  }
  const release = join(RELEASE_ROOT, plan.project.id, ctx.commit + "-" + Date.now());
  mkdirSync(release, { recursive: true, mode: 0o750 });
  for (const artifact of plan.build.artifacts) {
    const from = join(appSource, artifact);
    if (!existsSync(from)) fail("BUILD_ARTIFACT_MISSING:" + artifact);
    const to = join(release, artifact);
    mkdirSync(resolve(to, ".."), { recursive: true });
    cpSync(from, to, { recursive: true, errorOnExist: true, force: false });
  }
  const files = [];
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name), st = lstatSync(path);
      if (st.isSymbolicLink()) fail("SYMLINK_NOT_ALLOWED_IN_RELEASE");
      if (st.isDirectory()) walk(path);
      else files.push({ path: relative(release, path), size: st.size, sha256: null });
    }
  }
  walk(release);
  for (const file of files) file.sha256 = await sha256(join(release, file.path));
  const manifest = {
    schema: "izakhono.immutable-release/v1",
    project: plan.project.id,
    sourceCommit: ctx.commit,
    sourceRef: plan.source.ref,
    createdAt: new Date().toISOString(),
    runtime: { command: plan.runtime.command, hostname: plan.project.hostname, healthPath: plan.build.healthPath || "/health" },
    files
  };
  writeFileSync(join(release, "IZAKHONO-RELEASE.json"), JSON.stringify(manifest, null, 2) + "\n", { mode: 0o440 });
  await execFileAsync("chown", ["-R", "izakhono:izakhono", release]);
  process.stdout.write("[IZAKHONO BUILD] Immutable release prepared: " + release + "\n");

  const backup = spawn("node", [join(resolve(import.meta.dirname), "backup-five.mjs")], { stdio: "inherit", env: process.env });
  const backupCode = await new Promise((resolvePromise, reject) => { backup.on("error", reject); backup.on("close", resolvePromise); });
  if (backupCode !== 0) fail("FIVE_BACKUP_GATE_FAILED_DEPLOYMENT_BLOCKED");

  const deployed = await api(RUNTIME_URL, "/v1/deployments", ctx.runtimeKey, "POST", {
    app: plan.project.id,
    hostname: plan.project.hostname,
    releasePath: release,
    command: plan.runtime.command,
    envFile: plan.runtime.envFile,
    healthPath: plan.build.healthPath || "/health"
  });
  const receipt = {
    schema: "izakhono.build-engine.deployment-receipt/v1",
    status: "DEPLOYED_AND_HEALTHY",
    project: plan.project.id,
    sourceCommit: ctx.commit,
    releasePath: release,
    runtimeDeploymentId: deployed.id,
    previousDeploymentId: deployed.previous || null,
    hostname: deployed.hostname,
    port: deployed.port,
    backupCopies: 5,
    completedAt: new Date().toISOString()
  };
  const receiptDir = join(STATE_ROOT, "receipts", plan.project.id);
  mkdirSync(receiptDir, { recursive: true, mode: 0o750 });
  writeFileSync(join(receiptDir, id + ".json"), JSON.stringify(receipt, null, 2) + "\n", { mode: 0o640 });
  process.stdout.write(JSON.stringify(receipt, null, 2) + "\n");
  rmSync(work, { recursive: true, force: true });
}
async function rollback(app) {
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(app || "")) fail("INVALID_APP_NAME");
  const env = parseEnv("/etc/izakhono/runtime-node.env");
  const result = await api(RUNTIME_URL, "/v1/apps/" + encodeURIComponent(app) + "/rollback", env.IZAKHONO_RUNTIME_KEY, "POST", {});
  process.stdout.write(JSON.stringify({ status: "ROLLBACK_HEALTH_CHECKED", ...result }, null, 2) + "\n");
}
async function status() {
  const env = parseEnv("/etc/izakhono/runtime-node.env");
  const result = await api(RUNTIME_URL, "/v1/apps", env.IZAKHONO_RUNTIME_KEY);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}
async function main() {
  const [action, arg] = process.argv.slice(2);
  if (action === "validate") {
    const plan = validate(JSON.parse(readFileSync(arg, "utf8")));
    process.stdout.write("BUILD_PLAN_VALID " + plan.project.id + "\n");
  } else if (action === "preflight") {
    const plan = validate(JSON.parse(readFileSync(arg, "utf8")));
    const result = await preflight(plan);
    process.stdout.write(JSON.stringify({ status: "PREFLIGHT_PASS", sourceCommit: result.commit }, null, 2) + "\n");
  } else if (action === "deploy") {
    await deploy(arg);
  } else if (action === "rollback") {
    await rollback(arg);
  } else if (action === "status") {
    await status();
  } else {
    fail("USAGE: engine.mjs validate|preflight|deploy <plan.json> | rollback <app> | status");
  }
}
main().catch(error => {
  process.stderr.write("[IZAKHONO BUILD ENGINE] " + String(error.stack || error) + "\n");
  process.exitCode = 1;
});
