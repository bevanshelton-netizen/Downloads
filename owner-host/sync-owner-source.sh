#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo -E bash "$0" "$@"
fi

ROOT="${1:-${IZAKHONO_OWNER_AGENT_ROOT:-/opt/izakhono-source/Downloads}}"
SOURCE_ENV="${IZAKHONO_CODE_SOURCE_ENV:-/etc/izakhono/code-source.env}"
CODE_HEALTH="${IZAKHONO_CODE_HEALTH_URL:-http://127.0.0.1:8860/health}"
CONTROL_PATH="${IZAKHONO_CONTROL_PATH:-owner-host/control/desired-state.json}"
ALLOW_GITHUB_FALLBACK="${IZAKHONO_ALLOW_GITHUB_BOOTSTRAP:-1}"
RESEED_CODE="${IZAKHONO_RESEED_CODE_AFTER_FALLBACK:-1}"

fail(){ echo "FAIL: $*" >&2; exit 2; }
need(){ command -v "$1" >/dev/null 2>&1 || fail "$1 is required"; }
for c in git curl node; do need "$c"; done
[ -d "$ROOT/.git" ] || fail "Owner source checkout missing: $ROOT"

if [ -n "$(git -C "$ROOT" status --porcelain)" ]; then
  echo "SOURCE_AUTHORITY=BLOCKED_DIRTY"
  echo "SOURCE_COMMIT=$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || true)"
  exit 3
fi

sync_owned_code(){
  [ -f "$SOURCE_ENV" ] || return 10
  curl -fsS --max-time 2 "$CODE_HEALTH" >/dev/null 2>&1 || return 11

  local repo_url repo_token auth
  repo_url="$(awk -F= '$1=="IZAKHONO_CODE_REPO_URL"{sub(/^[^=]*=/,"");print;exit}' "$SOURCE_ENV")"
  repo_token="$(awk -F= '$1=="IZAKHONO_CODE_REPO_TOKEN"{sub(/^[^=]*=/,"");print;exit}' "$SOURCE_ENV")"
  [ -n "$repo_url" ] || return 12
  case "$repo_url" in
    http://127.0.0.1:8860/git/*) ;;
    *) echo "Refusing non-owned CODE source: $repo_url" >&2; return 13 ;;
  esac
  [ -n "$repo_token" ] || return 14
  auth="$(node -e 'process.stdout.write(Buffer.from("git:"+process.argv[1]).toString("base64"))' "$repo_token")"

  git -C "$ROOT" -c "http.extraHeader=Authorization: Basic $auth" fetch --quiet "$repo_url" main:refs/remotes/izakhono/main
  git -C "$ROOT" show "refs/remotes/izakhono/main:$CONTROL_PATH" >/dev/null 2>&1 || return 15
  git -C "$ROOT" checkout -q main
  git -C "$ROOT" reset --hard -q refs/remotes/izakhono/main
  unset repo_token auth

  echo "SOURCE_AUTHORITY=IZAKHONO_CODE"
  echo "SOURCE_COMMIT=$(git -C "$ROOT" rev-parse HEAD)"
  echo "CONTROL_SOURCE=IZAKHONO_CODE"
  return 0
}

if sync_owned_code; then
  exit 0
fi

[ "$ALLOW_GITHUB_FALLBACK" = "1" ] || fail "IZAKHONO CODE unavailable and external bootstrap fallback is disabled."

REMOTE_URL="$(git -C "$ROOT" remote get-url origin 2>/dev/null || true)"
case "$REMOTE_URL" in
  https://github.com/bevanshelton-netizen/Downloads*|git@github.com:bevanshelton-netizen/Downloads*) ;;
  *) fail "Refusing unapproved bootstrap origin: $REMOTE_URL" ;;
esac

git -C "$ROOT" fetch --quiet origin main
git -C "$ROOT" show "origin/main:$CONTROL_PATH" >/dev/null 2>&1 || fail "Control document missing on bootstrap origin/main"
git -C "$ROOT" checkout -q main
git -C "$ROOT" reset --hard -q origin/main

echo "SOURCE_AUTHORITY=GITHUB_BOOTSTRAP"
echo "SOURCE_COMMIT=$(git -C "$ROOT" rev-parse HEAD)"
echo "CONTROL_SOURCE=GITHUB_BOOTSTRAP"

if [ "$RESEED_CODE" = "1" ] && [ -x "$ROOT/izakhono-owned-cloud/migrate-source-to-code.sh" ]; then
  if curl -fsS --max-time 2 "$CODE_HEALTH" >/dev/null 2>&1; then
    if bash "$ROOT/izakhono-owned-cloud/migrate-source-to-code.sh" >/tmp/izakhono-code-reseed.log 2>&1; then
      echo "CODE_RESEED=SUCCESS"
    else
      echo "CODE_RESEED=FAILED_NON_BLOCKING"
    fi
  else
    echo "CODE_RESEED=SKIPPED_CODE_UNAVAILABLE"
  fi
fi
