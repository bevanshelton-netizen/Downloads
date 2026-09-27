#!/usr/bin/env bash
set -euo pipefail
APP="doxa-sure"
SOURCE_DIR="doxa-sure"
HOSTNAME="${DOXA_SURE_HOSTNAME:-doxa.domains.izakhonoafrica.co.za}"
REVISION="${1:-main}"
SOURCE_ENV="${IZAKHONO_CODE_SOURCE_ENV:-/etc/izakhono/code-source.env}"
REPO_URL="${IZAKHONO_CODE_REPO_URL:-}"
REPO_TOKEN="${IZAKHONO_CODE_REPO_TOKEN:-}"
CACHE_ROOT="${IZAKHONO_SOURCE_CACHE:-/var/lib/izakhono-runtime/source}"
RELEASE_BASE="/var/lib/izakhono-runtime/releases/$APP"
RUNTIME_ENV="/etc/izakhono/runtime-node.env"
APP_ENV="/etc/izakhono/apps/doxa-sure.env"
CONTROL_URL="http://127.0.0.1:8790"
PROXY_URL="http://127.0.0.1:8080"
fail(){ echo "FAIL: $*" >&2; exit 2; }
need(){ command -v "$1" >/dev/null 2>&1 || fail "$1 is required"; }
if [ -z "$REPO_URL" ] && [ -f "$SOURCE_ENV" ]; then
  REPO_URL="$(sudo awk -F= '$1=="IZAKHONO_CODE_REPO_URL"{sub(/^[^=]*=/,"");print;exit}' "$SOURCE_ENV")"
  REPO_TOKEN="$(sudo awk -F= '$1=="IZAKHONO_CODE_REPO_TOKEN"{sub(/^[^=]*=/,"");print;exit}' "$SOURCE_ENV")"
fi
[ -n "$REPO_URL" ] || fail "IZAKHONO CODE source is not configured."
if [[ "$REPO_URL" != http://127.0.0.1:8860/git/* ]] && [ "${ALLOW_EXTERNAL_SOURCE:-0}" != "1" ]; then fail "External source refused."; fi
for cmd in git curl node python3 tar; do need "$cmd"; done
[ -f "$RUNTIME_ENV" ] || fail "IZAKHONO RUNTIME NODE is not installed."
curl -fsS "$CONTROL_URL/health" >/dev/null || fail "IZAKHONO RUNTIME NODE is not healthy."
RUNTIME_KEY="$(sudo awk -F= '$1=="IZAKHONO_RUNTIME_KEY"{sub(/^[^=]*=/,"");print;exit}' "$RUNTIME_ENV")"
[ -n "$RUNTIME_KEY" ] || fail "Runtime key unavailable."
GIT_AUTH=""
if [ -n "$REPO_TOKEN" ]; then GIT_AUTH="$(node -e 'process.stdout.write(Buffer.from("git:"+process.argv[1]).toString("base64"))' "$REPO_TOKEN")"; fi
git_source(){ if [ -n "$GIT_AUTH" ]; then sudo env GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=http.extraHeader GIT_CONFIG_VALUE_0="Authorization: Basic $GIT_AUTH" git "$@"; else sudo git "$@"; fi; }
sudo mkdir -p "$CACHE_ROOT" "$RELEASE_BASE"
CACHE="$CACHE_ROOT/Downloads"
if [ ! -d "$CACHE/.git" ]; then git_source clone --filter=blob:none "$REPO_URL" "$CACHE"; else git_source -C "$CACHE" remote set-url origin "$REPO_URL"; fi
git_source -C "$CACHE" fetch --prune origin "$REVISION"
RESOLVED="$(sudo git -C "$CACHE" rev-parse FETCH_HEAD)"
unset REPO_TOKEN GIT_AUTH
RELEASE="$RELEASE_BASE/$RESOLVED"
if [ ! -d "$RELEASE" ]; then
  TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
  sudo git -C "$CACHE" archive "$RESOLVED" "$SOURCE_DIR" | tar -x -C "$TMP"
  sudo mkdir -p "$RELEASE"; sudo cp -a "$TMP/$SOURCE_DIR/." "$RELEASE/"; sudo chown -R izakhono:izakhono "$RELEASE"
fi
python3 -m py_compile "$RELEASE/owner_service.py"
ENV_JSON="null"
if [ -f "$APP_ENV" ]; then ENV_JSON="$(node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$APP_ENV")"; fi
BODY="$(node - "$APP" "$HOSTNAME" "$RELEASE" "$ENV_JSON" <<'NODE'
const [app,hostname,releasePath,envRaw]=process.argv.slice(2);
const envFile=envRaw==="null"?null:JSON.parse(envRaw);
process.stdout.write(JSON.stringify({app,hostname,releasePath,command:["python3","owner_service.py"],envFile,healthPath:"/api/health"}));
NODE
)"
RESPONSE="$(curl -fsS -X POST "$CONTROL_URL/v1/deployments" -H "content-type: application/json" -H "x-izakhono-key: $RUNTIME_KEY" --data-binary "$BODY")"
DEPLOYMENT_ID="$(node -e 'const x=JSON.parse(process.argv[1]);if(!x.id)process.exit(2);process.stdout.write(x.id)' "$RESPONSE")"
HEALTH="$(curl -fsS -H "Host: $HOSTNAME" "$PROXY_URL/api/health")"
node -e 'const x=JSON.parse(process.argv[1]);if(x.ok!==true||x.service!=="doxa-sure")process.exit(2)' "$HEALTH"
curl -fsS -H "Host: $HOSTNAME" "$PROXY_URL/" | grep -q "Protect what you worked for"
cat <<EOF
DOXA-SURE OWNED DEPLOYMENT
APP=$APP
HOSTNAME=$HOSTNAME
REVISION=$RESOLVED
DEPLOYMENT_ID=$DEPLOYMENT_ID
RUNTIME_HEALTH=VERIFIED
PAYMENTS=FAIL_CLOSED_UNLESS_EXPLICITLY_ENABLED
PUBLIC_HTTPS=NOT_IMPLIED
EOF
