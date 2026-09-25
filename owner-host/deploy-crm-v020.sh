#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo -E bash "$0" "$@"
fi

SOURCE_ROOT="${IZAKHONO_CRM_SOURCE_ROOT:-/opt/izakhono-source/izakhono-builder}"
REPO_URL="https://github.com/bevanshelton-netizen/izakhono-builder.git"
REQUIRED_COMMIT="3d115c5ae5c092beb7011622fdda1534f885e68a"
REQUEST_ID="${IZAKHONO_CRM_REQUEST_ID:-crm-v020-node01-20260925-01}"
STATE_DIR="/var/lib/izakhono-deploy"
RECEIPT="$STATE_DIR/crm-v020.json"
EVIDENCE="/opt/izakhono/evidence/IZAKHONO-CRM-V020-NODE01-REPORT.json"

mkdir -p "$STATE_DIR" /opt/izakhono/evidence
chmod 0700 "$STATE_DIR"

need(){ command -v "$1" >/dev/null 2>&1 || { echo "[FAIL] Missing dependency: $1" >&2; exit 2; }; }
for x in git docker node curl jq openssl; do need "$x"; done
docker compose version >/dev/null 2>&1 || { echo "[FAIL] Docker Compose v2 is required." >&2; exit 2; }

if [ -s "$RECEIPT" ]; then
  if node - "$RECEIPT" "$REQUEST_ID" <<'NODE'
const fs=require('fs');
const [path,id]=process.argv.slice(2);
const x=JSON.parse(fs.readFileSync(path,'utf8'));
process.exit(x.request_id===id && x.status==='success' ? 0 : 1);
NODE
  then
    echo "[PASS] CRM v0.2.0 request already completed: $REQUEST_ID"
    exit 0
  fi
fi

if [ -d "$SOURCE_ROOT/.git" ]; then
  ORIGIN="$(git -C "$SOURCE_ROOT" remote get-url origin 2>/dev/null || true)"
  case "$ORIGIN" in
    https://github.com/bevanshelton-netizen/izakhono-builder*|git@github.com:bevanshelton-netizen/izakhono-builder*) ;;
    *) echo "[FAIL] Refusing unapproved CRM source origin: $ORIGIN" >&2; exit 3 ;;
  esac
  if [ -n "$(git -C "$SOURCE_ROOT" status --porcelain)" ]; then
    echo "[FAIL] Dedicated CRM source checkout is dirty: $SOURCE_ROOT" >&2
    exit 3
  fi
  git -C "$SOURCE_ROOT" fetch --quiet origin main
  git -C "$SOURCE_ROOT" checkout -q main
  git -C "$SOURCE_ROOT" reset --hard -q origin/main
else
  rm -rf "$SOURCE_ROOT"
  git clone --quiet --branch main --single-branch "$REPO_URL" "$SOURCE_ROOT"
fi

git -C "$SOURCE_ROOT" merge-base --is-ancestor "$REQUIRED_COMMIT" HEAD || {
  echo "[FAIL] Canonical main does not contain required CRM v0.2.0 commit $REQUIRED_COMMIT" >&2
  exit 4
}

node - "$SOURCE_ROOT" <<'NODE'
const path=require('path');
const root=process.argv[2];
const pkg=require(path.join(root,'products/izakhono-crm/package.json'));
const manifest=require(path.join(root,'products/izakhono-crm/.izakhono.json'));
if(pkg.version!=='0.2.0') throw new Error('CRM package is not v0.2.0');
if(manifest.application_version!=='0.2.0') throw new Error('CRM manifest is not v0.2.0');
if(manifest.infrastructure?.owned_target!=='NODE01') throw new Error('CRM target is not NODE01');
NODE

STARTED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
SOURCE_COMMIT="$(git -C "$SOURCE_ROOT" rev-parse HEAD)"
STATUS="failed"
EXIT_CODE=1

set +e
bash "$SOURCE_ROOT/infra/app-fabric-runtime/activate-node01.sh" "$EVIDENCE"
EXIT_CODE=$?
set -e

if [ "$EXIT_CODE" -eq 0 ]; then
  docker exec izakhono-crm node -e 'fetch("http://127.0.0.1:8080/health").then(r=>r.json()).then(h=>{if(h.ok!==true||h.service!=="izakhono-crm"||h.version!=="0.2.0"||h.auth==="local-dev")process.exit(2);console.log("CRM_V020_HEALTH=PASS")}).catch(()=>process.exit(3))'
  docker exec izakhono-crm node -e 'fetch("http://127.0.0.1:8080/api/summary",{headers:{"x-entity-id":"izakhono-africa","x-platform-id":"faisready"}}).then(r=>{if(r.status!==401)process.exit(2);console.log("CRM_FAIL_CLOSED=PASS")}).catch(()=>process.exit(3))'
  jq -e '.overall=="PASS_INTERNAL_OWNED" and .crm.health=="healthy" and .fabric.health=="healthy" and .public_cutover_performed==false' "$EVIDENCE" >/dev/null
  STATUS="success"
fi

ENDED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
node - "$RECEIPT" "$REQUEST_ID" "$STATUS" "$EXIT_CODE" "$SOURCE_COMMIT" "$REQUIRED_COMMIT" "$STARTED" "$ENDED" "$EVIDENCE" <<'NODE'
const fs=require('fs');
const [path,requestId,status,exitCode,source,required,started,ended,evidence]=process.argv.slice(2);
fs.writeFileSync(path,JSON.stringify({
  schema:'izakhono.crm-v020.node01-deployment/v1',
  request_id:requestId,
  status,
  exit_code:Number(exitCode),
  source_repo:'bevanshelton-netizen/izakhono-builder',
  source_commit:source,
  required_commit:required,
  crm_version:'0.2.0',
  authority:'NODE01',
  external_resilience_preserved:true,
  public_cutover_performed:false,
  live_claim:false,
  evidence_path:evidence,
  started_at:started,
  ended_at:ended
},null,2)+'\n',{mode:0o600});
NODE
chmod 0600 "$RECEIPT"

if [ "$STATUS" = "success" ]; then
  echo "[PASS] IZAKHONO CRM v0.2.0 is deployed internally on NODE01."
  echo "Receipt: $RECEIPT"
  echo "Evidence: $EVIDENCE"
  exit 0
fi

echo "[FAIL] IZAKHONO CRM v0.2.0 activation failed with exit $EXIT_CODE" >&2
exit "$EXIT_CODE"
