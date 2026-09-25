#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="izakhono-one-ai"
SOURCE_DIR="izakhono-one-ai"
HOSTNAME="${IZAKHONO_ONE_AI_HOSTNAME:-one.domains.izakhonoafrica.co.za}"
REVISION="${1:-main}"
SOURCE_ENV="${IZAKHONO_CODE_SOURCE_ENV:-/etc/izakhono/code-source.env}"
REPO_URL="${IZAKHONO_CODE_REPO_URL:-}"
REPO_TOKEN="${IZAKHONO_CODE_REPO_TOKEN:-}"
CACHE_ROOT="${IZAKHONO_SOURCE_CACHE:-/var/lib/izakhono-runtime/source}"
RELEASE_BASE="/var/lib/izakhono-runtime/releases/$APP"
RUNTIME_ENV="/etc/izakhono/runtime-node.env"
APP_ENV="/etc/izakhono/apps/izakhono-one-ai.env"
CONTROL_URL="http://127.0.0.1:8790"
PROXY_URL="http://127.0.0.1:8080"
EDGE_URL="http://127.0.0.1:8780"
REPORT_DIR="/var/lib/izakhono-deploy"
REPORT="$REPORT_DIR/izakhono-one-ai.json"

fail(){ echo "FAIL: $*" >&2; exit 2; }
need(){ command -v "$1" >/dev/null 2>&1 || fail "$1 is required"; }

if [ -z "$REPO_URL" ] && [ -f "$SOURCE_ENV" ]; then
  REPO_URL="$(sudo awk -F= '$1=="IZAKHONO_CODE_REPO_URL"{sub(/^[^=]*=/,"");print;exit}' "$SOURCE_ENV")"
  REPO_TOKEN="$(sudo awk -F= '$1=="IZAKHONO_CODE_REPO_TOKEN"{sub(/^[^=]*=/,"");print;exit}' "$SOURCE_ENV")"
fi

[ -n "$REPO_URL" ] || fail "IZAKHONO CODE source is not configured."
if [[ "$REPO_URL" != http://127.0.0.1:8860/git/* ]] && [ "${ALLOW_EXTERNAL_SOURCE:-0}" != "1" ]; then
  fail "External source refused. IZAKHONO ONE AI must deploy from IZAKHONO CODE."
fi

for cmd in git curl node tar; do need "$cmd"; done
[ -f "$RUNTIME_ENV" ] || fail "IZAKHONO RUNTIME NODE is not installed."
[ -f "$APP_ENV" ] || fail "IZAKHONO ONE AI environment is missing: $APP_ENV"

for key in IZAKHONO_ONE_AI_KEY IZAKHONO_ONE_AI_GATEWAY_KEY IZAKHONO_ONE_AUTH_URL; do
  value="$(sudo awk -F= -v k="$key" '$1==k{sub(/^[^=]*=/,"");print;exit}' "$APP_ENV")"
  [ -n "$value" ] || fail "$key is missing from $APP_ENV"
done

curl -fsS "$CONTROL_URL/health" >/dev/null || fail "IZAKHONO RUNTIME NODE is not healthy."
RUNTIME_KEY="$(sudo awk -F= '$1=="IZAKHONO_RUNTIME_KEY"{sub(/^[^=]*=/,"");print;exit}' "$RUNTIME_ENV")"
[ -n "$RUNTIME_KEY" ] || fail "Runtime key unavailable."

GIT_AUTH=""
if [ -n "$REPO_TOKEN" ]; then
  GIT_AUTH="$(node -e 'process.stdout.write(Buffer.from("git:"+process.argv[1]).toString("base64"))' "$REPO_TOKEN")"
fi
git_source(){
  if [ -n "$GIT_AUTH" ]; then
    sudo env GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=http.extraHeader GIT_CONFIG_VALUE_0="Authorization: Basic $GIT_AUTH" git "$@"
  else
    sudo git "$@"
  fi
}

sudo mkdir -p "$CACHE_ROOT" "$RELEASE_BASE" "$REPORT_DIR"
CACHE="$CACHE_ROOT/Downloads"
if [ ! -d "$CACHE/.git" ]; then
  git_source clone --filter=blob:none "$REPO_URL" "$CACHE"
else
  git_source -C "$CACHE" remote set-url origin "$REPO_URL"
fi

git_source -C "$CACHE" fetch --prune origin "$REVISION"
RESOLVED="$(sudo git -C "$CACHE" rev-parse FETCH_HEAD)"
unset REPO_TOKEN GIT_AUTH
RELEASE="$RELEASE_BASE/$RESOLVED"

if [ ! -d "$RELEASE" ]; then
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  sudo git -C "$CACHE" archive "$RESOLVED" "$SOURCE_DIR" | tar -x -C "$TMP"
  sudo mkdir -p "$RELEASE"
  sudo cp -a "$TMP/$SOURCE_DIR/." "$RELEASE/"
  sudo chown -R izakhono:izakhono "$RELEASE"
fi

test -f "$RELEASE/server.mjs" || fail "server.mjs missing."
node --check "$RELEASE/server.mjs"

BODY="$(node - "$APP" "$HOSTNAME" "$RELEASE" "$APP_ENV" <<'NODE'
const [app,hostname,releasePath,envFile]=process.argv.slice(2);
process.stdout.write(JSON.stringify({
  app,
  hostname,
  releasePath,
  command:["node","server.mjs"],
  envFile,
  healthPath:"/health"
}));
NODE
)"

RESPONSE="$(curl -fsS -X POST "$CONTROL_URL/v1/deployments"   -H "content-type: application/json"   -H "x-izakhono-key: $RUNTIME_KEY"   --data-binary "$BODY")"
DEPLOYMENT_ID="$(node -e 'const x=JSON.parse(process.argv[1]);if(!x.id)process.exit(2);process.stdout.write(x.id)' "$RESPONSE")"

HEALTH="$(curl -fsS -H "Host: $HOSTNAME" "$PROXY_URL/health")"
node -e 'const x=JSON.parse(process.argv[1]);if(x.status!=="healthy"||x.product!=="IZAKHONO ONE AI")process.exit(2)' "$HEALTH"
CHAT_READY="$(node -e 'const x=JSON.parse(process.argv[1]);process.stdout.write(String(x.chatReady===true))' "$HEALTH")"
PUBLIC_SIGNUP="$(node -e 'const x=JSON.parse(process.argv[1]);process.stdout.write(String(x.publicSignup===true))' "$HEALTH")"
ACCOUNT_REACHABLE="$(node -e 'const x=JSON.parse(process.argv[1]);process.stdout.write(String(x.accountReachable===true))' "$HEALTH")"

# Stage the owned public edge after the local runtime is proven healthy. This is
# intentionally fail-soft for the two known owner-infrastructure states:
# 20 = parent DNS/router action required, 21 = TLS/ports action required.
# The external resilience route is never modified here.
OWNED_EDGE_ACTIVATION="NOT_ATTEMPTED"
OWNED_EDGE_EXIT=0
if [ -x "$ROOT/izakhono-owned-cloud/activate-owned-public-edge.sh" ]; then
  set +e
  IZAKHONO_PUBLIC_HOSTNAME="$HOSTNAME" \
  IZAKHONO_PUBLIC_ZONE="domains.izakhonoafrica.co.za" \
  IZAKHONO_PUBLIC_EXTRA_HOSTS="$HOSTNAME" \
    bash "$ROOT/izakhono-owned-cloud/activate-owned-public-edge.sh"
  OWNED_EDGE_EXIT=$?
  set -e
  case "$OWNED_EDGE_EXIT" in
    0) OWNED_EDGE_ACTIVATION="LOCAL_EDGE_PROVED" ;;
    20) OWNED_EDGE_ACTIVATION="PARENT_DNS_OR_ROUTER_REQUIRED" ;;
    21) OWNED_EDGE_ACTIVATION="TLS_OR_PORTS_REQUIRED" ;;
    *) fail "Owned public-edge activation failed unexpectedly with exit code $OWNED_EDGE_EXIT" ;;
  esac
fi

BRIDGE_STATE="NOT_NEEDED"
BRIDGE_URL=""
BRIDGE_EXIT=0
if [ "${OWNED_EDGE_EXIT:-0}" != "0" ] && [ -x "$ROOT/izakhono-owned-cloud/activate-tailscale-funnel.sh" ]; then
  set +e
  IZAKHONO_BRIDGE_APP="$APP" \
  IZAKHONO_BRIDGE_HEALTH_PATH="/health" \
  IZAKHONO_BRIDGE_EXPECTED_SERVICE="" \
  IZAKHONO_BRIDGE_EXPECTED_PRODUCT="IZAKHONO ONE AI" \
  IZAKHONO_BRIDGE_EXPECTED_STATUS="healthy" \
    bash "$ROOT/izakhono-owned-cloud/activate-tailscale-funnel.sh"
  BRIDGE_EXIT=$?
  set -e
  BRIDGE_REPORT="$REPORT_DIR/tailscale-funnel-${APP}.json"
  if [ -f "$BRIDGE_REPORT" ]; then
    BRIDGE_STATE="$(node -e 'const x=require(process.argv[1]);process.stdout.write(String(x.state||"UNKNOWN"))' "$BRIDGE_REPORT" 2>/dev/null || echo UNKNOWN)"
    BRIDGE_URL="$(node -e 'const x=require(process.argv[1]);process.stdout.write(String(x.public_url||""))' "$BRIDGE_REPORT" 2>/dev/null || true)"
  else
    BRIDGE_STATE="NO_RECEIPT_EXIT_${BRIDGE_EXIT}"
  fi
fi

EDGE="NOT_RUNNING"
if systemctl is-active --quiet izakhono-edge-node 2>/dev/null; then
  if curl -fsS -H "Host: $HOSTNAME" "$EDGE_URL/health" >/tmp/izakhono-one-ai-edge-health.json 2>/dev/null; then
    EDGE="VERIFIED"
  else
    EDGE="RUNNING_NOT_VERIFIED"
  fi
fi

PUBLIC_HTTPS="NOT_VERIFIED"
if curl -fsS --max-time 8 "https://$HOSTNAME/health" >/tmp/izakhono-one-ai-public-health.json 2>/dev/null; then
  if node -e 'const x=require("/tmp/izakhono-one-ai-public-health.json");if(x.status!=="healthy"||x.product!=="IZAKHONO ONE AI")process.exit(2)' 2>/dev/null; then
    PUBLIC_HTTPS="VERIFIED"
  fi
fi

TMP_REPORT="$(mktemp)"
node - "$TMP_REPORT" "$HOSTNAME" "$RESOLVED" "$DEPLOYMENT_ID" "$EDGE" "$PUBLIC_HTTPS" "$CHAT_READY" "$PUBLIC_SIGNUP" "$ACCOUNT_REACHABLE" "$OWNED_EDGE_ACTIVATION" "$OWNED_EDGE_EXIT" "$BRIDGE_STATE" "$BRIDGE_URL" "$BRIDGE_EXIT" <<'NODE'
const fs=require("fs");
const [path,hostname,revision,deploymentId,edge,publicHttps,chatReady,publicSignup,accountReachable,ownedEdgeActivation,ownedEdgeExit,bridgeState,bridgeUrl,bridgeExit]=process.argv.slice(2);
fs.writeFileSync(path,JSON.stringify({
  schema:"izakhono.one-ai-deployment/v1",
  app:"izakhono-one-ai",
  product:"IZAKHONO ONE AI",
  hostname,
  revision,
  deployment_id:deploymentId,
  source:"IZAKHONO_CODE",
  runtime:"IZAKHONO_RUNTIME",
  edge,
  owned_edge_activation:ownedEdgeActivation,
  owned_edge_exit:Number(ownedEdgeExit),
  fallback_bridge:{
    provider:"tailscale-funnel",
    state:bridgeState,
    public_url:bridgeUrl||null,
    exit:Number(bridgeExit),
    engine_authority:"NODE 01",
    replaceable_adapter:true
  },
  public_https:publicHttps,
  gpu_compute:"private-behind-gateway",
  external_overflow:"reversible",
  account_reachable:accountReachable==="true",
  public_signup:publicSignup==="true",
  chat_ready:chatReady==="true",
  sellable_status:publicHttps==="VERIFIED"&&chatReady==="true"&&publicSignup==="true"
    ?"sellable-gate-ready-for-final-commercial-review"
    :"not-yet-sellable",
  generated_at:new Date().toISOString()
},null,2)+"\n");
NODE
sudo install -o root -g izakhono -m 0640 "$TMP_REPORT" "$REPORT"
rm -f "$TMP_REPORT"

cat <<EOF
IZAKHONO ONE AI OWNED DEPLOYMENT
APP=$APP
HOSTNAME=$HOSTNAME
REVISION=$RESOLVED
DEPLOYMENT_ID=$DEPLOYMENT_ID
SOURCE=IZAKHONO_CODE
RUNTIME_HEALTH=VERIFIED
EDGE=$EDGE
OWNED_EDGE_ACTIVATION=$OWNED_EDGE_ACTIVATION
OWNED_EDGE_EXIT=$OWNED_EDGE_EXIT
FALLBACK_BRIDGE_STATE=$BRIDGE_STATE
FALLBACK_BRIDGE_URL=$BRIDGE_URL
FALLBACK_BRIDGE_EXIT=$BRIDGE_EXIT
PUBLIC_HTTPS=$PUBLIC_HTTPS
ACCOUNT_REACHABLE=$ACCOUNT_REACHABLE
PUBLIC_SIGNUP=$PUBLIC_SIGNUP
CHAT_READY=$CHAT_READY
RECEIPT=$REPORT
EOF
