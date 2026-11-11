#!/usr/bin/env bash
set -Eeuo pipefail

# Deploy the current VIDEONOMY production release directly. Do not use the
# retired v0.3 base64 bundle or the obsolete single-file archive.
RELEASE_BRANCH="${VIDEONOMY_RELEASE_BRANCH:-videonomy-production}"
ROOT_DIR="$(pwd)"
DEPLOY_DIR="$ROOT_DIR/.videonomy-deploy"
APP_DIR="$DEPLOY_DIR/app"
WRANGLER="$ROOT_DIR/node_modules/.bin/wrangler"

rm -rf "$DEPLOY_DIR"
mkdir -p "$APP_DIR"

echo "[VIDEONOMY] Fetching current production source: $RELEASE_BRANCH"
git fetch --depth=1 origin "$RELEASE_BRANCH"
RELEASE_COMMIT="$(git rev-parse FETCH_HEAD)"
echo "[VIDEONOMY] Production source commit: $RELEASE_COMMIT"

git archive "$RELEASE_COMMIT" package.json wrangler.jsonc src public migrations | tar -x -C "$APP_DIR"

for required in package.json wrangler.jsonc src/index.ts public migrations; do
  if [[ ! -e "$APP_DIR/$required" ]]; then
    echo "[VIDEONOMY] ERROR: production source is missing $required" >&2
    exit 1
  fi
done

if [[ ! -x "$WRANGLER" ]]; then
  echo "[VIDEONOMY] ERROR: cached/root Wrangler dependency is missing." >&2
  echo "[VIDEONOMY] Check Workers Builds root directory and automatic dependency installation." >&2
  exit 1
fi

cd "$APP_DIR"

echo "[VIDEONOMY] Initial deploy: provision/check configured Cloudflare resources"
"$WRANGLER" deploy

echo "[VIDEONOMY] Apply production D1 migrations"
"$WRANGLER" d1 migrations apply DB --remote

echo "[VIDEONOMY] Final deploy"
"$WRANGLER" deploy

echo "[VIDEONOMY] Production deployment command completed successfully"
