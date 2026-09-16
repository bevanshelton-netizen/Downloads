#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo bash "$0" "$@"
fi

need(){ command -v "$1" >/dev/null 2>&1 || { echo "FAIL: $1 is required" >&2; exit 2; }; }
for cmd in curl node systemctl systemd-run; do need "$cmd"; done

REPORT_DIR=/var/lib/izakhono-deploy/proofs
REPORT="$REPORT_DIR/first-host-proof.txt"
mkdir -p "$REPORT_DIR"
chmod 0700 "$REPORT_DIR"
: >"$REPORT"
chmod 0600 "$REPORT"

ok(){ echo "PASS $*" | tee -a "$REPORT"; }
fail(){ echo "FAIL $*" | tee -a "$REPORT" >&2; exit 10; }
note(){ echo "INFO $*" | tee -a "$REPORT"; }

probe_json(){
  local label="$1"
  local url="$2"
  local expected="$3"
  local payload
  payload="$(curl -fsS --max-time 5 "$url")" || fail "$label health endpoint unavailable"
  node -e 'const x=JSON.parse(process.argv[1]); if(x.status!=="healthy") process.exit(2)' "$payload" || fail "$label health payload invalid"
  if [ -n "$expected" ]; then
    node -e 'const x=JSON.parse(process.argv[1]); if(x.product!==process.argv[2]) process.exit(2)' "$payload" "$expected" || fail "$label product mismatch"
  fi
  ok "$label healthy"
}

probe_json DATA http://127.0.0.1:8787/health "IZAKHONO DATA NODE"
probe_json RUNTIME http://127.0.0.1:8790/health "IZAKHONO RUNTIME NODE"
probe_json OBJECT http://127.0.0.1:8800/health "IZAKHONO OBJECT NODE"
probe_json QUEUE http://127.0.0.1:8810/health "IZAKHONO QUEUE NODE"
probe_json AUTH http://127.0.0.1:8820/health "IZAKHONO AUTH NODE"
probe_json ANALYTICS http://127.0.0.1:8830/health "IZAKHONO ANALYTICS NODE"
probe_json NOTIFY http://127.0.0.1:8840/health "IZAKHONO NOTIFY NODE"
probe_json AI_GATEWAY http://127.0.0.1:8850/health "IZAKHONO AI GATEWAY NODE"
probe_json CODE http://127.0.0.1:8860/health "IZAKHONO CODE NODE"
probe_json BACKUP http://127.0.0.1:8870/health "IZAKHONO BACKUP NODE"
probe_json CI_WORKER http://127.0.0.1:8880/health "IZAKHONO CI WORKER NODE"
probe_json REPLICA http://127.0.0.1:8890/health "IZAKHONO REPLICA NODE"
probe_json FORTRESS http://127.0.0.1:18109/health "FORTRESS"
FORTRESS_RECEIPT=/var/lib/izakhono-deploy/fortress-protector.json
[ -f "$FORTRESS_RECEIPT" ] || fail "FORTRESS Protector receipt missing"
node - "$FORTRESS_RECEIPT" <<'NODE' || fail "FORTRESS Protector safety receipt invalid"
const fs=require("fs");
const x=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
if(x.role!=="THEE PROTECTOR"||x.health_passed!==true||x.public_bind!==false||x.public_dns_changed!==false||x.payment_credentials_stored!==false||x.commercial_release_claimed!==false) process.exit(2);
NODE
ok "FORTRESS Protector private defensive boundary verified"

CI_HEALTH="$(curl -fsS http://127.0.0.1:8880/health)"
node -e 'const x=JSON.parse(process.argv[1]); if(x.executor!=="systemd"||x.productionSandboxRequired!==true)process.exit(2)' "$CI_HEALTH"   || fail "CI WORKER is not in production systemd mode"
ok "CI WORKER production executor is systemd"

PROOF_DIR=/var/lib/izakhono-ci/workspaces/host-sandbox-proof
rm -rf "$PROOF_DIR"
mkdir -p "$PROOF_DIR"
chown -R izakhono-ci:izakhono-ci "$PROOF_DIR"

systemd-run --quiet --wait --collect --pipe --service-type=exec   --uid=izakhono-ci   --property=NoNewPrivileges=yes   --property=PrivateTmp=yes   --property=ProtectSystem=strict   --property=ProtectHome=yes   --property=PrivateDevices=yes   --property=RestrictSUIDSGID=yes   --property=LockPersonality=yes   --property=PrivateNetwork=yes   --property=MemoryMax=256M   --property=CPUQuota=100%   --property=RuntimeMaxSec=30   --property=ReadWritePaths="$PROOF_DIR"   --working-directory="$PROOF_DIR"   --setenv=PATH=/usr/local/bin:/usr/bin:/bin   --setenv=HOME="$PROOF_DIR"   --setenv=CI=true   -- /usr/bin/node -e '
    const fs=require("fs");
    const forbidden=["IZAKHONO_QUEUE_KEY","IZAKHONO_CODE_ADMIN_KEY","IZAKHONO_CI_ADMIN_KEY","IZAKHONO_BACKUP_ADMIN_KEY"];
    for(const k of forbidden) if(process.env[k]) throw new Error("inherited secret "+k);
    let secretReadable=true;
    try{fs.readFileSync("/etc/izakhono/ci-worker-node.env");}catch{secretReadable=false;}
    if(secretReadable) throw new Error("CI admin env readable from sandbox");
    const routes=fs.readFileSync("/proc/net/route","utf8").trim().split(/\n/).slice(1);
    if(routes.some(line=>line.trim().split(/\s+/)[1]==="00000000")) throw new Error("default network route exists");
    fs.writeFileSync("sandbox-proof.txt","SYSTEMD_SANDBOX_PASS\n");
  ' >/dev/null || fail "systemd transient CI sandbox proof failed"

grep -q SYSTEMD_SANDBOX_PASS "$PROOF_DIR/sandbox-proof.txt" || fail "sandbox proof artifact missing"
ok "systemd CI sandbox blocks secrets and external default network route"

BACKUP_ENV=/etc/izakhono/backup-node.env
[ -f "$BACKUP_ENV" ] || fail "BACKUP NODE environment missing"
BACKUP_KEY="$(awk -F= '$1=="IZAKHONO_BACKUP_ADMIN_KEY"{sub(/^[^=]*=/,"");print;exit}' "$BACKUP_ENV")"
[ -n "$BACKUP_KEY" ] || fail "BACKUP admin key missing"

SETS="$(curl -fsS -H "x-izakhono-key: $BACKUP_KEY" http://127.0.0.1:8870/v1/sets)" || fail "Cannot read backup sets"
SET_ID="$(node -e 'const x=JSON.parse(process.argv[1]);const s=x.sets.find(v=>v.name==="owned-cloud-core");if(!s)process.exit(2);process.stdout.write(s.id)' "$SETS")"   || fail "owned-cloud-core backup set missing"

RUN="$(curl -fsS -X POST -H "content-type: application/json" -H "x-izakhono-key: $BACKUP_KEY"   --data '{}' http://127.0.0.1:8870/v1/run-enabled)" || fail "Encrypted backup run failed"
node -e 'const x=JSON.parse(process.argv[1]);if(!x.results.some(v=>v.set==="owned-cloud-core"&&v.status==="complete"))process.exit(2)' "$RUN"   || fail "Core encrypted backup did not complete"
ok "core encrypted backup completed"

SNAPS="$(curl -fsS -H "x-izakhono-key: $BACKUP_KEY" "http://127.0.0.1:8870/v1/sets/$SET_ID/snapshots")"
SNAP_ID="$(node -e 'const x=JSON.parse(process.argv[1]);const s=x.snapshots.find(v=>v.state==="complete");if(!s)process.exit(2);process.stdout.write(s.id)' "$SNAPS")"   || fail "No complete encrypted snapshot available"

VERIFY="$(curl -fsS -X POST -H "content-type: application/json" -H "x-izakhono-key: $BACKUP_KEY"   --data '{}' "http://127.0.0.1:8870/v1/snapshots/$SNAP_ID/verify")" || fail "Snapshot verification request failed"
node -e 'const x=JSON.parse(process.argv[1]);if(x.verified!==true||!/^[0-9a-f]{64}$/.test(x.sha256))process.exit(2)' "$VERIFY"   || fail "Encrypted snapshot verification failed"
unset BACKUP_KEY
ok "encrypted snapshot authenticated-decryption and SHA verification passed"

if [ -f /etc/izakhono/tls/fullchain.pem ] && [ -f /etc/izakhono/tls/privkey.pem ]; then
  systemctl is-active --quiet izakhono-edge-node || fail "EDGE NODE should be active when TLS material exists"
  probe_json EDGE http://127.0.0.1:8795/health "IZAKHONO EDGE NODE"
else
  note "EDGE pending TLS material; internal owned cloud is healthy"
fi

if [ -f /etc/izakhono/code-source.env ]; then
  grep -q '^IZAKHONO_CODE_REPO_URL=http://127.0.0.1:8860/git/' /etc/izakhono/code-source.env     || fail "Owned CODE source file does not point to CODE NODE"
  ok "application source is anchored to IZAKHONO CODE"
else
  note "owned CODE source migration has not yet been performed"
fi

{
  echo "STATUS=PASS"
  echo "PROVED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "EDGE=$([ -f /etc/izakhono/tls/fullchain.pem ] && echo CONFIGURED || echo PENDING_TLS)"
} >>"$REPORT"

echo
echo "IZAKHONO FIRST HOST PROOF: PASS"
echo "Report: $REPORT"
