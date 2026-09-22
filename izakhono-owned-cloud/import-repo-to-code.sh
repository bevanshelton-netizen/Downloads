#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo bash "$0" "$@"
fi

REPO_SLUG="${1:-}"
SOURCE_URL="${2:-}"
OUT_ENV="${3:-}"
CODE_URL="${IZAKHONO_CODE_URL:-http://127.0.0.1:8860}"
CODE_ENV="${IZAKHONO_CODE_ENV:-/etc/izakhono/code-node.env}"

fail(){ echo "FAIL: $*" >&2; exit 2; }
need(){ command -v "$1" >/dev/null 2>&1 || fail "$1 is required"; }

[[ "$REPO_SLUG" =~ ^[a-z0-9][a-z0-9-]{0,62}$ ]] || fail "invalid repository slug"
[[ "$SOURCE_URL" =~ ^https://github.com/[^/]+/[^/]+\.git$ ]] || fail "source must be an approved GitHub HTTPS repository URL"
[ -n "$OUT_ENV" ] || fail "output env path is required"

for cmd in git curl node; do need "$cmd"; done
[ -f "$CODE_ENV" ] || fail "IZAKHONO CODE NODE is not installed"
curl -fsS "$CODE_URL/health" >/dev/null || fail "IZAKHONO CODE NODE is not healthy"

ADMIN_KEY="$(awk -F= '$1=="IZAKHONO_CODE_ADMIN_KEY"{sub(/^[^=]*=/,"");print;exit}' "$CODE_ENV")"
[ -n "$ADMIN_KEY" ] || fail "CODE admin key is unavailable"
OLD_READ_ID=""
if [ -f "$OUT_ENV" ]; then
  OLD_READ_ID="$(awk -F= '$1=="IZAKHONO_CODE_REPO_TOKEN_ID"{sub(/^[^=]*=/,"");print;exit}' "$OUT_ENV" 2>/dev/null || true)"
fi

TMP="$(mktemp -d)"
WRITE_ID=""
cleanup(){
  if [ -n "$WRITE_ID" ]; then
    curl -fsS -X POST -H "content-type: application/json" -H "x-izakhono-key: $ADMIN_KEY" --data '{}'       "$CODE_URL/v1/repos/$REPO_SLUG/tokens/$WRITE_ID/revoke" >/dev/null 2>&1 || true
  fi
  unset ADMIN_KEY WRITE_TOKEN READ_TOKEN BASIC_WRITE BASIC_READ
  rm -rf "$TMP"
}
trap cleanup EXIT

CREATE_BODY="$(node -e 'process.stdout.write(JSON.stringify({slug:process.argv[1],description:"IZAKHONO owned mirrored application source",publicRead:false}))' "$REPO_SLUG")"
CREATE_STATUS="$(curl -sS -o "$TMP/create.json" -w '%{http_code}' -X POST   -H "content-type: application/json" -H "x-izakhono-key: $ADMIN_KEY"   --data-binary "$CREATE_BODY" "$CODE_URL/v1/repos")"
if [ "$CREATE_STATUS" != "201" ] && [ "$CREATE_STATUS" != "409" ]; then
  fail "CODE repository creation failed with HTTP $CREATE_STATUS"
fi

issue_token(){
  local scope="$1" label="$2" file="$3"
  local status
  status="$(curl -sS -o "$file" -w '%{http_code}' -X POST     -H "content-type: application/json" -H "x-izakhono-key: $ADMIN_KEY"     --data-binary "$(node -e 'process.stdout.write(JSON.stringify({scope:process.argv[1],label:process.argv[2]}))' "$scope" "$label")"     "$CODE_URL/v1/repos/$REPO_SLUG/tokens")"
  [ "$status" = "201" ] || fail "CODE token issue failed for $scope with HTTP $status"
}

issue_token write import-writer "$TMP/write.json"
WRITE_TOKEN="$(node -e 'const x=require(process.argv[1]);if(!x.value||!x.token?.id)process.exit(2);process.stdout.write(x.value)' "$TMP/write.json")"
WRITE_ID="$(node -e 'const x=require(process.argv[1]);process.stdout.write(x.token.id)' "$TMP/write.json")"
BASIC_WRITE="$(node -e 'process.stdout.write(Buffer.from("git:"+process.argv[1]).toString("base64"))' "$WRITE_TOKEN")"
GIT_URL="$CODE_URL/git/$REPO_SLUG.git"

echo "Mirroring approved source into IZAKHONO CODE..."
git clone --mirror "$SOURCE_URL" "$TMP/source.git" >/dev/null 2>&1
git -C "$TMP/source.git" -c "http.extraHeader=Authorization: Basic $BASIC_WRITE" push --mirror "$GIT_URL" >/dev/null 2>&1

curl -fsS -X POST -H "content-type: application/json" -H "x-izakhono-key: $ADMIN_KEY" --data '{}'   "$CODE_URL/v1/repos/$REPO_SLUG/tokens/$WRITE_ID/revoke" >/dev/null
WRITE_ID=""
unset WRITE_TOKEN BASIC_WRITE

if [ -n "$OLD_READ_ID" ]; then
  curl -fsS -X POST -H "content-type: application/json" -H "x-izakhono-key: $ADMIN_KEY" --data '{}'     "$CODE_URL/v1/repos/$REPO_SLUG/tokens/$OLD_READ_ID/revoke" >/dev/null 2>&1 || true
fi
issue_token read deployment-reader "$TMP/read.json"
READ_TOKEN="$(node -e 'const x=require(process.argv[1]);if(!x.value||!x.token?.id)process.exit(2);process.stdout.write(x.value)' "$TMP/read.json")"
READ_ID="$(node -e 'const x=require(process.argv[1]);process.stdout.write(x.token.id)' "$TMP/read.json")"
BASIC_READ="$(node -e 'process.stdout.write(Buffer.from("git:"+process.argv[1]).toString("base64"))' "$READ_TOKEN")"
git -c "http.extraHeader=Authorization: Basic $BASIC_READ" ls-remote "$GIT_URL" refs/heads/main | grep -q 'refs/heads/main'   || fail "Owned CODE verification failed: main branch unavailable"

mkdir -p "$(dirname "$OUT_ENV")"
TMP_ENV="$TMP/source.env"
cat > "$TMP_ENV" <<EOF
IZAKHONO_CODE_REPO_URL=$GIT_URL
IZAKHONO_CODE_REPO_TOKEN=$READ_TOKEN
IZAKHONO_CODE_REPO_TOKEN_ID=$READ_ID
IZAKHONO_CODE_REPO_SLUG=$REPO_SLUG
IZAKHONO_APPROVED_EXTERNAL_FALLBACK=$SOURCE_URL
EOF
install -o root -g izakhono -m 0640 "$TMP_ENV" "$OUT_ENV"
unset READ_TOKEN READ_ID BASIC_READ

echo "IZAKHONO CODE mirror ready."
echo "Owned repository: $GIT_URL"
echo "Deployment credentials stored in: $OUT_ENV"
echo "External source retained only as rollback/resync source."
