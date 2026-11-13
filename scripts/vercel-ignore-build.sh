#!/usr/bin/env bash
# Vercel Ignore Build Step for the KORA app in this monorepo.
# Vercel convention: exit 0 = skip deployment; exit 1 = run deployment.
set -u

PREVIOUS="${VERCEL_GIT_PREVIOUS_SHA:-}"
CURRENT="${VERCEL_GIT_COMMIT_SHA:-HEAD}"
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "KORA build filter: repository root unavailable; run the build."
  exit 1
}
cd "$ROOT" || exit 1

# First deploys, missing refs and shallow-history cases must build rather than
# accidentally suppressing a required production deployment.
if [ -z "$PREVIOUS" ] || [ "$PREVIOUS" = "0000000000000000000000000000000000000000" ]; then
  echo "KORA build filter: no valid previous commit; run the build."
  exit 1
fi

if ! git cat-file -e "${PREVIOUS}^{commit}" 2>/dev/null; then
  echo "KORA build filter: previous commit is unavailable; run the build."
  exit 1
fi
if ! git cat-file -e "${CURRENT}^{commit}" 2>/dev/null; then
  echo "KORA build filter: current commit is unavailable; run the build."
  exit 1
fi

# Build when KORA application files or this shared build filter change.
# Ignore unrelated repository changes only when Git can prove no relevant
# paths changed. Any git error is fail-open to a build.
if git diff --quiet "$PREVIOUS" "$CURRENT" -- kora-network scripts; then
  echo "KORA build filter: no KORA or shared build-script changes; skip deployment."
  exit 0
else
  status=$?
  if [ "$status" -eq 1 ]; then
    echo "KORA build filter: KORA or shared build-script changes detected; run deployment."
    exit 1
  fi
  echo "KORA build filter: diff could not be evaluated safely; run the build."
  exit 1
fi
