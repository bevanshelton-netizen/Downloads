#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel)"
BASE="${VERCEL_GIT_PREVIOUS_SHA:-}"
HEAD_SHA="${VERCEL_GIT_COMMIT_SHA:-HEAD}"

# Fail open to a real build if Vercel has not supplied a usable comparison.
if [[ -z "$BASE" ]] || ! git -C "$ROOT" cat-file -e "$BASE^{commit}" 2>/dev/null; then
  echo "BUILD_REQUIRED=NO_BASE_COMMIT"
  exit 1
fi
if ! git -C "$ROOT" cat-file -e "$HEAD_SHA^{commit}" 2>/dev/null; then
  echo "BUILD_REQUIRED=NO_HEAD_COMMIT"
  exit 1
fi

NON_INFRA="$(git -C "$ROOT" diff --name-only "$BASE" "$HEAD_SHA" | grep -Ev '^(izakhono-build-engine/|izakhono-owned-cloud/|izakhono-backup-node/|izakhono-replica-node/|izakhono-node01/|scripts/vercel-ignore-build\.sh$|\.github/workflows/izakhono-build-engine-acceptance\.yml$)' || true)"
if [[ -n "$NON_INFRA" ]]; then
  echo "BUILD_REQUIRED=APPLICATION_SOURCE_CHANGED"
  printf '%s\n' "$NON_INFRA"
  exit 1
fi

echo "BUILD_SKIPPED=INFRASTRUCTURE_ONLY_CHANGE"
exit 0
