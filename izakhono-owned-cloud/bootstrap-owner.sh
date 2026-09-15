#!/usr/bin/env bash
set -euo pipefail

AUTH_ENV=/etc/izakhono/auth-node.env
if [ ! -f "$AUTH_ENV" ]; then
  echo "AUTH NODE is not installed."
  exit 2
fi

BOOTSTRAP_KEY="$(sudo awk -F= '$1=="IZAKHONO_AUTH_BOOTSTRAP_KEY" {sub(/^[^=]*=/,""); print; exit}' "$AUTH_ENV")"
if [ -z "$BOOTSTRAP_KEY" ]; then
  echo "Bootstrap key not found."
  exit 3
fi

read -r -p "Owner email: " OWNER_EMAIL
read -r -p "Display name: " DISPLAY_NAME
read -r -s -p "Owner password (12+ chars): " OWNER_PASSWORD
echo
read -r -s -p "Confirm password: " OWNER_PASSWORD_2
echo

if [ "$OWNER_PASSWORD" != "$OWNER_PASSWORD_2" ]; then
  echo "Passwords do not match."
  exit 4
fi

PAYLOAD="$(OWNER_EMAIL="$OWNER_EMAIL" DISPLAY_NAME="$DISPLAY_NAME" OWNER_PASSWORD="$OWNER_PASSWORD" node -e '
  process.stdout.write(JSON.stringify({
    email:process.env.OWNER_EMAIL,
    displayName:process.env.DISPLAY_NAME,
    password:process.env.OWNER_PASSWORD
  }))
')"

HTTP_CODE="$(curl -sS -o /tmp/izakhono-auth-bootstrap-response.json -w '%{http_code}'   -X POST http://127.0.0.1:8820/v1/bootstrap   -H "content-type: application/json"   -H "x-bootstrap-key: $BOOTSTRAP_KEY"   --data-binary "$PAYLOAD")"

unset OWNER_PASSWORD OWNER_PASSWORD_2 BOOTSTRAP_KEY PAYLOAD

if [ "$HTTP_CODE" != "201" ]; then
  echo "Bootstrap failed with HTTP $HTTP_CODE"
  cat /tmp/izakhono-auth-bootstrap-response.json
  rm -f /tmp/izakhono-auth-bootstrap-response.json
  exit 5
fi

rm -f /tmp/izakhono-auth-bootstrap-response.json
echo "IZAKHONO AUTH owner created successfully."
echo "Sign in and enable TOTP MFA immediately."
