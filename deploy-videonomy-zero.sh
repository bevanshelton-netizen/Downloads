#!/usr/bin/env bash
set -euo pipefail

rm -rf .videonomy-deploy
mkdir -p .videonomy-deploy

cat videonomy-bundle/chunk-*.b64 | base64 -d > .videonomy-deploy/app.tgz
tar -xzf .videonomy-deploy/app.tgz -C .videonomy-deploy
cd .videonomy-deploy

npm install

echo "[VIDEONOMY] Initial deploy and automatic D1/R2 provisioning..."
npx wrangler deploy

echo "[VIDEONOMY] Applying production D1 migrations..."
npx wrangler d1 migrations apply DB --remote

echo "[VIDEONOMY] Final deployment..."
npx wrangler deploy

echo "[VIDEONOMY] Cloudflare application deployed."
