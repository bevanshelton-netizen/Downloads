#!/usr/bin/env bash
set -Eeuo pipefail

# Cloudflare Workers Builds checks out this bootstrap branch. The actual
# application source is always taken from the validated production branch.
RELEASE_BRANCH="${VIDEONOMY_RELEASE_BRANCH:-videonomy-production}"
ROOT_DIR="$(pwd)"
DEPLOY_DIR="$ROOT_DIR/.videonomy-deploy"
APP_DIR="$DEPLOY_DIR/app"
WRANGLER="$ROOT_DIR/node_modules/.bin/wrangler"

rm -rf "$DEPLOY_DIR"
mkdir -p "$APP_DIR"

echo "[VIDEONOMY] Fetching validated production source: $RELEASE_BRANCH"
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
  echo "[VIDEONOMY] ERROR: Wrangler was not installed in the Cloudflare build root." >&2
  echo "[VIDEONOMY] Ensure root package dependencies are installed before the deploy command." >&2
  exit 1
fi

cd "$APP_DIR"

echo "[VIDEONOMY] Installing production application dependencies"
npm install --omit=dev

echo "[VIDEONOMY] Deploying application and checking Cloudflare resources"
"$WRANGLER" deploy

echo "[VIDEONOMY] Applying production D1 migrations"
"$WRANGLER" d1 migrations apply DB --remote

echo "[VIDEONOMY] Publishing final production release"
"$WRANGLER" deploy

echo "[VIDEONOMY] Production deployment command completed successfully"
