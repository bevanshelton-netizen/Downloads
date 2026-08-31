#!/usr/bin/env bash
set -euo pipefail
umask 077

if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then exec sudo -E bash "$0" "$@"; fi
  echo "ERROR: run as root or with sudo." >&2
  exit 1
fi

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 /path/to/izakhono-node-enrollment.json" >&2
  exit 2
fi

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
TOOL=${IZAKHONO_MULTINODE_TOOL:-${SCRIPT_DIR}/multinode.py}
REGISTRY_DIR=${IZAKHONO_REGISTRY_DIR:-/var/lib/izakhono-cloud/registry}
BUNDLE=$1

[ -f "$TOOL" ] || { echo "ERROR: multinode.py not found at $TOOL" >&2; exit 1; }
[ -f "$BUNDLE" ] || { echo "ERROR: enrollment bundle not found: $BUNDLE" >&2; exit 1; }

python3 "$TOOL" verify "$BUNDLE"
python3 "$TOOL" register "$BUNDLE" --registry-dir "$REGISTRY_DIR"

echo "Candidate registered. No workload will be scheduled by v1.6."
