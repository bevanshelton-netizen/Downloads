#!/usr/bin/env bash
set -euo pipefail

APP="creative-suite"
PRODUCT="IZAKHONO CREATIVE SUITE"
SOURCE_DIR="IZAKHONO-STUDIO"
HOSTNAME="${CREATIVE_SUITE_HOSTNAME:-creative.domains.izakhonoafrica.co.za}"
REVISION="${1:-main}"
SOURCE_ENV="${IZAKHONO_CODE_SOURCE_ENV:-/etc/izakhono/code-source.env}"
REPO_URL="${IZAKHONO_CODE_REPO_URL:-}"
REPO_TOKEN="${IZAKHONO_CODE_REPO_TOKEN:-}"
CACHE_ROOT="${IZAKHONO_SOURCE_CACHE:-/var/lib/izakhono-runtime/source}"
RELEASE_BASE="/var/lib/izakhono-runtime/releases/$APP"
RUNTIME_ENV="/etc/izakhono/runtime-node.env"
APP_ENV="/etc/izakhono/apps/creative-suite.env"
CONTROL_URL="http://127.0.0.1:8790"
PROXY_URL="http://127.0.0.1:8080"
EDGE_URL="http://127.0.0.1:8780"
REPORT_DIR="/var/lib/izakhono-deploy"
REPORT="$REPORT_DIR/creative-suite.json"

fail(){ echo "FAIL: $*" >&2; exit 2; }
need(){ command -v "$1" >/dev/null 2>&1 || fail "$1 is required"; }

if [ -z "$REPO_URL" ] && [ -f "$SOURCE_ENV" ]; then
  REPO_URL="$(sudo awk -F= '$1=="IZAKHONO_CODE_REPO_URL"{sub(/^[^=]*=/,"");print;exit}' "$SOURCE_ENV")"
  REPO_TOKEN="$(sudo awk -F= '$1=="IZAKHONO_CODE_REPO_TOKEN"{sub(/^[^=]*=/,"");print;exit}' "$SOURCE_ENV")"
fi

[ -n "$REPO_URL" ] || fail "IZAKHONO CODE source is not configured."
if [[ "$REPO_URL" != http://127.0.0.1:8860/git/* ]] && [ "${ALLOW_EXTERNAL_SOURCE:-0}" != "1" ]; then
  fail "External source refused. Creative Suite must deploy from IZAKHONO CODE unless explicitly overridden."
fi

for cmd in git curl node npm tar; do need "$cmd"; done
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

sudo mkdir -p "$CACHE_ROOT" "$RELEASE_BASE" "$REPORT_DIR" "$(dirname "$APP_ENV")"
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

test -f "$RELEASE/package.json" || fail "Creative Suite package.json missing."
test -f "$RELEASE/server.mjs" || fail "Creative Suite portable server missing."
node --check "$RELEASE/server.mjs"

if [ ! -d "$RELEASE/dist" ]; then
  PACKAGE_REGISTRY="https://registry.npmjs.org/"
  if curl -fsS --max-time 3 http://127.0.0.1:8910/ >/dev/null 2>&1; then
    PACKAGE_REGISTRY="http://127.0.0.1:8910/"
    echo "PACKAGE_SOURCE=IZAKHONO_PACKAGE_NODE"
  else
    echo "PACKAGE_SOURCE=UPSTREAM_BOOTSTRAP_FALLBACK"
  fi
  sudo -u izakhono env     HOME="$RELEASE"     npm_config_cache="$RELEASE/.npm-cache"     npm_config_registry="$PACKAGE_REGISTRY"     bash -lc "cd '$RELEASE' && npm install --no-audit --no-fund && npm run build"
fi

test -f "$RELEASE/dist/index.html" || fail "Creative Suite build did not produce dist/index.html."

if [ ! -f "$APP_ENV" ]; then
  TMP_ENV="$(mktemp)"
  cat > "$TMP_ENV" <<EOF
IZAKHONO_RUNTIME_MODE=owned
REGISTRATION_ENABLED=false
CHECKOUT_ENABLED=false
BILLING_MODE=30-day-renewable-until-recurring-verified
RECURRING_BILLING_VERIFIED=false
EOF
  sudo install -o root -g izakhono -m 0640 "$TMP_ENV" "$APP_ENV"
  rm -f "$TMP_ENV"
fi

grep -q '^REGISTRATION_ENABLED=false

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
node -e 'const x=JSON.parse(process.argv[1]);if(x.ok!==true||x.service!=="izakhono-creative-suite"||x.checkout_enabled!==false||x.registration_enabled!==false||x.recurring_billing_verified!==false||x.pricing_reference_usd?.creative!==5||x.pricing_reference_usd?.gamer!==15)process.exit(2)' "$HEALTH"
curl -fsS -H "Host: $HOSTNAME" "$PROXY_URL/" | grep -Fq '<div id="root"></div>'

EDGE="NOT_RUNNING"
if systemctl is-active --quiet izakhono-edge-node 2>/dev/null; then
  if curl -fsS -H "Host: $HOSTNAME" "$EDGE_URL/health" >/tmp/creative-suite-edge-health.json 2>/dev/null; then
    EDGE="VERIFIED"
  else
    EDGE="RUNNING_NOT_VERIFIED"
  fi
fi

PUBLIC_HTTPS="NOT_VERIFIED"
if curl -fsS --max-time 8 "https://$HOSTNAME/health" >/tmp/creative-suite-public-health.json 2>/dev/null; then
  if node -e 'const x=require("/tmp/creative-suite-public-health.json");if(x.ok!==true||x.service!=="izakhono-creative-suite")process.exit(2)' 2>/dev/null; then
    PUBLIC_HTTPS="VERIFIED"
  fi
fi

TMP_REPORT="$(mktemp)"
node - "$TMP_REPORT" "$HOSTNAME" "$RESOLVED" "$DEPLOYMENT_ID" "$EDGE" "$PUBLIC_HTTPS" <<'NODE'
const fs=require("fs");
const [path,hostname,revision,deploymentId,edge,publicHttps]=process.argv.slice(2);
fs.writeFileSync(path,JSON.stringify({
  schema:"izakhono.creative-suite-deployment/v1",
  app:"creative-suite",
  product:"IZAKHONO CREATIVE SUITE",
  hostname,
  revision,
  deployment_id:deploymentId,
  source:"IZAKHONO_CODE",
  runtime:"IZAKHONO_RUNTIME",
  edge,
  public_https:publicHttps,
  registration_enabled:false,
  checkout_enabled:false,
  pricing_reference_usd:{creative:5,gamer:15},
  billing_mode:"30-day-renewable-until-recurring-verified",
  recurring_billing_verified:false,
  external_fallback_preserved:true,
  generated_at:new Date().toISOString()
},null,2)+"\n");
NODE
sudo install -o root -g izakhono -m 0640 "$TMP_REPORT" "$REPORT"
rm -f "$TMP_REPORT"

cat <<EOF
IZAKHONO CREATIVE SUITE OWNED DEPLOYMENT
APP=$APP
HOSTNAME=$HOSTNAME
REVISION=$RESOLVED
DEPLOYMENT_ID=$DEPLOYMENT_ID
SOURCE=IZAKHONO_CODE
RUNTIME_HEALTH=VERIFIED
EDGE=$EDGE
PUBLIC_HTTPS=$PUBLIC_HTTPS
REGISTRATION_ENABLED=NO
CHECKOUT_ENABLED=NO
CREATIVE_PRICE_REFERENCE_USD=5
GAMER_PRICE_REFERENCE_USD=15
BILLING_MODE=30-DAY-RENEWABLE-NO-AUTORENEW-YET
EXTERNAL_FALLBACK=PRESERVED
RECEIPT=$REPORT
EOF
 "$APP_ENV" || fail "Registration must remain disabled until end-to-end auth verification passes."
grep -q '^CHECKOUT_ENABLED=false

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
node -e 'const x=JSON.parse(process.argv[1]);if(x.ok!==true||x.service!=="izakhono-creative-suite"||x.checkout_enabled!==false||x.registration_enabled!==false)process.exit(2)' "$HEALTH"
curl -fsS -H "Host: $HOSTNAME" "$PROXY_URL/" | grep -Fq '<div id="root"></div>'

EDGE="NOT_RUNNING"
if systemctl is-active --quiet izakhono-edge-node 2>/dev/null; then
  if curl -fsS -H "Host: $HOSTNAME" "$EDGE_URL/health" >/tmp/creative-suite-edge-health.json 2>/dev/null; then
    EDGE="VERIFIED"
  else
    EDGE="RUNNING_NOT_VERIFIED"
  fi
fi

PUBLIC_HTTPS="NOT_VERIFIED"
if curl -fsS --max-time 8 "https://$HOSTNAME/health" >/tmp/creative-suite-public-health.json 2>/dev/null; then
  if node -e 'const x=require("/tmp/creative-suite-public-health.json");if(x.ok!==true||x.service!=="izakhono-creative-suite")process.exit(2)' 2>/dev/null; then
    PUBLIC_HTTPS="VERIFIED"
  fi
fi

TMP_REPORT="$(mktemp)"
node - "$TMP_REPORT" "$HOSTNAME" "$RESOLVED" "$DEPLOYMENT_ID" "$EDGE" "$PUBLIC_HTTPS" <<'NODE'
const fs=require("fs");
const [path,hostname,revision,deploymentId,edge,publicHttps]=process.argv.slice(2);
fs.writeFileSync(path,JSON.stringify({
  schema:"izakhono.creative-suite-deployment/v1",
  app:"creative-suite",
  product:"IZAKHONO CREATIVE SUITE",
  hostname,
  revision,
  deployment_id:deploymentId,
  source:"IZAKHONO_CODE",
  runtime:"IZAKHONO_RUNTIME",
  edge,
  public_https:publicHttps,
  registration_enabled:false,
  checkout_enabled:false,
  external_fallback_preserved:true,
  generated_at:new Date().toISOString()
},null,2)+"\n");
NODE
sudo install -o root -g izakhono -m 0640 "$TMP_REPORT" "$REPORT"
rm -f "$TMP_REPORT"

cat <<EOF
IZAKHONO CREATIVE SUITE OWNED DEPLOYMENT
APP=$APP
HOSTNAME=$HOSTNAME
REVISION=$RESOLVED
DEPLOYMENT_ID=$DEPLOYMENT_ID
SOURCE=IZAKHONO_CODE
RUNTIME_HEALTH=VERIFIED
EDGE=$EDGE
PUBLIC_HTTPS=$PUBLIC_HTTPS
REGISTRATION_ENABLED=NO
CHECKOUT_ENABLED=NO
EXTERNAL_FALLBACK=PRESERVED
RECEIPT=$REPORT
EOF
 "$APP_ENV" || fail "Checkout must remain disabled until Creative $5 and Gamer $15 settlement mapping plus payment/entitlement E2E passes."
grep -q '^BILLING_MODE=30-day-renewable-until-recurring-verified

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
node -e 'const x=JSON.parse(process.argv[1]);if(x.ok!==true||x.service!=="izakhono-creative-suite"||x.checkout_enabled!==false||x.registration_enabled!==false)process.exit(2)' "$HEALTH"
curl -fsS -H "Host: $HOSTNAME" "$PROXY_URL/" | grep -Fq '<div id="root"></div>'

EDGE="NOT_RUNNING"
if systemctl is-active --quiet izakhono-edge-node 2>/dev/null; then
  if curl -fsS -H "Host: $HOSTNAME" "$EDGE_URL/health" >/tmp/creative-suite-edge-health.json 2>/dev/null; then
    EDGE="VERIFIED"
  else
    EDGE="RUNNING_NOT_VERIFIED"
  fi
fi

PUBLIC_HTTPS="NOT_VERIFIED"
if curl -fsS --max-time 8 "https://$HOSTNAME/health" >/tmp/creative-suite-public-health.json 2>/dev/null; then
  if node -e 'const x=require("/tmp/creative-suite-public-health.json");if(x.ok!==true||x.service!=="izakhono-creative-suite")process.exit(2)' 2>/dev/null; then
    PUBLIC_HTTPS="VERIFIED"
  fi
fi

TMP_REPORT="$(mktemp)"
node - "$TMP_REPORT" "$HOSTNAME" "$RESOLVED" "$DEPLOYMENT_ID" "$EDGE" "$PUBLIC_HTTPS" <<'NODE'
const fs=require("fs");
const [path,hostname,revision,deploymentId,edge,publicHttps]=process.argv.slice(2);
fs.writeFileSync(path,JSON.stringify({
  schema:"izakhono.creative-suite-deployment/v1",
  app:"creative-suite",
  product:"IZAKHONO CREATIVE SUITE",
  hostname,
  revision,
  deployment_id:deploymentId,
  source:"IZAKHONO_CODE",
  runtime:"IZAKHONO_RUNTIME",
  edge,
  public_https:publicHttps,
  registration_enabled:false,
  checkout_enabled:false,
  external_fallback_preserved:true,
  generated_at:new Date().toISOString()
},null,2)+"\n");
NODE
sudo install -o root -g izakhono -m 0640 "$TMP_REPORT" "$REPORT"
rm -f "$TMP_REPORT"

cat <<EOF
IZAKHONO CREATIVE SUITE OWNED DEPLOYMENT
APP=$APP
HOSTNAME=$HOSTNAME
REVISION=$RESOLVED
DEPLOYMENT_ID=$DEPLOYMENT_ID
SOURCE=IZAKHONO_CODE
RUNTIME_HEALTH=VERIFIED
EDGE=$EDGE
PUBLIC_HTTPS=$PUBLIC_HTTPS
REGISTRATION_ENABLED=NO
CHECKOUT_ENABLED=NO
EXTERNAL_FALLBACK=PRESERVED
RECEIPT=$REPORT
EOF
 "$APP_ENV" || fail "Creative Suite billing mode drifted before recurring billing verification."
grep -q '^RECURRING_BILLING_VERIFIED=false

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
node -e 'const x=JSON.parse(process.argv[1]);if(x.ok!==true||x.service!=="izakhono-creative-suite"||x.checkout_enabled!==false||x.registration_enabled!==false)process.exit(2)' "$HEALTH"
curl -fsS -H "Host: $HOSTNAME" "$PROXY_URL/" | grep -Fq '<div id="root"></div>'

EDGE="NOT_RUNNING"
if systemctl is-active --quiet izakhono-edge-node 2>/dev/null; then
  if curl -fsS -H "Host: $HOSTNAME" "$EDGE_URL/health" >/tmp/creative-suite-edge-health.json 2>/dev/null; then
    EDGE="VERIFIED"
  else
    EDGE="RUNNING_NOT_VERIFIED"
  fi
fi

PUBLIC_HTTPS="NOT_VERIFIED"
if curl -fsS --max-time 8 "https://$HOSTNAME/health" >/tmp/creative-suite-public-health.json 2>/dev/null; then
  if node -e 'const x=require("/tmp/creative-suite-public-health.json");if(x.ok!==true||x.service!=="izakhono-creative-suite")process.exit(2)' 2>/dev/null; then
    PUBLIC_HTTPS="VERIFIED"
  fi
fi

TMP_REPORT="$(mktemp)"
node - "$TMP_REPORT" "$HOSTNAME" "$RESOLVED" "$DEPLOYMENT_ID" "$EDGE" "$PUBLIC_HTTPS" <<'NODE'
const fs=require("fs");
const [path,hostname,revision,deploymentId,edge,publicHttps]=process.argv.slice(2);
fs.writeFileSync(path,JSON.stringify({
  schema:"izakhono.creative-suite-deployment/v1",
  app:"creative-suite",
  product:"IZAKHONO CREATIVE SUITE",
  hostname,
  revision,
  deployment_id:deploymentId,
  source:"IZAKHONO_CODE",
  runtime:"IZAKHONO_RUNTIME",
  edge,
  public_https:publicHttps,
  registration_enabled:false,
  checkout_enabled:false,
  external_fallback_preserved:true,
  generated_at:new Date().toISOString()
},null,2)+"\n");
NODE
sudo install -o root -g izakhono -m 0640 "$TMP_REPORT" "$REPORT"
rm -f "$TMP_REPORT"

cat <<EOF
IZAKHONO CREATIVE SUITE OWNED DEPLOYMENT
APP=$APP
HOSTNAME=$HOSTNAME
REVISION=$RESOLVED
DEPLOYMENT_ID=$DEPLOYMENT_ID
SOURCE=IZAKHONO_CODE
RUNTIME_HEALTH=VERIFIED
EDGE=$EDGE
PUBLIC_HTTPS=$PUBLIC_HTTPS
REGISTRATION_ENABLED=NO
CHECKOUT_ENABLED=NO
EXTERNAL_FALLBACK=PRESERVED
RECEIPT=$REPORT
EOF
 "$APP_ENV" || fail "Recurring billing cannot be enabled before end-to-end verification."

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
node -e 'const x=JSON.parse(process.argv[1]);if(x.ok!==true||x.service!=="izakhono-creative-suite"||x.checkout_enabled!==false||x.registration_enabled!==false)process.exit(2)' "$HEALTH"
curl -fsS -H "Host: $HOSTNAME" "$PROXY_URL/" | grep -Fq '<div id="root"></div>'

EDGE="NOT_RUNNING"
if systemctl is-active --quiet izakhono-edge-node 2>/dev/null; then
  if curl -fsS -H "Host: $HOSTNAME" "$EDGE_URL/health" >/tmp/creative-suite-edge-health.json 2>/dev/null; then
    EDGE="VERIFIED"
  else
    EDGE="RUNNING_NOT_VERIFIED"
  fi
fi

PUBLIC_HTTPS="NOT_VERIFIED"
if curl -fsS --max-time 8 "https://$HOSTNAME/health" >/tmp/creative-suite-public-health.json 2>/dev/null; then
  if node -e 'const x=require("/tmp/creative-suite-public-health.json");if(x.ok!==true||x.service!=="izakhono-creative-suite")process.exit(2)' 2>/dev/null; then
    PUBLIC_HTTPS="VERIFIED"
  fi
fi

TMP_REPORT="$(mktemp)"
node - "$TMP_REPORT" "$HOSTNAME" "$RESOLVED" "$DEPLOYMENT_ID" "$EDGE" "$PUBLIC_HTTPS" <<'NODE'
const fs=require("fs");
const [path,hostname,revision,deploymentId,edge,publicHttps]=process.argv.slice(2);
fs.writeFileSync(path,JSON.stringify({
  schema:"izakhono.creative-suite-deployment/v1",
  app:"creative-suite",
  product:"IZAKHONO CREATIVE SUITE",
  hostname,
  revision,
  deployment_id:deploymentId,
  source:"IZAKHONO_CODE",
  runtime:"IZAKHONO_RUNTIME",
  edge,
  public_https:publicHttps,
  registration_enabled:false,
  checkout_enabled:false,
  external_fallback_preserved:true,
  generated_at:new Date().toISOString()
},null,2)+"\n");
NODE
sudo install -o root -g izakhono -m 0640 "$TMP_REPORT" "$REPORT"
rm -f "$TMP_REPORT"

cat <<EOF
IZAKHONO CREATIVE SUITE OWNED DEPLOYMENT
APP=$APP
HOSTNAME=$HOSTNAME
REVISION=$RESOLVED
DEPLOYMENT_ID=$DEPLOYMENT_ID
SOURCE=IZAKHONO_CODE
RUNTIME_HEALTH=VERIFIED
EDGE=$EDGE
PUBLIC_HTTPS=$PUBLIC_HTTPS
REGISTRATION_ENABLED=NO
CHECKOUT_ENABLED=NO
EXTERNAL_FALLBACK=PRESERVED
RECEIPT=$REPORT
EOF
