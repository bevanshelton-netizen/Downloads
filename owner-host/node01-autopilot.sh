#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo -E bash "$0" "$@"
fi

ROOT="${IZAKHONO_AUTOPILOT_ROOT:-/opt/izakhono-source/Downloads}"
REPORT_DIR="/var/lib/izakhono-deploy"
REPORT="$REPORT_DIR/node01-autopilot.json"
HOSTNAME="${IZAKHONO_ONE_AI_HOSTNAME:-one.domains.izakhonoafrica.co.za}"
R0_MODE="${IZAKHONO_ONE_R0_MODE:-1}"
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
one_agent_state="NOT_RUN"
runner_state="NOT_CONFIGURED"
local_one="NOT_VERIFIED"
owned_edge="NOT_ATTEMPTED"
owned_edge_exit=0
public_https="NOT_VERIFIED"
drop01_watch="NOT_RUN"
drop01_watch_exit=0
crm_v020="NOT_RUN"
crm_v020_exit=0
crm_notify="NOT_RUN"
crm_notify_exit=0

if [ -n "$(git -C "$ROOT" status --porcelain)" ]; then
  source_state="BLOCKED_DIRTY"
else
  set +e
  sync_out="$(bash "$ROOT/owner-host/sync-owner-source.sh" "$ROOT" 2>&1)"
  sync_exit=$?
  set -e
  if [ "$sync_exit" -eq 0 ]; then
    source_state="$(printf '%s\n' "$sync_out" | awk -F= '$1=="SOURCE_AUTHORITY"{print $2;exit}')"
    [ -n "$source_state" ] || source_state="SYNCED_UNKNOWN_AUTHORITY"
  else
    source_state="SYNC_FAILED_$sync_exit"
  fi

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

  ONE_CONTROL="$ROOT/owner-host/control/one-desired-state.json"
  if [ -f "$ONE_CONTROL" ]; then
    set +e
    IZAKHONO_OWNER_CONTROL_PATH="owner-host/control/one-desired-state.json" \
    IZAKHONO_OWNER_AGENT_STATE_FILE="/var/lib/izakhono-owner-agent/one-state.json" \
      bash "$ROOT/owner-host/owner-agent.sh"
    one_agent_exit=$?
    set -e
    if [ "$one_agent_exit" -eq 0 ]; then
      if [ -s /var/lib/izakhono-owner-agent/one-state.json ]; then
        one_agent_state="$(node -e 'try{const x=require(process.argv[1]);process.stdout.write(String(x.status||"UNKNOWN"))}catch{process.stdout.write("UNKNOWN")}' /var/lib/izakhono-owner-agent/one-state.json)"
      else
        one_agent_state="IDLE_OR_NO_RECEIPT"
      fi
    else
      one_agent_state="EXIT_$one_agent_exit"
    fi
  else
    one_agent_state="CONTROL_MISSING"
  fi

  CRM_CONTROL="$ROOT/owner-host/control/crm-v020-desired-state.json"
  if [ -f "$CRM_CONTROL" ] && [ -f "$ROOT/owner-host/deploy-crm-v020.sh" ]; then
    CRM_REQUEST="$(node - "$CRM_CONTROL" <<'NODE'
const fs=require('fs');
const x=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
if(x.schema!=='izakhono.crm-v020.owner-request/v1') process.exit(2);
if(x.enabled!==true) process.exit(3);
if(x.crm_version!=='0.2.0') process.exit(4);
if(x.target!=='NODE01') process.exit(5);
if(x.public_cutover!==false||x.external_resilience_preserve!==true) process.exit(6);
if(!/^[A-Za-z0-9._:-]{8,120}$/.test(String(x.id||''))) process.exit(7);
process.stdout.write(x.id);
NODE
)" || CRM_REQUEST=""
    if [ -n "$CRM_REQUEST" ]; then
      set +e
      IZAKHONO_CRM_REQUEST_ID="$CRM_REQUEST" bash "$ROOT/owner-host/deploy-crm-v020.sh"
      crm_v020_exit=$?
      set -e
      if [ "$crm_v020_exit" -eq 0 ]; then
        if [ -s /var/lib/izakhono-deploy/crm-v020.json ]; then
          crm_v020="$(node -e 'try{const x=require(process.argv[1]);process.stdout.write(x.status==="success"?"DEPLOYED_INTERNAL_OWNED":"RECEIPT_"+String(x.status||"UNKNOWN").toUpperCase())}catch{process.stdout.write("RECEIPT_INVALID")}' /var/lib/izakhono-deploy/crm-v020.json)"
        else
          crm_v020="NO_RECEIPT"
        fi
      else
        crm_v020="FAILED_$crm_v020_exit"
      fi
    else
      crm_v020="CONTROL_INVALID_OR_DISABLED"
    fi
  else
    crm_v020="CONTROL_OR_DEPLOYER_MISSING"
  fi

  if [ -f "$ROOT/owner-host/notify-crm-v020-completion.sh" ]; then
    set +e
    notify_out="$(bash "$ROOT/owner-host/notify-crm-v020-completion.sh" 2>&1)"
    crm_notify_exit=$?
    set -e
    if [ "$crm_notify_exit" -eq 0 ]; then
      case "$notify_out" in
        *"CRM_NOTIFY=SENT"*) crm_notify="SENT" ;;
        *"CRM_NOTIFY=ALREADY_SENT"*) crm_notify="ALREADY_SENT" ;;
        *"CRM_NOTIFY=WAITING_SUCCESS"*) crm_notify="WAITING_SUCCESS" ;;
        *"CRM_NOTIFY=WAITING_RECEIPT"*) crm_notify="WAITING_RECEIPT" ;;
        *"CRM_NOTIFY=WAITING_NOTIFY_NODE"*) crm_notify="WAITING_NOTIFY_NODE" ;;
        *"CRM_NOTIFY=WAITING_NOTIFY_NODE_CONFIG"*) crm_notify="WAITING_NOTIFY_NODE_CONFIG" ;;
        *"CRM_NOTIFY=WAITING_NOTIFY_KEY"*) crm_notify="WAITING_NOTIFY_KEY" ;;
        *) crm_notify="CHECKED" ;;
      esac
    else
      crm_notify="FAILED_$crm_notify_exit"
    fi
  else
    crm_notify="WATCHER_MISSING"
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
  if [ "$R0_MODE" = "1" ]; then
    set +e
    IZAKHONO_BRIDGE_APP="izakhono-one-ai" \
    IZAKHONO_BRIDGE_HEALTH_PATH="/health" \
    IZAKHONO_BRIDGE_EXPECTED_SERVICE="" \
    IZAKHONO_BRIDGE_EXPECTED_PRODUCT="IZAKHONO ONE AI" \
    IZAKHONO_BRIDGE_EXPECTED_STATUS="healthy" \
      bash "$ROOT/izakhono-owned-cloud/activate-tailscale-funnel.sh"
    owned_edge_exit=$?
    set -e
    case "$owned_edge_exit" in
      0) owned_edge="R0_BRIDGE_VERIFIED" ;;
      20) owned_edge="R0_BRIDGE_AUTH_REQUIRED" ;;
      21) owned_edge="R0_BRIDGE_FUNNEL_APPROVAL_REQUIRED" ;;
      22) owned_edge="R0_BRIDGE_PUBLIC_HEALTH_PENDING" ;;
      *) owned_edge="R0_BRIDGE_FAILED_$owned_edge_exit" ;;
    esac
  else
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
fi

if [ "$R0_MODE" = "1" ] && [ -s "$REPORT_DIR/tailscale-funnel-izakhono-one-ai.json" ]; then
  if node -e 'const x=require(process.argv[1]);process.exit(x.state==="LIVE_VERIFIED"&&x.public_ready===true?0:1)' "$REPORT_DIR/tailscale-funnel-izakhono-one-ai.json" >/dev/null 2>&1; then
    public_https="R0_BRIDGE_VERIFIED_PENDING_INDEPENDENT_WITNESS"
  fi
elif curl -fsS --max-time 10 "https://$HOSTNAME/health" >/tmp/izakhono-one-autopilot-public.json 2>/dev/null; then
  if node - <<'NODE' >/dev/null 2>&1
const x=require('/tmp/izakhono-one-autopilot-public.json');
if(x.product!=='IZAKHONO ONE AI'||x.status!=='healthy'||x.tracking!==false||x.promptPersistence!==false||x.chatReady!==true||x.accountReachable!==true||x.publicSignup!==true||x.emailVerificationRequired!==true) process.exit(2);
NODE
  then
    public_https="LOCALLY_REACHABLE_PENDING_INDEPENDENT_VERIFY"
  fi
fi

if [ -f "$ROOT/owner-host/drop01-milestone-watch.mjs" ]; then
  set +e
  node "$ROOT/owner-host/drop01-milestone-watch.mjs" >/tmp/allegro-drop01-milestone-watch.json 2>/tmp/allegro-drop01-milestone-watch.err
  drop01_watch_exit=$?
  set -e
  if [ "$drop01_watch_exit" -eq 0 ]; then
    if node -e 'const fs=require("fs");const x=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.exit(x.ok===true?0:1)' /tmp/allegro-drop01-milestone-watch.json >/dev/null 2>&1; then
      if grep -q '"skipped":true' /tmp/allegro-drop01-milestone-watch.json 2>/dev/null; then
        drop01_watch="SCHEDULED_NOT_DUE"
      else
        drop01_watch="CHECKED"
      fi
    else
      drop01_watch="INVALID_RESULT"
    fi
  else
    drop01_watch="FAILED_$drop01_watch_exit"
  fi
else
  drop01_watch="WATCHER_MISSING"
fi

ended="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
commit="$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || true)"
node - "$REPORT" "$started" "$ended" "$commit" "$source_state" "$agent_state" "$one_agent_state" "$runner_state" "$crm_v020" "$crm_v020_exit" "$crm_notify" "$crm_notify_exit" "$local_one" "$owned_edge" "$owned_edge_exit" "$public_https" "$drop01_watch" "$drop01_watch_exit" "$R0_MODE" <<'NODE'
const fs=require('fs');
const [path,started,ended,commit,source,agent,oneAgent,runner,crmV020,crmV020Exit,crmNotify,crmNotifyExit,localOne,edge,edgeExit,publicHttps,drop01Watch,drop01WatchExit,r0Mode]=process.argv.slice(2);
fs.writeFileSync(path,JSON.stringify({
  schema:'izakhono.node01-autopilot/v1',
  node:'NODE01',
  authority:'NODE01',
  source_commit:commit||null,
  source_state:source,
  owner_agent:agent,
  one_owner_agent:oneAgent,
  authority_role:'NODE01',
  execution_class:'IZAKHONO_SOVEREIGN_NODE',
  github_runner:runner,
  crm_v020_deployment:crmV020,
  crm_v020_exit:Number(crmV020Exit),
  crm_v020_notification:crmNotify,
  crm_v020_notification_exit:Number(crmNotifyExit),
  one_local_runtime:localOne,
  owned_edge_state:edge,
  owned_edge_exit:Number(edgeExit),
  public_https:publicHttps,
  zero_budget_mode:r0Mode==="1",
  custom_domain_required:r0Mode==="1"?false:true,
  allegro_drop01_milestone_watch:drop01Watch,
  allegro_drop01_milestone_watch_exit:Number(drop01WatchExit),
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
echo "ONE_OWNER_AGENT=$one_agent_state"
echo "AUTHORITY_ROLE=NODE01"
echo "EXECUTION_CLASS=IZAKHONO_SOVEREIGN_NODE"
echo "GITHUB_RUNNER=$runner_state"
echo "CRM_V020=$crm_v020"
echo "CRM_V020_NOTIFY=$crm_notify"
echo "ONE_LOCAL=$local_one"
echo "OWNED_EDGE=$owned_edge"
echo "PUBLIC_HTTPS=$public_https"
echo "ZERO_BUDGET_MODE=$R0_MODE"
echo "CUSTOM_DOMAIN_REQUIRED=$([ "$R0_MODE" = "1" ] && echo false || echo true)"
echo "ALLEGRO_DROP01_MILESTONE_WATCH=$drop01_watch"
echo "LIVE_CLAIM=false"
echo "RECEIPT=$REPORT"
