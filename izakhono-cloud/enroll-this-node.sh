#!/usr/bin/env bash
set -euo pipefail
umask 077

if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then exec sudo -E bash "$0" "$@"; fi
  echo "ERROR: run as root or with sudo." >&2
  exit 1
fi

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
TOOL=${IZAKHONO_MULTINODE_TOOL:-${SCRIPT_DIR}/multinode.py}
STATE_DIR=${IZAKHONO_NODE_STATE_DIR:-/var/lib/izakhono-cloud/node}
PROOF_DIR=${IZAKHONO_PROOF_STATE_DIR:-/var/lib/izakhono-cloud}
OUTPUT=${IZAKHONO_ENROLLMENT_OUTPUT:-/root/izakhono-node-enrollment.json}

[ -f "$TOOL" ] || { echo "ERROR: multinode.py not found at $TOOL" >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "ERROR: python3 is required" >&2; exit 1; }
command -v openssl >/dev/null 2>&1 || { echo "ERROR: openssl is required" >&2; exit 1; }

if [ ! -f "$PROOF_DIR/READY" ] && [ ! -f "$PROOF_DIR/LOCAL_READY" ]; then
  echo "ERROR: node has not produced READY or LOCAL_READY; enrollment is blocked." >&2
  exit 1
fi

python3 "$TOOL" init --state-dir "$STATE_DIR"
python3 "$TOOL" export --state-dir "$STATE_DIR" --proof-state-dir "$PROOF_DIR" --output "$OUTPUT"
chmod 600 "$OUTPUT"

echo "IZAKHONO node enrollment bundle created: $OUTPUT"
echo "This file contains a public identity and signature only; the node private key remains on this machine."
echo "The node is still candidate-only and not schedulable or public-ready."
