#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then exec sudo -E bash "$0" "$@"; fi

HAIR_ENV="/etc/izakhono/crowne-hair.env"
install -d -m 0750 -o root -g izakhono /etc/izakhono

echo "CROWNÉ Hair by Netty — dedicated merchant setup"
echo "This does NOT read or modify IZAKHONO PAY."
echo "Enter Netty's merchant gateway values only. Secrets are written locally to $HAIR_ENV."
echo

read -r -p "Merchant display name [CROWNÉ Hair by Netty]: " MERCHANT_NAME
MERCHANT_NAME="${MERCHANT_NAME:-CROWNÉ Hair by Netty}"

read -r -p "Netty payment gateway origin (https://...): " PAYMENT_ORIGIN
read -r -p "Netty payment gateway host: " PAYMENT_HOST
read -r -s -p "Netty payment app/API key: " PAYMENT_KEY
echo

if [[ "$PAYMENT_ORIGIN" != https://* ]]; then
  echo "FAIL: payment gateway origin must use HTTPS" >&2
  exit 2
fi
if [ -z "$PAYMENT_HOST" ] || [ -z "$PAYMENT_KEY" ]; then
  echo "FAIL: Netty merchant gateway host/key are required" >&2
  exit 2
fi

umask 027
tmp="$(mktemp)"
cat >"$tmp" <<EOF
CROWNE_MERCHANT_NAME=$MERCHANT_NAME
CROWNE_PAYMENT_ORIGIN=$PAYMENT_ORIGIN
CROWNE_PAYMENT_HOST=$PAYMENT_HOST
CROWNE_PAYMENT_APP_KEY=$PAYMENT_KEY
CROWNE_HAIR_DIRECT_CHECKOUT=false
EOF
chown root:izakhono "$tmp"
chmod 0640 "$tmp"
mv "$tmp" "$HAIR_ENV"

echo
echo "Saved Netty-only merchant configuration."
echo "Direct checkout remains OFF until supplier stock, final prices, delivery and an end-to-end payment test are verified."
echo "No IZAKHONO PAY credentials were read, copied or changed."
