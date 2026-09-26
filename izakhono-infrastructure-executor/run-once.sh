#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo -E bash "$0" "$@"
fi

ROOT="${IZAKHONO_INFRA_SOURCE_ROOT:-/opt/izakhono-source/Downloads}"
STATE_DIR="${IZAKHONO_INFRA_EXECUTOR_STATE_DIR:-/var/lib/izakhono-infrastructure-executor}"
CONTROL="$ROOT/infrastructure/control/portfolio-desired-state.json"
TARGETS="$ROOT/izakhono-infrastructure-executor/targets.json"
AUTHORITY="$ROOT/IZAKHONO-INFRASTRUCTURE-AUTHORITY.json"
CATALOG="$ROOT/owner-host/platforms.json"
SYNC="$ROOT/izakhono-infrastructure-executor/sync-source.sh"
DEPLOY_TIMEOUT="${IZAKHONO_INFRA_EXECUTOR_DEPLOY_TIMEOUT_SECONDS:-3600}"

mkdir -p "$STATE_DIR/requests" "$STATE_DIR/logs"
chmod 0700 "$STATE_DIR" "$STATE_DIR/requests" "$STATE_DIR/logs"

exec 9>"$STATE_DIR/executor.lock"
flock -n 9 || exit 0

SOURCE_INFO="$("$SYNC")"
printf '%s\n' "$SOURCE_INFO" >"$STATE_DIR/last-source-sync.txt"
chmod 0600 "$STATE_DIR/last-source-sync.txt"

node - "$AUTHORITY" "$CONTROL" "$TARGETS" "$CATALOG" <<'NODE'
const fs=require('fs');
const [authorityPath,controlPath,targetsPath,catalogPath]=process.argv.slice(2);
const a=JSON.parse(fs.readFileSync(authorityPath,'utf8'));
if(a.runtime_authority!=='IZAKHONO_INFRASTRUCTURE') throw new Error('runtime authority mismatch');
if(a.primary_execution_fabric!=='IZAKHONO_INFRASTRUCTURE_FABRIC') throw new Error('execution fabric mismatch');
if(a.laptop?.role!=='ADMIN_CLIENT_ONLY'||a.laptop?.runtime_dependency!==false||a.laptop?.deployment_target!==false) throw new Error('laptop isolation contract failed');
if(a.communication_policy?.platform_to_laptop!=='DENY') throw new Error('platform-to-laptop traffic must be DENY');
const c=JSON.parse(fs.readFileSync(controlPath,'utf8'));
if(c.schema!=='izakhono.infrastructure-desired-state/v1'||c.authority!=='IZAKHONO_INFRASTRUCTURE') throw new Error('control contract mismatch');
const t=JSON.parse(fs.readFileSync(targetsPath,'utf8'));
if(t.schema!=='izakhono.infrastructure-executor-targets/v1'||t.authority!=='IZAKHONO_INFRASTRUCTURE'||t.laptop_eligible!==false) throw new Error('target manifest mismatch');
const p=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
if(p.infrastructurePolicy?.authority!=='IZAKHONO_INFRASTRUCTURE') throw new Error('platform catalog authority mismatch');
NODE

mapfile -t REQUEST_IDS < <(node - "$CONTROL" <<'NODE'
const fs=require('fs');
const c=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
if(c.enabled!==true) process.exit(0);
for(const r of c.requests||[]){
  if(r?.enabled===true) process.stdout.write(String(r.id||'')+'\n');
}
NODE
)

for REQUEST_ID in "${REQUEST_IDS[@]}"; do
  [ -n "$REQUEST_ID" ] || continue
  [[ "$REQUEST_ID" =~ ^[A-Za-z0-9._-]{6,160}$ ]] || { echo "Invalid request id: $REQUEST_ID" >&2; continue; }

  META="$(node - "$CONTROL" "$TARGETS" "$CATALOG" "$REQUEST_ID" <<'NODE'
const fs=require('fs');
const [controlPath,targetsPath,catalogPath,id]=process.argv.slice(2);
const c=JSON.parse(fs.readFileSync(controlPath,'utf8'));
const t=JSON.parse(fs.readFileSync(targetsPath,'utf8'));
const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
const r=(c.requests||[]).find(x=>x.id===id);
if(!r||r.enabled!==true) process.exit(10);
if(r.action!=='deploy-platform') throw new Error('unsupported action');
if(r.laptop_target!==false) throw new Error('laptop target must be false');
if(r.public_live_claim!==false) throw new Error('executor cannot create a public-live claim');
if(r.external_resilience_preserve!==true) throw new Error('external resilience must be preserved');
const target=t.targets?.[r.platform_id];
if(!target||!Array.isArray(target.command)||target.command.length<2) throw new Error('target is not infrastructure-native or is not allow-listed');
if(target.command[0]!=='bash') throw new Error('only allow-listed bash deployment wrappers are supported');
const script=String(target.command[1]||'');
if(!/^izakhono-owned-cloud\/[A-Za-z0-9._-]+\.sh$/.test(script)) throw new Error('deployment path outside owned-cloud allowlist');
const platform=(catalog.platforms||[]).find(p=>p.id===r.platform_id||p.productId===r.platform_id);
if(!platform) throw new Error('platform missing from catalog');
if(platform.runtimeAuthority!=='IZAKHONO_INFRASTRUCTURE'||platform.laptopRuntimeDependency!==false||platform.laptopDeploymentTarget!==false||platform.platformToLaptopTraffic!=='DENY') throw new Error('platform infrastructure policy mismatch');
const max=Math.min(10,Math.max(1,Number(r.max_attempts||3)));
console.log(JSON.stringify({platformId:r.platform_id,command:target.command,maxAttempts:max}));
NODE
)" || { echo "Request $REQUEST_ID rejected by infrastructure policy." >&2; continue; }

  PLATFORM_ID="$(node -e 'const x=JSON.parse(process.argv[1]);process.stdout.write(x.platformId)' "$META")"
  MAX_ATTEMPTS="$(node -e 'const x=JSON.parse(process.argv[1]);process.stdout.write(String(x.maxAttempts))' "$META")"
  STATE="$STATE_DIR/requests/$REQUEST_ID.json"
  LOG="$STATE_DIR/logs/$REQUEST_ID.log"

  PREV_STATUS=""
  PREV_ATTEMPTS=0
  if [ -s "$STATE" ]; then
    PREV_STATUS="$(node -e 'const x=require(process.argv[1]);process.stdout.write(String(x.status||""))' "$STATE" 2>/dev/null || true)"
    PREV_ATTEMPTS="$(node -e 'const x=require(process.argv[1]);process.stdout.write(String(Number(x.attempts||0)))' "$STATE" 2>/dev/null || echo 0)"
  fi
  [ "$PREV_STATUS" != "success" ] || continue
  if [ "$PREV_ATTEMPTS" -ge "$MAX_ATTEMPTS" ]; then continue; fi

  ATTEMPT=$((PREV_ATTEMPTS+1))
  STARTED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  SOURCE_AUTHORITY="$(awk -F= '$1=="SOURCE_AUTHORITY"{print $2;exit}' "$STATE_DIR/last-source-sync.txt")"
  SOURCE_COMMIT="$(awk -F= '$1=="SOURCE_COMMIT"{print $2;exit}' "$STATE_DIR/last-source-sync.txt")"

  node - "$STATE" "$REQUEST_ID" "$PLATFORM_ID" "$ATTEMPT" "$STARTED" "$SOURCE_AUTHORITY" "$SOURCE_COMMIT" <<'NODE'
const fs=require('fs');
const [path,id,platform,attempt,started,sourceAuthority,sourceCommit]=process.argv.slice(2);
fs.writeFileSync(path,JSON.stringify({
  schema:'izakhono.infrastructure-executor-receipt/v1',
  request_id:id,platform_id:platform,status:'running',attempts:Number(attempt),
  started_at:started,completed_at:null,exit_code:null,
  runtime_authority:'IZAKHONO_INFRASTRUCTURE',
  source_authority:sourceAuthority||null,source_commit:sourceCommit||null,
  laptop_target:false,platform_to_laptop_traffic:'DENY',
  public_live_claim:false,external_resilience_preserved:true
},null,2)+'\n',{mode:0o600});
NODE

  mapfile -t CMD < <(node -e 'const x=JSON.parse(process.argv[1]);for(const a of x.command) console.log(a)' "$META")
  SCRIPT="${CMD[1]}"
  [ -f "$ROOT/$SCRIPT" ] || { echo "Missing allow-listed deployer: $SCRIPT" >>"$LOG"; EXIT_CODE=40; }
  if [ -f "$ROOT/$SCRIPT" ]; then
    {
      echo "[executor] request=$REQUEST_ID platform=$PLATFORM_ID attempt=$ATTEMPT"
      echo "[executor] authority=IZAKHONO_INFRASTRUCTURE laptop_target=false"
      cd "$ROOT"
      set +e
      timeout --signal=TERM --kill-after=30s "$DEPLOY_TIMEOUT" "${CMD[@]}"
      EXIT_CODE=$?
      set -e
      echo "[executor] exit=$EXIT_CODE"
    } >>"$LOG" 2>&1
  fi
  chmod 0600 "$LOG"

  COMPLETED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  STATUS="failed"
  [ "$EXIT_CODE" -eq 0 ] && STATUS="success"

  node - "$STATE" "$STATUS" "$EXIT_CODE" "$COMPLETED" <<'NODE'
const fs=require('fs');
const [path,status,exitCode,completed]=process.argv.slice(2);
const x=JSON.parse(fs.readFileSync(path,'utf8'));
x.status=status;x.exit_code=Number(exitCode);x.completed_at=completed;
fs.writeFileSync(path,JSON.stringify(x,null,2)+'\n',{mode:0o600});
NODE
done

node - "$STATE_DIR" <<'NODE'
const fs=require('fs'),path=require('path');
const dir=path.join(process.argv[2],'requests');
const receipts=fs.existsSync(dir)?fs.readdirSync(dir).filter(x=>x.endsWith('.json')).map(x=>JSON.parse(fs.readFileSync(path.join(dir,x),'utf8'))):[];
const summary={
 schema:'izakhono.infrastructure-executor-status/v1',
 generated_at:new Date().toISOString(),
 authority:'IZAKHONO_INFRASTRUCTURE',
 laptop_dependency:false,
 platform_to_laptop_traffic:'DENY',
 requests:receipts.map(x=>({request_id:x.request_id,platform_id:x.platform_id,status:x.status,attempts:x.attempts,completed_at:x.completed_at}))
};
fs.writeFileSync(path.join(process.argv[2],'status.json'),JSON.stringify(summary,null,2)+'\n',{mode:0o600});
NODE
