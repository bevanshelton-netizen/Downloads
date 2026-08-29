#!/usr/bin/env bash
set -euo pipefail
rm -rf .videonomy-deploy
mkdir -p .videonomy-deploy
base64 -d videonomy-cloudflare-zero-v0.3.tgz.b64 > .videonomy-deploy/app.tgz
tar -xzf .videonomy-deploy/app.tgz -C .videonomy-deploy
cd .videonomy-deploy
npm install
npx wrangler deploy
