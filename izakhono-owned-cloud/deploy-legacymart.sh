#!/usr/bin/env bash
set -euo pipefail

APP="legacymart"
HOSTNAME="${LEGACYMART_HOSTNAME:-market.domains.izakhonoafrica.co.za}"
REVISION="${1:-main}"
SOURCE_ENV="${LEGACYMART_CODE_SOURCE_ENV:-/etc/izakhono/legacymart-code.env}"
CACHE_ROOT="${IZAKHONO_SOURCE_CACHE:-/var/lib/izakhono-runtime/source}"
RELEASE_BASE="/var/lib/izakhono-runtime/releases/$APP"
RUNTIME_ENV="/etc/izakhono/runtime-node.env"
APP_ENV="/etc/izakhono/legacymart.env"
CONTROL_URL="http://127.0.0.1:8790"
PROXY_URL="http://127.0.0.1:8080"
EDGE_URL="http://127.0.0.1:8780"
REPORT_DIR="/var/lib/izakhono-deploy"
REPORT="$REPORT_DIR/legacymart.json"

fail(){ echo "FAIL: $*" >&2; exit 2; }
need(){ command -v "$1" >/dev/null 2>&1 || fail "$1 is required"; }

for cmd in git curl node tar; do need "$cmd"; done
[ -f "$SOURCE_ENV" ] || fail "LegacyMart IZAKHONO CODE source is not configured"
[ -f "$RUNTIME_ENV" ] || fail "IZAKHONO RUNTIME NODE is not installed"
curl -fsS "$CONTROL_URL/health" >/dev/null || fail "IZAKHONO RUNTIME NODE is not healthy"

REPO_URL="$(awk -F= '$1=="IZAKHONO_CODE_REPO_URL"{sub(/^[^=]*=/,"");print;exit}' "$SOURCE_ENV")"
REPO_TOKEN="$(awk -F= '$1=="IZAKHONO_CODE_REPO_TOKEN"{sub(/^[^=]*=/,"");print;exit}' "$SOURCE_ENV")"
[[ "$REPO_URL" == http://127.0.0.1:8860/git/* ]] || fail "LegacyMart must deploy from IZAKHONO CODE"
[ -n "$REPO_TOKEN" ] || fail "LegacyMart deployment token unavailable"

RUNTIME_KEY="$(awk -F= '$1=="IZAKHONO_RUNTIME_KEY"{sub(/^[^=]*=/,"");print;exit}' "$RUNTIME_ENV")"
[ -n "$RUNTIME_KEY" ] || fail "Runtime key unavailable"

GIT_AUTH="$(node -e 'process.stdout.write(Buffer.from("git:"+process.argv[1]).toString("base64"))' "$REPO_TOKEN")"
git_source(){ sudo env GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=http.extraHeader GIT_CONFIG_VALUE_0="Authorization: Basic $GIT_AUTH" git "$@"; }

sudo mkdir -p "$CACHE_ROOT" "$RELEASE_BASE" "$REPORT_DIR"
CACHE="$CACHE_ROOT/legacymart"
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
  sudo git -C "$CACHE" archive "$RESOLVED" | tar -x -C "$TMP"
  sudo mkdir -p "$RELEASE"
  sudo cp -a "$TMP/." "$RELEASE/"
  sudo chown -R izakhono:izakhono "$RELEASE"
fi

test -f "$RELEASE/server.js" || fail "LegacyMart server.js missing"
test -f "$RELEASE/package.json" || fail "LegacyMart package.json missing"
node --check "$RELEASE/server.js"
node --check "$RELEASE/marketplace-pay.js"

ENV_FILE=""
if [ -f "$APP_ENV" ]; then ENV_FILE="$APP_ENV"; fi

BODY="$(node - "$APP" "$HOSTNAME" "$RELEASE" "$ENV_FILE" <<'NODE'
const [app,hostname,releasePath,envFile]=process.argv.slice(2);
process.stdout.write(JSON.stringify({
  app,hostname,releasePath,
  command:["node","server.js"],
  envFile:envFile||null,
  healthPath:"/health"
}));
NODE
)"

RESPONSE="$(curl -fsS -X POST "$CONTROL_URL/v1/deployments"   -H "content-type: application/json" -H "x-izakhono-key: $RUNTIME_KEY" --data-binary "$BODY")"
DEPLOYMENT_ID="$(node -e 'const x=JSON.parse(process.argv[1]);if(!x.id)process.exit(2);process.stdout.write(x.id)' "$RESPONSE")"

HEALTH="$(curl -fsS -H "Host: $HOSTNAME" "$PROXY_URL/health")"
node -e 'const x=JSON.parse(process.argv[1]);if(x.ok!==true||x.service!=="LegacyMart")process.exit(2)' "$HEALTH"
curl -fsS -H "Host: $HOSTNAME" "$PROXY_URL/shop?seller=bevan-shelton" | grep -Fq "BEVAN SHELTON"

EDGE="NOT_RUNNING"
if systemctl is-active --quiet izakhono-edge-node 2>/dev/null; then
  if curl -fsS -H "Host: $HOSTNAME" "$EDGE_URL/health" >/tmp/legacymart-edge-health.json 2>/dev/null; then
    EDGE="VERIFIED"
  else
    EDGE="RUNNING_NOT_VERIFIED"
  fi
fi

PUBLIC_HTTPS="NOT_VERIFIED"
if curl -fsS --max-time 8 "https://$HOSTNAME/health" >/tmp/legacymart-public-health.json 2>/dev/null; then
  if node -e 'const x=require("/tmp/legacymart-public-health.json");if(x.ok!==true||x.service!=="LegacyMart")process.exit(2)' 2>/dev/null; then
    PUBLIC_HTTPS="VERIFIED"
  fi
fi

TMP_REPORT="$(mktemp)"
node - "$TMP_REPORT" "$HOSTNAME" "$RESOLVED" "$DEPLOYMENT_ID" "$EDGE" "$PUBLIC_HTTPS" <<'NODE'
const fs=require("fs");
const [path,hostname,revision,deploymentId,edge,publicHttps]=process.argv.slice(2);
fs.writeFileSync(path,JSON.stringify({
  schema:"izakhono.legacymart-deployment/v1",
  app:"legacymart",
  product:"LegacyMart Makers",
  reference_shop:"BEVAN SHELTON™",
  hostname,revision,
  deployment_id:deploymentId,
  source:"IZAKHONO_CODE",
  runtime:"IZAKHONO_RUNTIME",
  edge,
  public_https:publicHttps,
  external_fallback_preserved:true,
  payment_activation:"environment-gated",
  generated_at:new Date().toISOString()
},null,2)+"\n");
NODE
sudo install -o root -g izakhono -m 0640 "$TMP_REPORT" "$REPORT"
rm -f "$TMP_REPORT"

cat <<EOF
LEGACYMART MAKERS OWNED DEPLOYMENT
APP=$APP
HOSTNAME=$HOSTNAME
REVISION=$RESOLVED
DEPLOYMENT_ID=$DEPLOYMENT_ID
SOURCE=IZAKHONO_CODE
RUNTIME_HEALTH=VERIFIED
EDGE=$EDGE
PUBLIC_HTTPS=$PUBLIC_HTTPS
REFERENCE_SHOP=BEVAN_SHELTON
PAYMENT_ACTIVATION=ENVIRONMENT_GATED
RECEIPT=$REPORT
EXTERNAL_FALLBACK=PRESERVED
EOF
