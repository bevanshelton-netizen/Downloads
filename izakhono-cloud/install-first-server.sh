#!/usr/bin/env bash
set -euo pipefail

REPO_OWNER=${IZAKHONO_GITHUB_OWNER:-bevanshelton-netizen}
REPO_NAME=${IZAKHONO_GITHUB_REPO:-Downloads}
BRANCH=${IZAKHONO_GITHUB_BRANCH:-izakhono-cloud-v1-4}
BASE="https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/izakhono-cloud"
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
date -Is

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl unzip coreutils

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "$BASE/izakhono-cloud-v1.4-zero-touch.zip.b64" -o "$TMP/release.b64"
curl -fsSL "$BASE/izakhono-cloud-v1.4-zero-touch.zip.sha256" -o "$TMP/release.sha256"
base64 -d "$TMP/release.b64" > "$TMP/release.zip"
(
  cd "$TMP"
  sed 's#izakhono-cloud-v1.4-zero-touch.zip#release.zip#' release.sha256 | sha256sum -c -
)

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
  printf 'IZAKHONO CLOUD v1.4\nstatus=ready\ninstalled_at=%s\n' "$(date -Is)" > "$STATE_DIR/status"
  echo "=== IZAKHONO CLOUD FIRST SERVER: READY ==="
  echo "Owner credentials are stored at /root/izakhono-owner-credentials"
else
  rc=$?
  date -Is > "$STATE_DIR/FAILED"
  printf 'IZAKHONO CLOUD v1.4\nstatus=failed\nfailed_at=%s\nexit_code=%s\n' "$(date -Is)" "$rc" > "$STATE_DIR/status"
  echo "=== IZAKHONO CLOUD FIRST SERVER: FAILED CLOSED ===" >&2
  exit "$rc"
fi
