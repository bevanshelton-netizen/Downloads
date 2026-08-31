#!/usr/bin/env bash
set -euo pipefail
umask 077

if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then exec sudo -E bash "$0" "$@"; fi
  echo "ERROR: run as root or with sudo." >&2
  exit 1
fi

SOURCE=${1:-}
TRUST_DIR=${IZAKHONO_CONTROL_TRUST_DIR:-/var/lib/izakhono-cloud/control/trust}
TARGET="$TRUST_DIR/controller-public.pem"
ID_FILE="$TRUST_DIR/controller-id"

[ -n "$SOURCE" ] || { echo "Usage: $0 /path/to/controller-public.pem" >&2; exit 2; }
[ -f "$SOURCE" ] || { echo "ERROR: controller public key not found: $SOURCE" >&2; exit 1; }
command -v openssl >/dev/null 2>&1 || { echo "ERROR: openssl is required" >&2; exit 1; }
command -v sha256sum >/dev/null 2>&1 || { echo "ERROR: sha256sum is required" >&2; exit 1; }

# Parse as a public key before trusting it.
openssl pkey -pubin -in "$SOURCE" -noout >/dev/null 2>&1 || {
  echo "ERROR: supplied controller key is not a valid public key" >&2
  exit 1
}

mkdir -p "$TRUST_DIR"
chmod 700 "$TRUST_DIR"

if [ -f "$TARGET" ]; then
  if cmp -s "$SOURCE" "$TARGET"; then
    echo "Controller key is already pinned."
  else
    echo "ERROR: a different controller key is already pinned." >&2
    echo "Refusing silent controller-key replacement. Remove the old pin only through an explicit owner maintenance procedure." >&2
    exit 1
  fi
else
  install -m 600 "$SOURCE" "$TARGET"
fi

FINGERPRINT=$(sha256sum "$TARGET" | awk '{print $1}')
CONTROLLER_ID="izc-${FINGERPRINT:0:24}"
printf '%s\n' "$CONTROLLER_ID" > "$ID_FILE"
chmod 600 "$ID_FILE"

echo "IZAKHONO controller trust pinned."
echo "controller_id=$CONTROLLER_ID"
echo "trust_path=$TARGET"
echo "No remote execution has been enabled."
