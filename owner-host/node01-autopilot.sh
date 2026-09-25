#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo -E bash "$0" "$@"
fi

ROOT="${IZAKHONO_AUTOPILOT_ROOT:-/opt/izakhono-source/Downloads}"
REPORT_DIR="/var/lib/izakhono-deploy"
REPORT="$REPORT_DIR/node01-autopilot.json"
HOSTNAME="${IZAKHONO_ONE_AI_HOSTNAME:-one.domains.izakhonoafrica.co.za}"
LOCK="/run/lock/izakhono-node01-autopilot.lock"

mkdir -p "$REPORT_DIR" "$(dirname "$LOCK")"
chmod 0700 "$REPORT_DIR"
exec 9>"$LOCK"
flock -n 9 || exit 0

fail(){ echo "FAIL: $*" >&2; exit 2; }
need(){ command -v "$1" >/dev/null 2>&1 || fail "$1 is required"; }
for c in git node curl flock systemctl; do need "$c"; done
[ -d "$ROOT/.git" ] || fail "Owner source checkout missing: $ROOT"

started="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
source_state="UNKNOWN"
agent_state="NOT_RUN"
runner_state="NOT_CONFIGURED"
local_one="NOT_VERIFIED"
owned_edge="NOT_ATTEMPTED"
owned_edge_exit=0
public_https="NOT_VERIFIED"

if [ -n "$(git -C "$ROOT" status --porcelain)" ]; then
  source_state="BLOCKED_DIRTY"
else
  git -C "$ROOT" fetch --quiet origin main
  git -C "$ROOT" checkout -q main
  git -C "$ROOT" reset --hard -q origin/main
  source_state="SYNCED"

  set +e
  bash "$ROOT/owner-host/owner-agent.sh"
  agent_exit=$?
  set -e
  if [ "$agent_exit" -eq 0 ]; then
    if [ -s /var/lib/izakhono-owner-agent/state.json ]; then
      agent_state="$(node -e 'try{const x=require(process.argv[1]);process.stdout.write(String(x.status||"UNKNOWN"))}catch{process.stdout.write("UNKNOWN")}' /var/lib/izakhono-owner-agent/state.json)"
    else
      agent_state="IDLE_OR_NO_RECEIPT"
    fi
  else
    agent_state="EXIT_$agent_exit"
  fi
fi

if [ -s /opt/izakhono-actions-runner/.service ]; then
  service_name="$(cat /opt/izakhono-actions-runner/.service)"
  systemctl start "$service_name" >/dev/null 2>&1 || true
  if systemctl is-active --quiet "$service_name"; then runner_state="ACTIVE"; else runner_state="INACTIVE"; fi
fi

if curl -fsS --max-time 5 -H "Host: $HOSTNAME" http://127.0.0.1:8080/health >/tmp/izakhono-one-autopilot-health.json 2>/dev/null; then
  if node - <<'NODE' >/dev/null 2>&1
const x=require('/tmp/izakhono-one-autopilot-health.json');
if(x.product!=='IZAKHONO ONE AI'||x.status!=='healthy'||x.tracking!==false||x.promptPersistence!==false||x.chatReady!==true||x.accountReachable!==true) process.exit(2);
NODE
  then
    local_one="VERIFIED"
  fi
fi

if [ "$local_one" = "VERIFIED" ]; then
  set +e
  IZAKHONO_PUBLIC_HOSTNAME="$HOSTNAME" \
  IZAKHONO_PUBLIC_ZONE="domains.izakhonoafrica.co.za" \
  IZAKHONO_PUBLIC_EXTRA_HOSTS="$HOSTNAME" \
    bash "$ROOT/izakhono-owned-cloud/activate-owned-public-edge.sh"
  owned_edge_exit=$?
  set -e
  case "$owned_edge_exit" in
    0) owned_edge="LOCAL_EDGE_PROVED" ;;
    20) owned_edge="PARENT_DNS_OR_ROUTER_REQUIRED" ;;
    21) owned_edge="TLS_OR_PORTS_REQUIRED" ;;
    *) owned_edge="FAILED_$owned_edge_exit" ;;
  esac
fi

if curl -fsS --max-time 10 "https://$HOSTNAME/health" >/tmp/izakhono-one-autopilot-public.json 2>/dev/null; then
  if node - <<'NODE' >/dev/null 2>&1
const x=require('/tmp/izakhono-one-autopilot-public.json');
if(x.product!=='IZAKHONO ONE AI'||x.status!=='healthy'||x.tracking!==false||x.promptPersistence!==false||x.chatReady!==true||x.accountReachable!==true||x.publicSignup!==true||x.emailVerificationRequired!==true) process.exit(2);
NODE
  then
    public_https="LOCALLY_REACHABLE_PENDING_INDEPENDENT_VERIFY"
  fi
fi

ended="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
commit="$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || true)"
node - "$REPORT" "$started" "$ended" "$commit" "$source_state" "$agent_state" "$runner_state" "$local_one" "$owned_edge" "$owned_edge_exit" "$public_https" <<'NODE'
const fs=require('fs');
const [path,started,ended,commit,source,agent,runner,localOne,edge,edgeExit,publicHttps]=process.argv.slice(2);
fs.writeFileSync(path,JSON.stringify({
  schema:'izakhono.node01-autopilot/v1',
  node:'NODE01',
  authority:'NODE01',
  source_commit:commit||null,
  source_state:source,
  owner_agent:agent,
  github_runner:runner,
  one_local_runtime:localOne,
  owned_edge_state:edge,
  owned_edge_exit:Number(edgeExit),
  public_https:publicHttps,
  live_claim:false,
  independent_https_verification_required:true,
  external_resilience_preserved:true,
  tracking:false,
  started_at:started,
  ended_at:ended
},null,2)+"\n",{mode:0o600});
NODE
chmod 0600 "$REPORT"

echo "IZAKHONO NODE01 AUTOPILOT"
echo "SOURCE=$source_state"
echo "OWNER_AGENT=$agent_state"
echo "GITHUB_RUNNER=$runner_state"
echo "ONE_LOCAL=$local_one"
echo "OWNED_EDGE=$owned_edge"
echo "PUBLIC_HTTPS=$public_https"
echo "LIVE_CLAIM=false"
echo "RECEIPT=$REPORT"
