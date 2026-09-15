#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo bash "$0" "$@"
fi

for cmd in git curl node; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "$cmd is required."; exit 2; }
done

CODE_ENV=/etc/izakhono/code-node.env
OUT_ENV=/etc/izakhono/code-source.env
SOURCE_URL="${IZAKHONO_BOOTSTRAP_SOURCE_URL:-https://github.com/bevanshelton-netizen/Downloads.git}"
REPO_SLUG="${IZAKHONO_OWNED_REPO_SLUG:-izakhono-platform}"
CODE_URL="http://127.0.0.1:8860"
GIT_URL="$CODE_URL/git/$REPO_SLUG.git"

[ -f "$CODE_ENV" ] || { echo "IZAKHONO CODE NODE is not installed."; exit 3; }
curl -fsS "$CODE_URL/health" >/dev/null || { echo "IZAKHONO CODE NODE is not healthy."; exit 4; }

ADMIN_KEY="$(awk -F= '$1=="IZAKHONO_CODE_ADMIN_KEY"{sub(/^[^=]*=/,"");print;exit}' "$CODE_ENV")"
[ -n "$ADMIN_KEY" ] || { echo "CODE admin key is unavailable."; exit 5; }

TMP="$(mktemp -d)"
WRITE_ID=""
cleanup(){
  if [ -n "$WRITE_ID" ]; then
    curl -fsS -X POST       -H "content-type: application/json"       -H "x-izakhono-key: $ADMIN_KEY"       --data '{}'       "$CODE_URL/v1/repos/$REPO_SLUG/tokens/$WRITE_ID/revoke" >/dev/null 2>&1 || true
  fi
  unset ADMIN_KEY WRITE_TOKEN READ_TOKEN BASIC_WRITE BASIC_READ
  rm -rf "$TMP"
}
trap cleanup EXIT

CREATE_BODY="$(node -e 'process.stdout.write(JSON.stringify({slug:process.argv[1],description:"IZAKHONO owned platform source",publicRead:false}))' "$REPO_SLUG")"
CREATE_STATUS="$(curl -sS -o "$TMP/create.json" -w '%{http_code}' -X POST   -H "content-type: application/json"   -H "x-izakhono-key: $ADMIN_KEY"   --data-binary "$CREATE_BODY" "$CODE_URL/v1/repos")"
if [ "$CREATE_STATUS" != "201" ] && [ "$CREATE_STATUS" != "409" ]; then
  echo "CODE repository creation failed with HTTP $CREATE_STATUS."
  exit 6
fi

issue_token(){
  local scope="$1"
  local label="$2"
  local file="$3"
  local status
  status="$(curl -sS -o "$file" -w '%{http_code}' -X POST     -H "content-type: application/json"     -H "x-izakhono-key: $ADMIN_KEY"     --data-binary "$(node -e 'process.stdout.write(JSON.stringify({scope:process.argv[1],label:process.argv[2]}))' "$scope" "$label")"     "$CODE_URL/v1/repos/$REPO_SLUG/tokens")"
  [ "$status" = "201" ] || { echo "CODE token issue failed for $scope with HTTP $status."; exit 7; }
}

issue_token write migration-writer "$TMP/write.json"
WRITE_TOKEN="$(node -e 'const x=require(process.argv[1]); if(!x.value||!x.token?.id)process.exit(2); process.stdout.write(x.value)' "$TMP/write.json")"
WRITE_ID="$(node -e 'const x=require(process.argv[1]); process.stdout.write(x.token.id)' "$TMP/write.json")"
BASIC_WRITE="$(node -e 'process.stdout.write(Buffer.from("git:"+process.argv[1]).toString("base64"))' "$WRITE_TOKEN")"

echo "Mirroring bootstrap source into IZAKHONO CODE..."
git clone --mirror "$SOURCE_URL" "$TMP/source.git" >/dev/null 2>&1
git -C "$TMP/source.git" -c "http.extraHeader=Authorization: Basic $BASIC_WRITE" push --mirror "$GIT_URL" >/dev/null 2>&1

curl -fsS -X POST   -H "content-type: application/json"   -H "x-izakhono-key: $ADMIN_KEY"   --data '{}'   "$CODE_URL/v1/repos/$REPO_SLUG/tokens/$WRITE_ID/revoke" >/dev/null
WRITE_ID=""
unset WRITE_TOKEN BASIC_WRITE

issue_token read deployment-reader "$TMP/read.json"
READ_TOKEN="$(node -e 'const x=require(process.argv[1]); if(!x.value)process.exit(2); process.stdout.write(x.value)' "$TMP/read.json")"
BASIC_READ="$(node -e 'process.stdout.write(Buffer.from("git:"+process.argv[1]).toString("base64"))' "$READ_TOKEN")"

git -c "http.extraHeader=Authorization: Basic $BASIC_READ" ls-remote "$GIT_URL" refs/heads/main | grep -q 'refs/heads/main'   || { echo "Owned CODE verification failed: main branch unavailable."; exit 8; }

mkdir -p /etc/izakhono
TMP_ENV="$TMP/code-source.env"
cat >"$TMP_ENV" <<EOF
IZAKHONO_CODE_REPO_URL=$GIT_URL
IZAKHONO_CODE_REPO_TOKEN=$READ_TOKEN
IZAKHONO_CODE_REPO_SLUG=$REPO_SLUG
EOF
install -o root -g izakhono -m 0640 "$TMP_ENV" "$OUT_ENV"
unset READ_TOKEN BASIC_READ

echo "IZAKHONO source migration complete."
echo "Owned repository: $GIT_URL"
echo "Temporary migration write token revoked."
echo "Persistent deployment read token stored in $OUT_ENV and not printed."
