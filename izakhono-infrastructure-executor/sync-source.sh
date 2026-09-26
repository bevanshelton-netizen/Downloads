#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo -E bash "$0" "$@"
fi

ROOT="${IZAKHONO_INFRA_SOURCE_ROOT:-/opt/izakhono-source/Downloads}"
SOURCE_ENV="${IZAKHONO_CODE_SOURCE_ENV:-/etc/izakhono/code-source.env}"
CODE_HEALTH="${IZAKHONO_CODE_HEALTH_URL:-http://127.0.0.1:8860/health}"
CONTROL_PATH="infrastructure/control/portfolio-desired-state.json"
ALLOW_EXTERNAL="${IZAKHONO_EXECUTOR_ALLOW_EXTERNAL_SOURCE_FALLBACK:-1}"

fail(){ echo "FAIL: $*" >&2; exit 2; }
for c in git curl node timeout; do command -v "$c" >/dev/null 2>&1 || fail "$c is required"; done
[ -d "$ROOT/.git" ] || fail "Infrastructure source checkout missing: $ROOT"

if [ -n "$(git -C "$ROOT" status --porcelain)" ]; then
  echo "SOURCE_AUTHORITY=BLOCKED_DIRTY"
  exit 3
fi

sync_code(){
  [ -s "$SOURCE_ENV" ] || return 10
  curl -fsS --max-time 2 "$CODE_HEALTH" >/dev/null 2>&1 || return 11
  local repo_url repo_token auth
  repo_url="$(awk -F= '$1=="IZAKHONO_CODE_REPO_URL"{sub(/^[^=]*=/,"");print;exit}' "$SOURCE_ENV")"
  repo_token="$(awk -F= '$1=="IZAKHONO_CODE_REPO_TOKEN"{sub(/^[^=]*=/,"");print;exit}' "$SOURCE_ENV")"
  case "$repo_url" in
    http://127.0.0.1:8860/git/*) ;;
    *) return 12 ;;
  esac
  [ -n "$repo_token" ] || return 13
  auth="$(node -e 'process.stdout.write(Buffer.from("git:"+process.argv[1]).toString("base64"))' "$repo_token")"
  git -C "$ROOT" -c "http.extraHeader=Authorization: Basic $auth" fetch --quiet "$repo_url" main:refs/remotes/izakhono/main
  git -C "$ROOT" show "refs/remotes/izakhono/main:$CONTROL_PATH" >/dev/null 2>&1 || return 14
  git -C "$ROOT" checkout -q main
  git -C "$ROOT" reset --hard -q refs/remotes/izakhono/main
  unset repo_token auth
  echo "SOURCE_AUTHORITY=IZAKHONO_CODE"
  echo "SOURCE_COMMIT=$(git -C "$ROOT" rev-parse HEAD)"
  return 0
}

if sync_code; then
  OWNED_COMMIT="$(git -C "$ROOT" rev-parse HEAD)"
  if [ "$ALLOW_EXTERNAL" = "1" ]; then
    remote="$(git -C "$ROOT" remote get-url origin 2>/dev/null || true)"
    case "$remote" in
      https://github.com/bevanshelton-netizen/Downloads*|git@github.com:bevanshelton-netizen/Downloads*)
        EXTERNAL_HEAD="$(timeout 8 git ls-remote "$remote" refs/heads/main 2>/dev/null | awk 'NR==1{print $1}')"
        if [ -n "$EXTERNAL_HEAD" ] && [ "$EXTERNAL_HEAD" != "$OWNED_COMMIT" ] && [ -x "$ROOT/izakhono-owned-cloud/migrate-source-to-code.sh" ]; then
          if bash "$ROOT/izakhono-owned-cloud/migrate-source-to-code.sh" >/var/tmp/izakhono-infrastructure-code-refresh.log 2>&1; then
            sync_code
            echo "CODE_REFRESH=IMPORTED_APPROVED_EXTERNAL_MIRROR"
          else
            echo "CODE_REFRESH=FAILED_NON_BLOCKING"
          fi
        else
          echo "CODE_REFRESH=UP_TO_DATE_OR_UNAVAILABLE"
        fi
        ;;
      *) echo "CODE_REFRESH=NO_APPROVED_EXTERNAL_MIRROR" ;;
    esac
  fi
  exit 0
fi
[ "$ALLOW_EXTERNAL" = "1" ] || fail "IZAKHONO CODE unavailable and external source fallback is disabled."

remote="$(git -C "$ROOT" remote get-url origin 2>/dev/null || true)"
case "$remote" in
  https://github.com/bevanshelton-netizen/Downloads*|git@github.com:bevanshelton-netizen/Downloads*) ;;
  *) fail "External fallback origin is not approved." ;;
esac

git -C "$ROOT" fetch --quiet origin main
git -C "$ROOT" show "origin/main:$CONTROL_PATH" >/dev/null 2>&1 || fail "Infrastructure control file missing on approved fallback source."
git -C "$ROOT" checkout -q main
git -C "$ROOT" reset --hard -q origin/main

echo "SOURCE_AUTHORITY=EXTERNAL_BOOTSTRAP_FALLBACK"
echo "SOURCE_COMMIT=$(git -C "$ROOT" rev-parse HEAD)"
echo "NOTE=External source is a replaceable bootstrap mirror; runtime authority remains IZAKHONO_INFRASTRUCTURE."
