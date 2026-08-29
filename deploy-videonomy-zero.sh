#!/usr/bin/env bash
set -euo pipefail

rm -rf .videonomy-deploy
mkdir -p .videonomy-deploy

# Cloudflare initially checks out the repository default branch (main).
# Pull the validated VIDEONOMY release bundle directly from its launch branch
# so the first production deployment uses the correct source.
git fetch --depth=1 origin videonomy-cloudflare-zero
git show FETCH_HEAD:videonomy-cloudflare-zero-v0.3.tgz.b64 > .videonomy-deploy/app.b64

base64 -d .videonomy-deploy/app.b64 > .videonomy-deploy/app.tgz
tar -xzf .videonomy-deploy/app.tgz -C .videonomy-deploy
cd .videonomy-deploy
npm install
npx wrangler deploy
