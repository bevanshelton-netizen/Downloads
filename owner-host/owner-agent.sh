#!/usr/bin/env bash
set -euo pipefail

if [ "\${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo -E bash "$0" "$@"
fi

ROOT="\${IZAKHONO_OWNER_AGENT_ROOT:-/opt/izakhono-source/Downloads}"
CONTROL_PATH="owner-host/control/desired-state.json"
STATE_DIR="/var/lib/izakhono-owner-agent"
RUN_DIR="$STATE_DIR/runs"
STATE_FILE="$STATE_DIR/state.json"
LOCK_FILE="/run/lock/izakhono-owner-agent.lock"

mkdir -p "$RUN_DIR" "$(dirname "$LOCK_FILE")"
chmod 0700 "$STATE_DIR" "$RUN_DIR"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  exit 0
fi

fail(){ echo "FAIL: $*" >&2; exit 2; }
need(){ command -v "$1" >/dev/null 2>&1 || fail "$1 is required"; }

for cmd in git node curl flock; do need "$cmd"; done
[ -d "$ROOT/.git" ] || fail "Owner source checkout missing: $ROOT"

REMOTE_URL="$(git -C "$ROOT" remote get-url origin 2>/dev/null || true)"
case "$REMOTE_URL" in
  https://github.com/bevanshelton-netizen/Downloads*|git@github.com:bevanshelton-netizen/Downloads*) ;;
  *) fail "Refusing unapproved Git origin: $REMOTE_URL" ;;
esac

git -C "$ROOT" fetch --quiet origin main
SOURCE_COMMIT="$(git -C "$ROOT" rev-parse origin/main)"
CONTROL_TMP="$(mktemp)"
trap 'rm -f "$CONTROL_TMP"' EXIT
git -C "$ROOT" show "origin/main:$CONTROL_PATH" >"$CONTROL_TMP" 2>/dev/null || fail "Control document missing on origin/main"

VALIDATED="$(node - "$CONTROL_TMP" <<'NODE'
const fs=require("fs");
const p=process.argv[2];
const x=JSON.parse(fs.readFileSync(p,"utf8"));
const allowed=new Set(["activate-one-local-model","configure-one-ai","deploy-one-ai","verify-one-ai"]);
if(typeof x!=="object"||!x)throw new Error("control must be an object");
if(typeof x.enabled!=="boolean")throw new Error("enabled must be boolean");
if(typeof x.id!=="string"||!/^[A-Za-z0-9._:-]{8,120}$/.test(x.id))throw new Error("invalid request id");
if(!allowed.has(x.action))throw new Error("action not allowed");
if(x.expires_at){
  const t=Date.parse(x.expires_at);
  if(!Number.isFinite(t))throw new Error("invalid expires_at");
  if(t<=Date.now())throw new Error("request expired");
}
const max=Math.max(1,Math.min(3,Number(x.max_attempts||1)));
const pms=x.params&&typeof x.params==="object"?x.params:{};
if(pms.model && !/^[A-Za-z0-9._:/-]{2,120}$/.test(String(pms.model)))throw new Error("invalid model");
if(pms.hostname){
  const h=String(pms.hostname).toLowerCase();
  if(!/^[a-z0-9.-]+\.izakhonoafrica\.co\.za$/.test(h))throw new Error("hostname outside approved IZAKHONO namespace");
}
process.stdout.write(JSON.stringify({
  id:x.id,enabled:x.enabled,action:x.action,max_attempts:max,
  requested_at:x.requested_at||null,expires_at:x.expires_at||null,
  params:{model:pms.model||null,hostname:pms.hostname||null}
}));
NODE
)" || fail "Control document validation failed"

ENABLED="$(node -e 'const x=JSON.parse(process.argv[1]);process.stdout.write(String(x.enabled))' "$VALIDATED")"
[ "$ENABLED" = "true" ] || exit 0

REQUEST_ID="$(node -e 'const x=JSON.parse(process.argv[1]);process.stdout.write(x.id)' "$VALIDATED")"
ACTION="$(node -e 'const x=JSON.parse(process.argv[1]);process.stdout.write(x.action)' "$VALIDATED")"
MAX_ATTEMPTS="$(node -e 'const x=JSON.parse(process.argv[1]);process.stdout.write(String(x.max_attempts))' "$VALIDATED")"
MODEL="$(node -e 'const x=JSON.parse(process.argv[1]);process.stdout.write(x.params.model||"")' "$VALIDATED")"
HOSTNAME="$(node -e 'const x=JSON.parse(process.argv[1]);process.stdout.write(x.params.hostname||"")' "$VALIDATED")"

PREV_ATTEMPTS=0
PREV_STATUS=""
if [ -f "$STATE_FILE" ]; then
  PREV_ID="$(node -e 'try{const x=require(process.argv[1]);process.stdout.write(String(x.request_id||""))}catch{}' "$STATE_FILE")"
  if [ "$PREV_ID" = "$REQUEST_ID" ]; then
    PREV_ATTEMPTS="$(node -e 'try{const x=require(process.argv[1]);process.stdout.write(String(x.attempts||0))}catch{process.stdout.write("0")}' "$STATE_FILE")"
    PREV_STATUS="$(node -e 'try{const x=require(process.argv[1]);process.stdout.write(String(x.status||""))}catch{}' "$STATE_FILE")"
    [ "$PREV_STATUS" = "success" ] && exit 0
    if [ "$PREV_ATTEMPTS" -ge "$MAX_ATTEMPTS" ]; then exit 0; fi
  fi
fi

if [ -n "$(git -C "$ROOT" status --porcelain)" ]; then
  STATUS="blocked-dirty-source"
  EXIT_CODE=3
  ATTEMPTS=$((PREV_ATTEMPTS+1))
  STARTED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  ENDED="$STARTED"
  node - "$STATE_FILE" "$REQUEST_ID" "$ACTION" "$STATUS" "$ATTEMPTS" "$EXIT_CODE" "$SOURCE_COMMIT" "$STARTED" "$ENDED" <<'NODE'
const fs=require("fs");
const [path,id,action,status,attempts,exitCode,source,started,ended]=process.argv.slice(2);
fs.writeFileSync(path,JSON.stringify({request_id:id,action,status,attempts:Number(attempts),exit_code:Number(exitCode),source_commit:source,started_at:started,ended_at:ended},null,2)+"\n");
NODE
  chmod 0600 "$STATE_FILE"
  exit 0
fi

git -C "$ROOT" checkout -q main
git -C "$ROOT" reset --hard -q origin/main

ATTEMPTS=$((PREV_ATTEMPTS+1))
STARTED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
LOG="$RUN_DIR/$REQUEST_ID.attempt-$ATTEMPTS.log"
STATUS="failed"
EXIT_CODE=1

{
  echo "IZAKHONO OWNER AGENT"
  echo "REQUEST_ID=$REQUEST_ID"
  echo "ACTION=$ACTION"
  echo "SOURCE_COMMIT=$SOURCE_COMMIT"
  echo "STARTED_AT=$STARTED"
  echo

  set +e
  case "$ACTION" in
    activate-one-local-model)
      [ -n "$MODEL" ] || MODEL="qwen2.5:3b"
      [ -n "$HOSTNAME" ] || HOSTNAME="one.domains.izakhonoafrica.co.za"
      export IZAKHONO_ONE_AI_HOSTNAME="$HOSTNAME"
      bash "$ROOT/izakhono-owned-cloud/activate-local-model-engine.sh" "$MODEL"
      EXIT_CODE=$?
      ;;
    configure-one-ai)
      bash "$ROOT/izakhono-owned-cloud/configure-izakhono-one-ai.sh"
      EXIT_CODE=$?
      ;;
    deploy-one-ai)
      [ -n "$HOSTNAME" ] || HOSTNAME="one.domains.izakhonoafrica.co.za"
      export IZAKHONO_ONE_AI_HOSTNAME="$HOSTNAME"
      bash "$ROOT/izakhono-owned-cloud/deploy-izakhono-one-ai.sh" main
      EXIT_CODE=$?
      ;;
    verify-one-ai)
      [ -n "$HOSTNAME" ] || HOSTNAME="one.domains.izakhonoafrica.co.za"
      LOCAL="$(curl -fsS --max-time 5 -H "Host: $HOSTNAME" http://127.0.0.1:8080/health)"
      node -e 'const x=JSON.parse(process.argv[1]);if(x.product!=="IZAKHONO ONE AI"||x.status!=="healthy")process.exit(2)' "$LOCAL"
      EXIT_CODE=$?
      if [ "$EXIT_CODE" -eq 0 ]; then
        curl -fsS --max-time 8 "https://$HOSTNAME/health" >/tmp/izakhono-owner-agent-public-health.json 2>/dev/null
        PUBLIC_EXIT=$?
        echo "PUBLIC_HTTPS_EXIT=$PUBLIC_EXIT"
      fi
      ;;
  esac
  set -e

  echo
  echo "EXIT_CODE=$EXIT_CODE"
} >"$LOG" 2>&1

if [ "$EXIT_CODE" -eq 0 ]; then STATUS="success"; fi
ENDED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

node - "$STATE_FILE" "$REQUEST_ID" "$ACTION" "$STATUS" "$ATTEMPTS" "$EXIT_CODE" "$SOURCE_COMMIT" "$STARTED" "$ENDED" "$LOG" <<'NODE'
const fs=require("fs");
const [path,id,action,status,attempts,exitCode,source,started,ended,log]=process.argv.slice(2);
fs.writeFileSync(path,JSON.stringify({
  schema:"izakhono.owner-agent-state/v1",
  request_id:id,action,status,attempts:Number(attempts),exit_code:Number(exitCode),
  source_commit:source,started_at:started,ended_at:ended,log_path:log
},null,2)+"\n");
NODE
chmod 0600 "$STATE_FILE"

exit 0
