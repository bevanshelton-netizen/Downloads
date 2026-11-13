#!/usr/bin/env bash
# Safe monorepo Ignore Build Step.
# Vercel convention: exit 0 = skip deployment; exit 1 = run deployment.
# Only KORA Network is path-filtered here. Other linked projects always build
# until their own root-directory/path maps have been independently verified.
set -u

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "Build filter: repository root unavailable; run the build."
  exit 1
}
cd "$ROOT" || exit 1

KORA_PROJECT_ID="prj_hnGyTVKjP7GzAlAAA4LmEQ2BdgEZ"
if [ "${VERCEL_PROJECT_ID:-}" != "$KORA_PROJECT_ID" ]; then
  echo "Build filter: project path map not verified for this project; run the build."
  exit 1
fi

PREVIOUS="${VERCEL_GIT_PREVIOUS_SHA:-}"
CURRENT="${VERCEL_GIT_COMMIT_SHA:-HEAD}"

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

# Only ignore when Git proves that neither KORA nor the shared filter changed.
if git diff --quiet "$PREVIOUS" "$CURRENT" -- kora-network scripts/vercel-ignore-build.sh; then
  echo "KORA build filter: no KORA app or filter changes; skip deployment."
  exit 0
else
  status=$?
  if [ "$status" -eq 1 ]; then
    echo "KORA build filter: relevant KORA changes detected; run deployment."
    exit 1
  fi
  echo "KORA build filter: diff could not be evaluated safely; run the build."
  exit 1
fi
