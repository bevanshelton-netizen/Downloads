#!/usr/bin/env bash
set -euo pipefail

APP="izakhono-revenue-desk"
SOURCE_DIR="kora-network/public/izakhono-revenue"
HOSTNAME="${IZAKHONO_REVENUE_HOSTNAME:-revenue.domains.izakhonoafrica.co.za}"
REVISION="${1:-main}"
SOURCE_ENV="${IZAKHONO_CODE_SOURCE_ENV:-/etc/izakhono/code-source.env}"
REPO_URL="${IZAKHONO_CODE_REPO_URL:-}"
REPO_TOKEN="${IZAKHONO_CODE_REPO_TOKEN:-}"
CACHE_ROOT="${IZAKHONO_SOURCE_CACHE:-/var/lib/izakhono-runtime/source}"
RELEASE_BASE="/var/lib/izakhono-runtime/releases/$APP"
RUNTIME_ENV="/etc/izakhono/runtime-node.env"
CONTROL_URL="http://127.0.0.1:8790"
PROXY_URL="http://127.0.0.1:8080"
EDGE_URL="http://127.0.0.1:8780"
REPORT_DIR="/var/lib/izakhono-deploy"
REPORT="$REPORT_DIR/revenue-desk.json"

fail(){ echo "FAIL: $*" >&2; exit 2; }
need(){ command -v "$1" >/dev/null 2>&1 || fail "$1 is required"; }

if [ -z "$REPO_URL" ] && [ -f "$SOURCE_ENV" ]; then
  REPO_URL="$(sudo awk -F= '$1=="IZAKHONO_CODE_REPO_URL"{sub(/^[^=]*=/,"");print;exit}' "$SOURCE_ENV")"
  REPO_TOKEN="$(sudo awk -F= '$1=="IZAKHONO_CODE_REPO_TOKEN"{sub(/^[^=]*=/,"");print;exit}' "$SOURCE_ENV")"
fi
[ -n "$REPO_URL" ] || fail "IZAKHONO CODE source is not configured. Run migrate-source-to-code.sh first."
if [[ "$REPO_URL" != http://127.0.0.1:8860/git/* ]] && [ "${ALLOW_EXTERNAL_SOURCE:-0}" != "1" ]; then
  fail "External source refused. Revenue Desk must deploy from IZAKHONO CODE."
fi

for cmd in git curl node tar; do need "$cmd"; done
[ -f "$RUNTIME_ENV" ] || fail "IZAKHONO RUNTIME NODE is not installed."
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
if [ ! -d "$CACHE/.git" ]; then git_source clone --filter=blob:none "$REPO_URL" "$CACHE"; else git_source -C "$CACHE" remote set-url origin "$REPO_URL"; fi
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
test -f "$RELEASE/index.html" || fail "Revenue Desk index.html missing."
test -f "$RELEASE/server.mjs" || fail "Revenue Desk server.mjs missing."
node --check "$RELEASE/server.mjs"

BODY="$(node - "$APP" "$HOSTNAME" "$RELEASE" <<'NODE'
const [app,hostname,releasePath]=process.argv.slice(2);
process.stdout.write(JSON.stringify({app,hostname,releasePath,command:["node","server.mjs"],envFile:null,healthPath:"/health"}));
NODE
)"
RESPONSE="$(curl -fsS -X POST "$CONTROL_URL/v1/deployments" -H "content-type: application/json" -H "x-izakhono-key: $RUNTIME_KEY" --data-binary "$BODY")"
DEPLOYMENT_ID="$(node -e 'const x=JSON.parse(process.argv[1]);if(!x.id)process.exit(2);process.stdout.write(x.id)' "$RESPONSE")"

HEALTH="$(curl -fsS -H "Host: $HOSTNAME" "$PROXY_URL/health")"
node -e 'const x=JSON.parse(process.argv[1]);if(x.ok!==true||x.service!=="izakhono-revenue-desk"||x.runtime!=="izakhono-owned")process.exit(2)' "$HEALTH"
curl -fsS -H "Host: $HOSTNAME" "$PROXY_URL/" | grep -q "IZAKHONO Business Growth Desk"

EDGE="NOT_RUNNING"
if systemctl is-active --quiet izakhono-edge-node 2>/dev/null; then
  if curl -fsS -H "Host: $HOSTNAME" "$EDGE_URL/health" >/tmp/izakhono-revenue-edge-health.json 2>/dev/null; then EDGE="VERIFIED"; else EDGE="RUNNING_NOT_VERIFIED"; fi
fi
PUBLIC_HTTPS="NOT_VERIFIED"
if curl -fsS --max-time 8 "https://$HOSTNAME/health" >/tmp/izakhono-revenue-public-health.json 2>/dev/null; then
  if node -e 'const x=require("/tmp/izakhono-revenue-public-health.json");if(x.ok!==true||x.service!=="izakhono-revenue-desk")process.exit(2)' 2>/dev/null; then PUBLIC_HTTPS="VERIFIED"; fi
fi

TMP_REPORT="$(mktemp)"
node - "$TMP_REPORT" "$HOSTNAME" "$RESOLVED" "$DEPLOYMENT_ID" "$EDGE" "$PUBLIC_HTTPS" <<'NODE'
const fs=require('fs'); const [path,hostname,revision,deploymentId,edge,publicHttps]=process.argv.slice(2);
fs.writeFileSync(path,JSON.stringify({schema:'izakhono.revenue-desk-deployment/v1',app:'izakhono-revenue-desk',product:'IZAKHONO Business Growth Desk',hostname,revision,deployment_id:deploymentId,source:'IZAKHONO_CODE',runtime:'IZAKHONO_RUNTIME',edge,public_https:publicHttps,lead_capture:'Supabase external resilience buffer',payment_processing:false,external_fallback:'https://izakhono-revenue-desk.vercel.app/',generated_at:new Date().toISOString()},null,2)+'\n');
NODE
sudo install -o root -g izakhono -m 0640 "$TMP_REPORT" "$REPORT"
rm -f "$TMP_REPORT"

cat <<EOF
IZAKHONO REVENUE DESK OWNED DEPLOYMENT
HOSTNAME=$HOSTNAME
REVISION=$RESOLVED
RUNTIME_HEALTH=VERIFIED
EDGE=$EDGE
PUBLIC_HTTPS=$PUBLIC_HTTPS
LEAD_CAPTURE=EXISTING_SUPABASE_BUFFER
PAYMENT_PROCESSING=DISABLED
RECEIPT=$REPORT
EOF
