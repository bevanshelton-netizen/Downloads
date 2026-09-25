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
EXTERNAL_REFRESH="${IZAKHONO_EXTERNAL_REFRESH:-1}"

fail(){ echo "FAIL: $*" >&2; exit 2; }
need(){ command -v "$1" >/dev/null 2>&1 || fail "$1 is required"; }
for c in git curl node timeout; do need "$c"; done
[ -d "$ROOT/.git" ] || fail "Owner source checkout missing: $ROOT"

if [ -n "$(git -C "$ROOT" status --porcelain)" ]; then
  echo "SOURCE_AUTHORITY=BLOCKED_DIRTY"
  echo "SOURCE_COMMIT=$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || true)"
  exit 3
fi

bootstrap_remote(){
  local remote
  remote="$(git -C "$ROOT" remote get-url origin 2>/dev/null || true)"
  case "$remote" in
    https://github.com/bevanshelton-netizen/Downloads*|git@github.com:bevanshelton-netizen/Downloads*)
      printf '%s' "$remote"
      ;;
    *)
      return 1
      ;;
  esac
}

OWNED_COMMIT=""
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
  OWNED_COMMIT="$(git -C "$ROOT" rev-parse HEAD)"
  unset repo_token auth
  return 0
}

refresh_owned_code_from_external(){
  [ "$EXTERNAL_REFRESH" = "1" ] || { echo "EXTERNAL_REFRESH=DISABLED"; return 0; }
  local remote external_head
  remote="$(bootstrap_remote)" || { echo "EXTERNAL_REFRESH=UNAPPROVED_BOOTSTRAP_REMOTE"; return 0; }
  external_head="$(timeout 8 git ls-remote "$remote" refs/heads/main 2>/dev/null | awk 'NR==1{print $1}')"
  if [ -z "$external_head" ]; then
    echo "EXTERNAL_REFRESH=UNAVAILABLE_NON_BLOCKING"
    return 0
  fi
  if [ "$external_head" = "$OWNED_COMMIT" ]; then
    echo "EXTERNAL_REFRESH=UP_TO_DATE"
    return 0
  fi
  if [ ! -x "$ROOT/izakhono-owned-cloud/migrate-source-to-code.sh" ]; then
    echo "EXTERNAL_REFRESH=NEWER_EXTERNAL_FOUND_MIGRATOR_MISSING"
    return 0
  fi
  if bash "$ROOT/izakhono-owned-cloud/migrate-source-to-code.sh" >/tmp/izakhono-code-refresh.log 2>&1; then
    sync_owned_code || fail "IZAKHONO CODE refresh succeeded but owned re-sync failed."
    echo "EXTERNAL_REFRESH=IMPORTED_TO_IZAKHONO_CODE"
    echo "BOOTSTRAP_SOURCE=GITHUB"
  else
    echo "EXTERNAL_REFRESH=FAILED_NON_BLOCKING"
  fi
}

if sync_owned_code; then
  refresh_owned_code_from_external
  echo "SOURCE_AUTHORITY=IZAKHONO_CODE"
  echo "SOURCE_COMMIT=$OWNED_COMMIT"
  echo "CONTROL_SOURCE=IZAKHONO_CODE"
  exit 0
fi

[ "$ALLOW_GITHUB_FALLBACK" = "1" ] || fail "IZAKHONO CODE unavailable and external bootstrap fallback is disabled."

REMOTE_URL="$(bootstrap_remote)" || fail "Refusing unapproved bootstrap origin."

git -C "$ROOT" fetch --quiet origin main
git -C "$ROOT" show "origin/main:$CONTROL_PATH" >/dev/null 2>&1 || fail "Control document missing on bootstrap origin/main"
git -C "$ROOT" checkout -q main
git -C "$ROOT" reset --hard -q origin/main
BOOTSTRAP_COMMIT="$(git -C "$ROOT" rev-parse HEAD)"

if [ "$RESEED_CODE" = "1" ] && [ -x "$ROOT/izakhono-owned-cloud/migrate-source-to-code.sh" ]; then
  if curl -fsS --max-time 2 "$CODE_HEALTH" >/dev/null 2>&1; then
    if bash "$ROOT/izakhono-owned-cloud/migrate-source-to-code.sh" >/tmp/izakhono-code-reseed.log 2>&1; then
      if sync_owned_code; then
        echo "CODE_RESEED=SUCCESS"
        echo "BOOTSTRAP_SOURCE=GITHUB"
        echo "SOURCE_AUTHORITY=IZAKHONO_CODE"
        echo "SOURCE_COMMIT=$OWNED_COMMIT"
        echo "CONTROL_SOURCE=IZAKHONO_CODE"
        exit 0
      fi
      echo "CODE_RESEED=SYNC_BACK_FAILED_NON_BLOCKING"
    else
      echo "CODE_RESEED=FAILED_NON_BLOCKING"
    fi
  else
    echo "CODE_RESEED=SKIPPED_CODE_UNAVAILABLE"
  fi
fi

echo "SOURCE_AUTHORITY=GITHUB_BOOTSTRAP"
echo "SOURCE_COMMIT=$BOOTSTRAP_COMMIT"
echo "CONTROL_SOURCE=GITHUB_BOOTSTRAP"
