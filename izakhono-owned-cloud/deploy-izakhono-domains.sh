#!/usr/bin/env bash
set -euo pipefail

APP="izakhono-domains"
HOSTNAME="${IZAKHONO_DOMAINS_HOSTNAME:-domains.izakhonoafrica.co.za}"
REVISION="${1:-main}"
CODE_URL="http://127.0.0.1:8860"
REPO_SLUG="izakhono-builder"
GIT_URL="$CODE_URL/git/$REPO_SLUG.git"
SOURCE_ENV="/etc/izakhono/izakhono-domains-source.env"
BOOTSTRAP_SOURCE="${IZAKHONO_DOMAINS_BOOTSTRAP_SOURCE:-https://github.com/bevanshelton-netizen/izakhono-builder.git}"
CACHE_ROOT="${IZAKHONO_SOURCE_CACHE:-/var/lib/izakhono-runtime/source}"
CACHE="$CACHE_ROOT/$REPO_SLUG"
RELEASE_BASE="/var/lib/izakhono-runtime/releases/$APP"
RUNTIME_ENV="/etc/izakhono/runtime-node.env"
APP_ENV="/etc/izakhono/apps/izakhono-domains.env"
CONTROL_URL="http://127.0.0.1:8790"
PROXY_URL="http://127.0.0.1:8080"
EDGE_URL="http://127.0.0.1:8780"

fail(){ echo "FAIL: $*" >&2; exit 2; }
need(){ command -v "$1" >/dev/null 2>&1 || fail "$1 is required"; }
for cmd in git curl node tar; do need "$cmd"; done

[ -f "$RUNTIME_ENV" ] || fail "IZAKHONO RUNTIME NODE environment not found: $RUNTIME_ENV"
curl -fsS "$CONTROL_URL/health" >/dev/null || fail "IZAKHONO RUNTIME NODE is not healthy."
curl -fsS "$CODE_URL/health" >/dev/null || fail "IZAKHONO CODE NODE is not healthy."

ensure_owned_source(){
  [ -f "$SOURCE_ENV" ] && return 0
  local code_env="/etc/izakhono/code-node.env"
  [ -f "$code_env" ] || fail "IZAKHONO CODE NODE environment not found: $code_env"
  local admin_key tmp write_id write_token read_token basic_write basic_read create_status
  admin_key="$(sudo awk -F= '$1=="IZAKHONO_CODE_ADMIN_KEY"{sub(/^[^=]*=/,"");print;exit}' "$code_env")"
  [ -n "$admin_key" ] || fail "IZAKHONO CODE admin key is unavailable."
  tmp="$(mktemp -d)"
  write_id=""
  cleanup_bootstrap(){
    if [ -n "$write_id" ]; then
      curl -fsS -X POST -H "content-type: application/json" -H "x-izakhono-key: $admin_key" --data '{}' \
        "$CODE_URL/v1/repos/$REPO_SLUG/tokens/$write_id/revoke" >/dev/null 2>&1 || true
    fi
    unset admin_key write_token read_token basic_write basic_read
    rm -rf "$tmp"
  }
  trap cleanup_bootstrap RETURN

  create_status="$(curl -sS -o "$tmp/create.json" -w '%{http_code}' -X POST \
    -H "content-type: application/json" -H "x-izakhono-key: $admin_key" \
    --data-binary "$(node -e 'process.stdout.write(JSON.stringify({slug:process.argv[1],description:"IZAKHONO DOMAINS owned source",publicRead:false}))' "$REPO_SLUG")" \
    "$CODE_URL/v1/repos")"
  [ "$create_status" = "201" ] || [ "$create_status" = "409" ] || fail "IZAKHONO CODE repository creation failed with HTTP $create_status."

  issue_token(){
    local scope="$1" label="$2" output="$3" status
    status="$(curl -sS -o "$output" -w '%{http_code}' -X POST \
      -H "content-type: application/json" -H "x-izakhono-key: $admin_key" \
      --data-binary "$(node -e 'process.stdout.write(JSON.stringify({scope:process.argv[1],label:process.argv[2]}))' "$scope" "$label")" \
      "$CODE_URL/v1/repos/$REPO_SLUG/tokens")"
    [ "$status" = "201" ] || fail "IZAKHONO CODE token issue failed for $scope with HTTP $status."
  }

  issue_token write domains-bootstrap-writer "$tmp/write.json"
  write_token="$(node -e 'const x=require(process.argv[1]);if(!x.value||!x.token?.id)process.exit(2);process.stdout.write(x.value)' "$tmp/write.json")"
  write_id="$(node -e 'const x=require(process.argv[1]);process.stdout.write(x.token.id)' "$tmp/write.json")"
  basic_write="$(node -e 'process.stdout.write(Buffer.from("git:"+process.argv[1]).toString("base64"))' "$write_token")"

  echo "Bootstrapping IZAKHONO DOMAINS source into IZAKHONO CODE..."
  git clone --mirror "$BOOTSTRAP_SOURCE" "$tmp/source.git" >/dev/null 2>&1
  git -C "$tmp/source.git" -c "http.extraHeader=Authorization: Basic $basic_write" push --mirror "$GIT_URL" >/dev/null 2>&1
  curl -fsS -X POST -H "content-type: application/json" -H "x-izakhono-key: $admin_key" --data '{}' \
    "$CODE_URL/v1/repos/$REPO_SLUG/tokens/$write_id/revoke" >/dev/null
  write_id=""
  unset write_token basic_write

  issue_token read domains-deployment-reader "$tmp/read.json"
  read_token="$(node -e 'const x=require(process.argv[1]);if(!x.value)process.exit(2);process.stdout.write(x.value)' "$tmp/read.json")"
  basic_read="$(node -e 'process.stdout.write(Buffer.from("git:"+process.argv[1]).toString("base64"))' "$read_token")"
  git -c "http.extraHeader=Authorization: Basic $basic_read" ls-remote "$GIT_URL" refs/heads/main | grep -q 'refs/heads/main' \
    || fail "IZAKHONO CODE verification failed: main branch unavailable."

  sudo install -d -o root -g izakhono -m 0750 /etc/izakhono
  local env_tmp="$tmp/domains-source.env"
  cat >"$env_tmp" <<EOF
IZAKHONO_DOMAINS_CODE_REPO_URL=$GIT_URL
IZAKHONO_DOMAINS_CODE_REPO_TOKEN=$read_token
IZAKHONO_DOMAINS_CODE_REPO_SLUG=$REPO_SLUG
EOF
  sudo install -o root -g izakhono -m 0640 "$env_tmp" "$SOURCE_ENV"
  unset read_token basic_read
  echo "IZAKHONO DOMAINS source is now owned by IZAKHONO CODE."
}

ensure_owned_source
REPO_URL="$(sudo awk -F= '$1=="IZAKHONO_DOMAINS_CODE_REPO_URL"{sub(/^[^=]*=/,"");print;exit}' "$SOURCE_ENV")"
REPO_TOKEN="$(sudo awk -F= '$1=="IZAKHONO_DOMAINS_CODE_REPO_TOKEN"{sub(/^[^=]*=/,"");print;exit}' "$SOURCE_ENV")"
[ "$REPO_URL" = "$GIT_URL" ] || fail "Unexpected IZAKHONO DOMAINS source URL."
[ -n "$REPO_TOKEN" ] || fail "IZAKHONO DOMAINS read token is unavailable."

GIT_AUTH="$(node -e 'process.stdout.write(Buffer.from("git:"+process.argv[1]).toString("base64"))' "$REPO_TOKEN")"
git_source(){ sudo env GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=http.extraHeader GIT_CONFIG_VALUE_0="Authorization: Basic $GIT_AUTH" git "$@"; }

sudo mkdir -p "$CACHE_ROOT" "$RELEASE_BASE"
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
  sudo git -C "$CACHE" archive "$RESOLVED" apps/izakhono-domains | tar -x -C "$TMP"
  sudo mkdir -p "$RELEASE"
  sudo cp -a "$TMP/apps/izakhono-domains/." "$RELEASE/"
  sudo chown -R izakhono:izakhono "$RELEASE"
fi

test -f "$RELEASE/server.mjs" || fail "server.mjs missing from release."
test -f "$RELEASE/index.html" || fail "index.html missing from release."
test -f "$RELEASE/package.json" || fail "package.json missing from release."
node --check "$RELEASE/server.mjs"

RUNTIME_KEY="$(sudo awk -F= '$1=="IZAKHONO_RUNTIME_KEY"{sub(/^[^=]*=/,"");print;exit}' "$RUNTIME_ENV")"
[ -n "$RUNTIME_KEY" ] || fail "IZAKHONO_RUNTIME_KEY is unavailable."
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
  healthPath:"/health"
}));
NODE
)"

RESPONSE="$(curl -fsS -X POST "$CONTROL_URL/v1/deployments" \
  -H "content-type: application/json" -H "x-izakhono-key: $RUNTIME_KEY" --data-binary "$BODY")"
DEPLOYMENT_ID="$(node -e 'const x=JSON.parse(process.argv[1]);if(!x.id)process.exit(2);process.stdout.write(x.id)' "$RESPONSE")"

HEALTH="$(curl -fsS -H "Host: $HOSTNAME" "$PROXY_URL/health")"
node -e 'const x=JSON.parse(process.argv[1]);if(x.ok!==true||x.service!=="IZAKHONO DOMAINS")process.exit(2)' "$HEALTH"
STATUS="$(curl -fsS -H "Host: $HOSTNAME" "$PROXY_URL/api/provider-status")"
REGISTRATION_LIVE="$(node -e 'const x=JSON.parse(process.argv[1]);if(x.ok!==true)process.exit(2);process.stdout.write(x.registration_live?"true":"false")' "$STATUS")"

if [ "$REGISTRATION_LIVE" != "true" ]; then
  CHECKOUT_HTTP="$(curl -sS -o /tmp/izakhono-domains-checkout.json -w '%{http_code}' -X POST \
    -H "Host: $HOSTNAME" -H 'content-type: application/json' \
    --data '{"domain":"example.co.za"}' "$PROXY_URL/api/checkout")"
  [ "$CHECKOUT_HTTP" = "409" ] || fail "Checkout safety gate did not fail closed (HTTP $CHECKOUT_HTTP)."
fi

EDGE="PENDING"
if systemctl is-active --quiet izakhono-edge-node 2>/dev/null; then
  if curl -fsS -H "Host: $HOSTNAME" "$EDGE_URL/health" >/tmp/izakhono-domains-edge-health.json 2>/dev/null; then
    node -e 'const x=require("/tmp/izakhono-domains-edge-health.json");if(x.ok!==true||x.service!=="IZAKHONO DOMAINS")process.exit(2)'
    EDGE="VERIFIED"
  else
    EDGE="RUNNING_NOT_VERIFIED"
  fi
fi

cat <<EOF
IZAKHONO DOMAINS OWNER-HOST DEPLOYMENT
APP=$APP
HOSTNAME=$HOSTNAME
REVISION=$RESOLVED
DEPLOYMENT_ID=$DEPLOYMENT_ID
SOURCE=IZAKHONO_CODE
RUNTIME_HEALTH=VERIFIED
EDGE=$EDGE
REGISTRATION_LIVE=$REGISTRATION_LIVE
PUBLIC_HOSTNAME_MAPPING=REQUIRED_UNLESS_ALREADY_CONFIGURED
VERCEL_REQUIRED=NO
EOF
