#!/usr/bin/env bash
set -euo pipefail

REPO_OWNER=${IZAKHONO_GITHUB_OWNER:-bevanshelton-netizen}
REPO_NAME=${IZAKHONO_GITHUB_REPO:-Downloads}
RELEASE_REF=${IZAKHONO_RELEASE_REF:-50ff6ed54d2f4d2760209c8c88669d0af8928661}
BASE="https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${RELEASE_REF}/izakhono-cloud"
RELEASE_BASE="${BASE}/release/v1.4"
INSTALL_DIR=${IZAKHONO_INSTALL_DIR:-/opt/izakhono-cloud}
STATE_DIR=/var/lib/izakhono-cloud
LOG=/var/log/izakhono-cloud-bootstrap.log

if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then exec sudo -E bash "$0" "$@"; fi
  echo "ERROR: run as root or with sudo." >&2; exit 1
fi

mkdir -p "$STATE_DIR" "$INSTALL_DIR"
chmod 700 "$STATE_DIR"
rm -f "$STATE_DIR/READY" "$STATE_DIR/FAILED"

exec > >(tee -a "$LOG") 2>&1

echo "=== IZAKHONO CLOUD v1.4 zero-touch install ==="
echo "Release ref: ${RELEASE_REF}"
date -Is

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl unzip coreutils

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

: > "$TMP/release.b64"
for part in 00 01 02 03 04 05 06 07; do
  echo "Downloading verified release part ${part}..."
  curl -fsSL "${RELEASE_BASE}/part${part}.b64" -o "$TMP/part${part}.b64"
  cat "$TMP/part${part}.b64" >> "$TMP/release.b64"
done
curl -fsSL "${RELEASE_BASE}/izakhono-cloud-v1.4-zero-touch.zip.sha256" -o "$TMP/release.sha256"

base64 -d "$TMP/release.b64" > "$TMP/release.zip"
EXPECTED_SHA=$(awk 'NR==1 {print $1}' "$TMP/release.sha256")
ACTUAL_SHA=$(sha256sum "$TMP/release.zip" | awk '{print $1}')
if [ -z "$EXPECTED_SHA" ] || [ "$ACTUAL_SHA" != "$EXPECTED_SHA" ]; then
  echo "ERROR: IZAKHONO release checksum verification failed." >&2
  echo "Expected: ${EXPECTED_SHA:-missing}" >&2
  echo "Actual:   ${ACTUAL_SHA:-missing}" >&2
  exit 1
fi

echo "Release checksum verified: ${ACTUAL_SHA}"

rm -rf "${INSTALL_DIR:?}"/*
unzip -q "$TMP/release.zip" -d "$TMP/unpacked"
SRC="$TMP/unpacked/izakhono-cloud-v1.4-zero-touch"
[ -d "$SRC" ] || { echo "ERROR: release root missing" >&2; exit 1; }
cp -a "$SRC"/. "$INSTALL_DIR"/
cd "$INSTALL_DIR"
chmod +x ./*.sh 2>/dev/null || true

if ./bootstrap-ubuntu.sh && ./production-proof.sh; then
  cp .owner-credentials /root/izakhono-owner-credentials
  chmod 600 /root/izakhono-owner-credentials
  date -Is > "$STATE_DIR/READY"
  printf 'IZAKHONO CLOUD v1.4\nstatus=ready\nrelease_ref=%s\nrelease_sha256=%s\ninstalled_at=%s\n' "$RELEASE_REF" "$ACTUAL_SHA" "$(date -Is)" > "$STATE_DIR/status"
  echo "=== IZAKHONO CLOUD FIRST SERVER: READY ==="
  echo "Owner credentials are stored at /root/izakhono-owner-credentials"
else
  rc=$?
  date -Is > "$STATE_DIR/FAILED"
  printf 'IZAKHONO CLOUD v1.4\nstatus=failed\nrelease_ref=%s\nrelease_sha256=%s\nfailed_at=%s\nexit_code=%s\n' "$RELEASE_REF" "$ACTUAL_SHA" "$(date -Is)" "$rc" > "$STATE_DIR/status"
  echo "=== IZAKHONO CLOUD FIRST SERVER: FAILED CLOSED ===" >&2
  exit "$rc"
fi
