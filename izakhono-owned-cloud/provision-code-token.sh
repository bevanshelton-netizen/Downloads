#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 5 ]; then
  echo "Usage: $0 <repo-slug> <read|write> <label> <app-env-file> <env-var-name> [expires-at]"
  exit 2
fi

REPO_SLUG="$1"
SCOPE="$2"
LABEL="$3"
APP_ENV="$4"
ENV_VAR="$5"
EXPIRES_AT="${6:-}"
CODE_ENV=/etc/izakhono/code-node.env

if ! [[ "$REPO_SLUG" =~ ^[a-z0-9][a-z0-9._-]{1,79}$ ]]; then
  echo "Invalid repository slug."
  exit 3
fi
if [ "$SCOPE" != "read" ] && [ "$SCOPE" != "write" ]; then
  echo "Scope must be read or write."
  exit 4
fi
if ! [[ "$ENV_VAR" =~ ^[A-Z][A-Z0-9_]{1,100}$ ]]; then
  echo "Invalid environment variable name."
  exit 5
fi
if [ ! -f "$CODE_ENV" ]; then
  echo "CODE NODE is not installed."
  exit 6
fi

ADMIN_KEY="$(sudo awk -F= '$1=="IZAKHONO_CODE_ADMIN_KEY" {sub(/^[^=]*=/,""); print; exit}' "$CODE_ENV")"
if [ -z "$ADMIN_KEY" ]; then
  echo "CODE admin key not found."
  exit 7
fi

TMP_RESPONSE="$(mktemp)"
PAYLOAD="$(SCOPE="$SCOPE" LABEL="$LABEL" EXPIRES_AT="$EXPIRES_AT" node -e '
  const out={scope:process.env.SCOPE,label:process.env.LABEL};
  if(process.env.EXPIRES_AT) out.expiresAt=process.env.EXPIRES_AT;
  process.stdout.write(JSON.stringify(out));
')"

HTTP_CODE="$(curl -sS -o "$TMP_RESPONSE" -w '%{http_code}'   -X POST "http://127.0.0.1:8860/v1/repos/$REPO_SLUG/tokens"   -H "content-type: application/json"   -H "x-izakhono-key: $ADMIN_KEY"   --data-binary "$PAYLOAD")"

unset ADMIN_KEY PAYLOAD

if [ "$HTTP_CODE" != "201" ]; then
  echo "CODE token provisioning failed with HTTP $HTTP_CODE."
  rm -f "$TMP_RESPONSE"
  exit 8
fi

TOKEN="$(node -e '
  const fs=require("fs");
  const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
  if(!p.value) process.exit(2);
  process.stdout.write(p.value);
' "$TMP_RESPONSE")"
rm -f "$TMP_RESPONSE"

if [ -z "$TOKEN" ]; then
  echo "CODE NODE did not return a token."
  exit 9
fi

sudo touch "$APP_ENV"
TMP="$(mktemp)"
sudo cat "$APP_ENV" >"$TMP" || true
grep -v "^$ENV_VAR=" "$TMP" | grep -v '^IZAKHONO_CODE_URL=' >"${TMP}.clean" || true
cat >>"${TMP}.clean" <<EOF
IZAKHONO_CODE_URL=http://127.0.0.1:8860
$ENV_VAR=$TOKEN
EOF
sudo install -o root -g izakhono -m 0640 "${TMP}.clean" "$APP_ENV"
rm -f "$TMP" "${TMP}.clean"
unset TOKEN

echo "CODE token provisioned for repository $REPO_SLUG."
echo "Token stored in $APP_ENV and not printed."
