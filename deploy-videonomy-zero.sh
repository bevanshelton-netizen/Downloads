#!/usr/bin/env bash
set -Eeuo pipefail

# The Pages build starts from the repository default branch. The VIDEONOMY
# release is maintained separately; assemble the checked-in chunk files from
# that branch instead of requesting the obsolete single-file archive.
RELEASE_BRANCH="${VIDEONOMY_RELEASE_BRANCH:-videonomy-cloudflare-zero}"
DEPLOY_DIR=".videonomy-deploy"
SOURCE_DIR="$DEPLOY_DIR/source"
BUNDLE_DIR="$SOURCE_DIR/videonomy-bundle"

rm -rf "$DEPLOY_DIR"
mkdir -p "$SOURCE_DIR"

echo "[VIDEONOMY] Fetching release branch: $RELEASE_BRANCH"
git fetch --depth=1 origin "$RELEASE_BRANCH"
RELEASE_COMMIT="$(git rev-parse FETCH_HEAD)"
echo "[VIDEONOMY] Release commit: $RELEASE_COMMIT"

git archive "$RELEASE_COMMIT" videonomy-bundle | tar -x -C "$SOURCE_DIR"

shopt -s nullglob
chunks=("$BUNDLE_DIR"/chunk-*.b64)
if (( ${#chunks[@]} == 0 )); then
  echo "[VIDEONOMY] ERROR: no release bundle chunks found in $RELEASE_BRANCH" >&2
  exit 1
fi

echo "[VIDEONOMY] Assembling ${#chunks[@]} bundle chunks"
cat "${chunks[@]}" | base64 --decode > "$DEPLOY_DIR/app.tgz"
tar -tzf "$DEPLOY_DIR/app.tgz" >/dev/null
mkdir -p "$DEPLOY_DIR/app"
tar -xzf "$DEPLOY_DIR/app.tgz" -C "$DEPLOY_DIR/app"

cd "$DEPLOY_DIR/app"
if [[ ! -f package.json || ! -f wrangler.jsonc ]]; then
  echo "[VIDEONOMY] ERROR: release archive is missing package.json or wrangler.jsonc" >&2
  exit 1
fi

echo "[VIDEONOMY] Installing pinned application dependencies"
if [[ -f package-lock.json ]]; then
  npm ci --no-audit --no-fund
else
  npm install --no-audit --no-fund
fi

echo "[VIDEONOMY] Initial deploy and automatic D1/R2 provisioning"
npx wrangler deploy

echo "[VIDEONOMY] Applying production D1 migrations"
npx wrangler d1 migrations apply DB --remote

echo "[VIDEONOMY] Final deployment"
npx wrangler deploy

echo "[VIDEONOMY] Cloudflare deployment command completed successfully"
