#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 3 ]; then
  echo "Usage: $0 <client-name> <app-env-file> <model-alias> [daily-requests] [daily-tokens]"
  exit 2
fi

CLIENT_NAME="$1"
APP_ENV="$2"
MODEL_ALIAS="$3"
DAILY_REQUESTS="${4:-1000}"
DAILY_TOKENS="${5:-1000000}"
GATEWAY_ENV=/etc/izakhono/ai-gateway-node.env

if ! [[ "$CLIENT_NAME" =~ ^[a-z0-9][a-z0-9._:-]{1,100}$ ]]; then
  echo "Invalid client name."
  exit 3
fi

if [ ! -f "$GATEWAY_ENV" ]; then
  echo "AI GATEWAY NODE is not installed."
  exit 4
fi

ADMIN_KEY="$(sudo awk -F= '$1=="IZAKHONO_AI_GATEWAY_ADMIN_KEY" {sub(/^[^=]*=/,""); print; exit}' "$GATEWAY_ENV")"
if [ -z "$ADMIN_KEY" ]; then
  echo "AI Gateway admin key not found."
  exit 5
fi

TMP_RESPONSE="$(mktemp)"
PAYLOAD="$(CLIENT_NAME="$CLIENT_NAME" MODEL_ALIAS="$MODEL_ALIAS" DAILY_REQUESTS="$DAILY_REQUESTS" DAILY_TOKENS="$DAILY_TOKENS" node -e '
  process.stdout.write(JSON.stringify({
    name:process.env.CLIENT_NAME,
    allowedAliases:[process.env.MODEL_ALIAS],
    dailyRequests:Number(process.env.DAILY_REQUESTS),
    dailyTokens:Number(process.env.DAILY_TOKENS)
  }))
')"

HTTP_CODE="$(curl -sS -o "$TMP_RESPONSE" -w '%{http_code}'   -X POST http://127.0.0.1:8850/v1/admin/clients   -H "content-type: application/json"   -H "x-izakhono-key: $ADMIN_KEY"   --data-binary "$PAYLOAD")"

unset ADMIN_KEY PAYLOAD

if [ "$HTTP_CODE" != "201" ]; then
  echo "AI client provisioning failed with HTTP $HTTP_CODE."
  echo "If this client name already exists, do not create a second secret blindly; rotate/reissue it through the gateway admin workflow."
  rm -f "$TMP_RESPONSE"
  exit 6
fi

API_KEY="$(node -e '
  const fs=require("fs");
  const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
  if(!p.apiKey) process.exit(2);
  process.stdout.write(p.apiKey);
' "$TMP_RESPONSE")"
rm -f "$TMP_RESPONSE"

if [ -z "$API_KEY" ]; then
  echo "Gateway did not return a client key."
  exit 7
fi

sudo touch "$APP_ENV"
sudo chmod 0640 "$APP_ENV"
TMP="$(mktemp)"
sudo cat "$APP_ENV" >"$TMP" || true
grep -v '^IZAKHONO_AI_GATEWAY_URL=' "$TMP" | grep -v '^IZAKHONO_AI_GATEWAY_KEY=' >"${TMP}.clean" || true
cat >>"${TMP}.clean" <<EOF
IZAKHONO_AI_GATEWAY_URL=http://127.0.0.1:8850
IZAKHONO_AI_GATEWAY_KEY=$API_KEY
EOF
sudo install -o root -g izakhono -m 0640 "${TMP}.clean" "$APP_ENV"
rm -f "$TMP" "${TMP}.clean"
unset API_KEY

echo "AI Gateway client provisioned for $CLIENT_NAME."
echo "Key stored in $APP_ENV and not printed."
