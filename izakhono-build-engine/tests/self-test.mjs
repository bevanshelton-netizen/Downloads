import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const engine = readFileSync(join(here, "..", "engine.mjs"), "utf8");
const backup = readFileSync(join(here, "..", "backup-five.mjs"), "utf8");
const plan = JSON.parse(readFileSync(join(here, "..", "config", "build-plan.example.json"), "utf8"));
const targets = JSON.parse(readFileSync(join(here, "..", "config", "five-backups.example.json"), "utf8"));

assert.equal(plan.schema, "izakhono.build-plan/v1");
assert.equal(plan.backup.requiredCopies, 5);
assert.equal(plan.project.id, plan.project.name);
assert.ok(plan.build.commands.every(x => Array.isArray(x.run) && typeof x.network === "boolean"));
assert.ok(plan.build.commands.every(x => x.network === false || x.run[0] === "npm"));
assert.ok(plan.build.commands.every(x => ["npm", "node", "python3", "make"].includes(x.run[0])));
assert.equal(targets.schema, "izakhono.build-engine.backups/v1");
assert.equal(targets.requiredCopies, 5);
assert.equal(targets.targets.length, 5);
assert.equal(new Set(targets.targets.map(x => x.kind)).size, 5);
assert.deepEqual(new Set(targets.targets.map(x => x.kind)), new Set([
  "primary-encrypted", "separate-physical-disk", "separate-nas", "node02-replica", "offline-rotation"
]));
assert.match(engine, /FIVE_BACKUP_GATE_FAILED_DEPLOYMENT_BLOCKED/);
assert.match(engine, /PrivateNetwork=yes/);
assert.match(engine, /NoNewPrivileges=yes/);
assert.match(engine, /ProtectSystem=strict/);
assert.match(engine, /deployment-receipt/);
assert.match(engine, /chown.*izakhono-ci/s);
assert.match(engine, /\/etc\/izakhono\/apps\//);
assert.match(backup, /BACKUP_TARGETS_SHARE_FILESYSTEM/);
assert.match(backup, /verify/i);
assert.match(backup, /FOUR_EXTERNAL_BACKUP_COPIES_NOT_REPORTED/);
assert.doesNotMatch(engine, /VERCEL_TOKEN|CLOUDFLARE_API_TOKEN|SUPABASE_SERVICE_ROLE_KEY/);
const validation = spawnSync(process.execPath, [
  join(here, "..", "engine.mjs"),
  "validate",
  join(here, "..", "config", "build-plan.example.json")
], { encoding: "utf8" });
assert.equal(validation.status, 0, validation.stderr);
assert.match(validation.stdout, /BUILD_PLAN_VALID example-app/);
console.log("IZAKHONO BUILD ENGINE SELF-TEST: PASS");
