#!/usr/bin/env bash
set -Eeuo pipefail

# Cloudflare Workers Builds checks out this bootstrap branch. The application
# source is fetched from the validated production branch.
RELEASE_BRANCH="${VIDEONOMY_RELEASE_BRANCH:-videonomy-production}"
D1_NAME="${VIDEONOMY_D1_NAME:-videonomy}"
R2_NAME="${VIDEONOMY_R2_BUCKET:-videonomy-media}"
ROOT_DIR="$(pwd)"
DEPLOY_DIR="$ROOT_DIR/.videonomy-deploy"
APP_DIR="$DEPLOY_DIR/app"
WRANGLER="$ROOT_DIR/node_modules/.bin/wrangler"

rm -rf "$DEPLOY_DIR"
mkdir -p "$APP_DIR"

echo "[VIDEONOMY] Fetching production source: $RELEASE_BRANCH"
git fetch --depth=1 origin "$RELEASE_BRANCH"
RELEASE_COMMIT="$(git rev-parse FETCH_HEAD)"
echo "[VIDEONOMY] Production source commit: $RELEASE_COMMIT"
git archive "$RELEASE_COMMIT" package.json wrangler.jsonc src public migrations tests | tar -x -C "$APP_DIR"

for required in package.json wrangler.jsonc src/index.ts public migrations; do
  [[ -e "$APP_DIR/$required" ]] || { echo "[VIDEONOMY] ERROR: missing production source $required" >&2; exit 1; }
done
[[ -x "$WRANGLER" ]] || { echo "[VIDEONOMY] ERROR: Wrangler missing from build root dependencies" >&2; exit 1; }

cd "$APP_DIR"
npm install --omit=dev

# Query existing Cloudflare resources and create only those that are missing.
echo "[VIDEONOMY] Checking D1 database: $D1_NAME"
D1_LIST="$("$WRANGLER" d1 list --json)"
D1_ID="$(D1_LIST="$D1_LIST" D1_NAME="$D1_NAME" node -e '
const data=JSON.parse(process.env.D1_LIST);
const name=process.env.D1_NAME;
function walk(x){if(!x)return null;if(Array.isArray(x)){for(const v of x){const r=walk(v);if(r)return r;}}else if(typeof x==="object"){if((x.name===name||x.database_name===name)&& (x.uuid||x.database_id))return x.uuid||x.database_id;for(const v of Object.values(x)){const r=walk(v);if(r)return r;}}return null;}
process.stdout.write(walk(data)||"");
')"
if [[ -z "$D1_ID" ]]; then
  echo "[VIDEONOMY] Creating D1 database: $D1_NAME"
  "$WRANGLER" d1 create "$D1_NAME"
  D1_LIST="$("$WRANGLER" d1 list --json)"
  D1_ID="$(D1_LIST="$D1_LIST" D1_NAME="$D1_NAME" node -e '
const data=JSON.parse(process.env.D1_LIST),name=process.env.D1_NAME;
function walk(x){if(!x)return null;if(Array.isArray(x)){for(const v of x){const r=walk(v);if(r)return r;}}else if(typeof x==="object"){if((x.name===name||x.database_name===name)&&(x.uuid||x.database_id))return x.uuid||x.database_id;for(const v of Object.values(x)){const r=walk(v);if(r)return r;}}return null;}
process.stdout.write(walk(data)||"");
')"
fi
[[ -n "$D1_ID" ]] || { echo "[VIDEONOMY] ERROR: could not resolve D1 database ID for $D1_NAME" >&2; exit 1; }

echo "[VIDEONOMY] Checking R2 bucket: $R2_NAME"
R2_LIST="$("$WRANGLER" r2 bucket list --json)"
R2_EXISTS="$(R2_LIST="$R2_LIST" R2_NAME="$R2_NAME" node -e '
const data=JSON.parse(process.env.R2_LIST),name=process.env.R2_NAME;
function walk(x){if(!x)return false;if(Array.isArray(x))return x.some(walk);if(typeof x==="object"){if(x.name===name||x.bucket_name===name)return true;return Object.values(x).some(walk);}return false;}
process.stdout.write(walk(data)?"yes":"no");
')"
if [[ "$R2_EXISTS" != "yes" ]]; then
  echo "[VIDEONOMY] Creating R2 bucket: $R2_NAME"
  "$WRANGLER" r2 bucket create "$R2_NAME"
fi

# Materialise the resource identifiers into the temporary deployment config.
VIDEONOMY_D1_ID="$D1_ID" VIDEONOMY_R2_NAME="$R2_NAME" node -e '
const fs=require("fs"),p="wrangler.jsonc",c=JSON.parse(fs.readFileSync(p,"utf8"));
if(!c.d1_databases?.length||!c.r2_buckets?.length)throw new Error("Expected D1 and R2 bindings in wrangler.jsonc");
c.d1_databases[0].database_id=process.env.VIDEONOMY_D1_ID;
c.r2_buckets[0].bucket_name=process.env.VIDEONOMY_R2_NAME;
fs.writeFileSync(p,JSON.stringify(c,null,2)+"\n");
'

echo "[VIDEONOMY] Applying production D1 migrations before exposing the release"
"$WRANGLER" d1 migrations apply DB --remote

echo "[VIDEONOMY] Publishing production Worker with provisioned D1/R2 bindings"
"$WRANGLER" deploy

echo "[VIDEONOMY] Deployment command completed; verify the deployed Worker health endpoint before declaring production live."
