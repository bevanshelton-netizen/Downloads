#!/usr/bin/env bash
set -euo pipefail

APP="auto-ai"
HOSTNAME="${AUTO_AI_HOSTNAME:-autoai.izakhonoafrica.co.za}"
SOURCE_ENV="${IZAKHONO_CODE_SOURCE_ENV:-/etc/izakhono/code-source.env}"
REPO_URL="${IZAKHONO_CODE_REPO_URL:-}"
REPO_TOKEN="${IZAKHONO_CODE_REPO_TOKEN:-}"

if [ -z "$REPO_URL" ] && [ -f "$SOURCE_ENV" ]; then
  REPO_URL="$(sudo awk -F= '$1=="IZAKHONO_CODE_REPO_URL"{sub(/^[^=]*=/,"");print;exit}' "$SOURCE_ENV")"
  REPO_TOKEN="$(sudo awk -F= '$1=="IZAKHONO_CODE_REPO_TOKEN"{sub(/^[^=]*=/,"");print;exit}' "$SOURCE_ENV")"
fi

if [ -z "$REPO_URL" ]; then
  fail "Owned CODE source is not configured. Run migrate-source-to-code.sh first."
fi

if [[ "$REPO_URL" != http://127.0.0.1:8860/git/* ]] && [ "${ALLOW_EXTERNAL_SOURCE:-0}" != "1" ]; then
  fail "External source URL refused. Set ALLOW_EXTERNAL_SOURCE=1 only for an intentional bootstrap exception."
fi
REVISION="${1:-main}"
CACHE_ROOT="${IZAKHONO_SOURCE_CACHE:-/var/lib/izakhono-runtime/source}"
RELEASE_BASE="/var/lib/izakhono-runtime/releases/$APP"
RUNTIME_ENV="/etc/izakhono/runtime-node.env"
APP_ENV="/etc/izakhono/apps/auto-ai.env"
CONTROL_URL="http://127.0.0.1:8790"
PROXY_URL="http://127.0.0.1:8080"

fail(){ echo "FAIL: $*" >&2; exit 2; }
need(){ command -v "$1" >/dev/null 2>&1 || fail "$1 is required"; }

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

for cmd in git curl node; do need "$cmd"; done
[ -f "$RUNTIME_ENV" ] || fail "IZAKHONO RUNTIME NODE environment not found: $RUNTIME_ENV"

curl -fsS "$CONTROL_URL/health" >/dev/null || fail "IZAKHONO RUNTIME NODE is not healthy."

RUNTIME_KEY="$(sudo awk -F= '$1=="IZAKHONO_RUNTIME_KEY"{sub(/^[^=]*=/,""); print; exit}' "$RUNTIME_ENV")"
[ -n "$RUNTIME_KEY" ] || fail "IZAKHONO_RUNTIME_KEY is unavailable."

sudo mkdir -p "$CACHE_ROOT" "$RELEASE_BASE"
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
  sudo git -C "$CACHE" archive "$RESOLVED" auto-ai | tar -x -C "$TMP"
  sudo mkdir -p "$RELEASE"
  sudo cp -a "$TMP/auto-ai/." "$RELEASE/"
  sudo chown -R izakhono:izakhono "$RELEASE"
fi

test -f "$RELEASE/server.mjs" || fail "server.mjs missing from release."
test -f "$RELEASE/public/index.html" || fail "public/index.html missing from release."

ENV_JSON="null"
if [ -f "$APP_ENV" ]; then
  ENV_JSON="$(node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$APP_ENV")"
fi

BODY="$(node - "$APP" "$HOSTNAME" "$RELEASE" "$ENV_JSON" <<'NODE'
const [app,hostname,releasePath,envRaw]=process.argv.slice(2);
const envFile=envRaw==="null"?null:JSON.parse(envRaw);
process.stdout.write(JSON.stringify({
  app,
  hostname,
  releasePath,
  command:["node","server.mjs"],
  envFile,
  healthPath:"/api/health"
}));
NODE
)"

RESPONSE="$(curl -fsS -X POST "$CONTROL_URL/v1/deployments"   -H "content-type: application/json"   -H "x-izakhono-key: $RUNTIME_KEY"   --data-binary "$BODY")"

DEPLOYMENT_ID="$(node -e 'const x=JSON.parse(process.argv[1]); if(!x.id)process.exit(2); process.stdout.write(x.id)' "$RESPONSE")"

HEALTH="$(curl -fsS -H "Host: $HOSTNAME" "$PROXY_URL/api/health")"
node -e 'const x=JSON.parse(process.argv[1]); if(x.ok!==true||x.service!=="auto-ai")process.exit(2)' "$HEALTH"

EDGE="PENDING"
if systemctl is-active --quiet izakhono-edge-node 2>/dev/null; then
  if curl -fsS --resolve "$HOSTNAME:443:127.0.0.1" "https://$HOSTNAME/api/health" >/tmp/auto-ai-edge-health.json 2>/dev/null; then
    node -e 'const x=require("/tmp/auto-ai-edge-health.json"); if(x.ok!==true||x.service!=="auto-ai")process.exit(2)'
    EDGE="VERIFIED"
  else
    EDGE="RUNNING_NOT_PUBLICLY_VERIFIED"
  fi
fi

cat <<EOF
AUTO AI IZAKHONO OWNED CLOUD DEPLOYMENT
APP=$APP
HOSTNAME=$HOSTNAME
REVISION=$RESOLVED
DEPLOYMENT_ID=$DEPLOYMENT_ID
RUNTIME_HEALTH=VERIFIED
EDGE=$EDGE
PUBLIC_DNS_CHANGE=NOT_PERFORMED
VERCEL_REQUIRED=NO
EOF
