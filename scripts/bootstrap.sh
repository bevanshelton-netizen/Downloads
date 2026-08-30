#!/usr/bin/env bash
set -euo pipefail
if ! command -v node >/dev/null 2>&1; then echo "Node.js is required" >&2; exit 1; fi
if [ ! -d node_modules ]; then npm install; fi

echo "1/5 Authenticating with Cloudflare if required..."
npx wrangler whoami >/dev/null 2>&1 || npx wrangler login

echo "2/5 First deploy (auto-provisions D1 + R2 on current Wrangler)..."
npx wrangler deploy

echo "3/5 Applying D1 migrations..."
npx wrangler d1 migrations apply DB --remote

echo "4/5 Creating launch secrets..."
ADMIN_SECRET="$(node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))")"
ABUSE_SALT="$(node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))")"
printf '%s' "$ADMIN_SECRET" | npx wrangler secret put ADMIN_SECRET >/dev/null
printf '%s' "$ABUSE_SALT" | npx wrangler secret put ABUSE_SALT >/dev/null
(umask 077; printf '%s\n' "$ADMIN_SECRET" > .local-admin-secret)

echo "5/5 Final deploy..."
npx wrangler deploy

echo
echo "IZAKHONO CLOUD ZERO is deployed."
echo "PayFast remains disabled until merchant secrets are added with wrangler secret put."
echo "Required when ready: PAYFAST_MERCHANT_ID, PAYFAST_MERCHANT_KEY, PAYFAST_PASSPHRASE."
echo "Admin secret saved locally to .local-admin-secret (never commit or share it)."
echo "Open /admin/ on the Worker URL to review leads and issue creator invites."
