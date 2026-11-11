#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then exec sudo -E bash "$0" "$@"; fi
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE="$(command -v node || true)"
[[ -n "$NODE" ]] || { echo "Node.js 22.13+ required"; exit 2; }
"$NODE" -e 'const [a,b]=process.versions.node.split(".").map(Number);if(a<22||(a===22&&b<13))process.exit(1)' || { echo "Node.js 22.13+ required"; exit 3; }
command -v systemd-run >/dev/null
command -v findmnt >/dev/null

useradd --system --home /nonexistent --shell /usr/sbin/nologin izakhono-build 2>/dev/null || true
BUILD_GROUP="$(id -gn izakhono-build)"

install -d -m 0755 /opt/izakhono-build-engine
install -d -o root -g "$BUILD_GROUP" -m 0750 /var/lib/izakhono-build-engine
install -d -o root -g "$BUILD_GROUP" -m 0750 /var/lib/izakhono-build-engine/receipts
install -d -o izakhono-build -g "$BUILD_GROUP" -m 0700 /var/tmp/izakhono-build-engine
install -d -o izakhono-build -g "$BUILD_GROUP" -m 0750 /var/cache/izakhono-build-engine/npm
install -d -m 0750 /etc/izakhono/build-engine

install -m 0644 "$ROOT/engine.mjs" /opt/izakhono-build-engine/engine.mjs
install -m 0644 "$ROOT/backup-five.mjs" /opt/izakhono-build-engine/backup-five.mjs
install -m 0644 "$ROOT/package.json" /opt/izakhono-build-engine/package.json
install -m 0644 "$ROOT/config/five-backups.example.json" /etc/izakhono/build-engine/five-backups.example.json

if [[ ! -f /etc/izakhono/build-engine/five-backups.json ]]; then
  install -m 0600 "$ROOT/config/five-backups.example.json" /etc/izakhono/build-engine/five-backups.json
fi

echo "IZAKHONO_BUILD_ENGINE=INSTALLED"
echo "BUILD_AUTHORITY=IZAKHONO_NODE01"
echo "SANDBOX_IDENTITY=izakhono-build"
echo "RUNTIME_AUTHORITY=IZAKHONO_OWNED_RUNTIME"
echo "EXTERNAL_BUILD_PROVIDER_REQUIRED=false"

if [[ -f "$ROOT/../izakhono-owned-cloud/configure-build-engine-backup.sh" ]]; then
  bash "$ROOT/../izakhono-owned-cloud/configure-build-engine-backup.sh"
fi

echo "NEXT=mount five independent backup targets and configure /etc/izakhono/backup-node.env"
