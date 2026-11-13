#!/usr/bin/env bash
set -Eeuo pipefail

# Deploy VIDEONOMY onto IZAKHONO RUNTIME NODE. Run from the root of a
# checked-out videonomy-production release on the IZAKHONO owner host.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="videonomy"
HOSTNAME="${VIDEONOMY_HOSTNAME:-videonomy.izakhonoafrica.co.za}"
RUNTIME_URL="${IZAKHONO_RUNTIME_URL:-http://127.0.0.1:8790}"
ENV_FILE="/etc/izakhono/apps/videonomy.env"
RELEASE_ROOT="/var/lib/izakhono-runtime/releases/videonomy"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
COMMIT="$(git -C "$ROOT" rev-parse --short=12 HEAD 2>/dev/null || echo source)"
RELEASE_ID="${STAMP}-${COMMIT}"
RELEASE="$RELEASE_ROOT/$RELEASE_ID"
RUNTIME_ENV="/etc/izakhono/runtime-node.env"

need(){ command -v "$1" >/dev/null 2>&1 || { echo "Missing required command: $1" >&2; exit 2; }; }
for c in node npm git curl tar install; do need "$c"; done
node -e 'const [a,b]=process.versions.node.split(".").map(Number);if(a<22||(a===22&&b<13))process.exit(1)' || { echo "Node.js 22.13+ required" >&2; exit 2; }
[ -f "$ROOT/owned/server.mjs" ] && [ -f "$ROOT/src/index.ts" ] && [ -d "$ROOT/migrations" ] || { echo "Run from a complete VIDEONOMY production source checkout." >&2; exit 2; }
[ -f "$RUNTIME_ENV" ] || { echo "IZAKHONO RUNTIME NODE is not installed: $RUNTIME_ENV missing." >&2; exit 3; }

if [ "$(id -u)" -ne 0 ]; then
  echo "Run with sudo on the IZAKHONO owner host." >&2
  exit 4
fi

RUNTIME_KEY="$(awk -F= '$1=="IZAKHONO_RUNTIME_KEY"{sub(/^[^=]*=/,"");print;exit}' "$RUNTIME_ENV")"
[ -n "$RUNTIME_KEY" ] || { echo "IZAKHONO_RUNTIME_KEY missing from protected runtime config." >&2; exit 5; }
curl -fsS --max-time 4 "$RUNTIME_URL/health" >/dev/null || { echo "IZAKHONO RUNTIME NODE health check failed." >&2; exit 6; }

install -d -o izakhono -g izakhono -m 0750 "$RELEASE"
tar -C "$ROOT" --exclude='./.git' --exclude='./node_modules' --exclude='./.wrangler' --exclude='./.owned-data' -cf - . | tar -C "$RELEASE" -xf -
chown -R izakhono:izakhono "$RELEASE"

# Install only the owned runtime adapter dependencies; Cloudflare/Wrangler is
# not installed or required on the primary owned deployment path.
npm --prefix "$RELEASE/owned" install --omit=dev --no-audit --no-fund

# Create private app secrets once; preserve them across releases.
if [ ! -f "$ENV_FILE" ]; then
  ADMIN_SECRET="$(node -e 'process.stdout.write(require("crypto").randomBytes(48).toString("base64url"))')"
  ABUSE_SALT="$(node -e 'process.stdout.write(require("crypto").randomBytes(48).toString("hex"))')"
  install -d -o root -g izakhono -m 0750 /etc/izakhono/apps
  umask 027
  {
    echo "APP_ENV=production"
    echo "ADMIN_SECRET=$ADMIN_SECRET"
    echo "ABUSE_SALT=$ABUSE_SALT"
    echo "PUBLIC_BASE_URL=https://$HOSTNAME"
    echo "ALLOWED_ORIGINS=https://$HOSTNAME"
    echo "VIDEONOMY_DATA_DIR=/var/lib/izakhono-runtime/apps/videonomy"
    echo "PORT=18081"
    echo "HOST=127.0.0.1"
  } > "$ENV_FILE"
  chown root:izakhono "$ENV_FILE"
  chmod 0640 "$ENV_FILE"
fi

# Validate the protected origin against the hostname registered with RUNTIME.
# Never silently deploy a hostname that disagrees with the app's canonical origin.
node - "$ENV_FILE" "$HOSTNAME" <<'NODE'
const fs=require("node:fs");
const [file,hostname]=process.argv.slice(2);
const values={};
for(const line of fs.readFileSync(file,"utf8").split(/\\r?\\n/)){
  const i=line.indexOf("=");
  if(i>0) values[line.slice(0,i).trim()]=line.slice(i+1).trim();
}
let origin;
try { origin=new URL(values.PUBLIC_BASE_URL||""); } catch { throw new Error("PUBLIC_BASE_URL must be a valid HTTPS URL"); }
if(origin.protocol!=="https:" || origin.hostname.toLowerCase()!==hostname.toLowerCase() || origin.pathname!=="/" || origin.search || origin.hash){
  console.error("PUBLIC_BASE_URL must equal https://"+hostname+"/ in "+file);
  process.exit(7);
}
const allowed=(values.ALLOWED_ORIGINS||"").split(",").map(x=>x.trim()).filter(Boolean);
if(!allowed.includes("https://"+hostname)){
  console.error("ALLOWED_ORIGINS must include https://"+hostname+" in "+file);
  process.exit(8);
}
for(const key of ["ADMIN_SECRET","ABUSE_SALT"]){
  if(!values[key] || values[key].length<32){
    console.error(key+" is missing or too short in protected environment");
    process.exit(9);
  }
}
NODE
install -d -o izakhono -g izakhono -m 0750 /var/lib/izakhono-runtime/apps/videonomy

PAYLOAD="$(node - "$APP" "$HOSTNAME" "$RELEASE" <<'NODE'
const [app,hostname,releasePath]=process.argv.slice(2);
process.stdout.write(JSON.stringify({
  app,hostname,releasePath,
  command:["node","owned/node_modules/tsx/dist/cli.mjs","owned/server.mjs"],
  envFile:"/etc/izakhono/apps/videonomy.env",
  healthPath:"/api/health"
}));
NODE
)"

echo "[VIDEONOMY] Requesting health-gated deployment on IZAKHONO RUNTIME NODE..."
RESULT="$(curl -fsS --max-time 45 -X POST "$RUNTIME_URL/v1/deployments" \
  -H "content-type: application/json" \
  -H "x-izakhono-key: $RUNTIME_KEY" \
  --data "$PAYLOAD")"
unset RUNTIME_KEY
echo "$RESULT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const x=JSON.parse(s);if(!x.id||!x.port||!x.app)process.exit(1);console.log(JSON.stringify({app:x.app,hostname:x.hostname,deployment:x.id,port:x.port,previous:x.previous||null},null,2))})'

echo "[VIDEONOMY] Runtime accepted and health-gated the release."
echo "[VIDEONOMY] Public DNS/TLS/edge routing must be verified separately before declaring the hostname live."
