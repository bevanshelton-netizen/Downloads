#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then exec sudo -E bash "$0" "$@"; fi
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE="$(command -v node || true)"
[[ -n "$NODE" ]] || { echo "Node.js 22.13+ required"; exit 2; }
"$NODE" -e 'const [a,b]=process.versions.node.split(".").map(Number);if(a<22||(a===22&&b<13))process.exit(1)' || { echo "Node.js 22.13+ required"; exit 3; }
command -v systemd-run >/dev/null
command -v findmnt >/dev/null
id izakhono-ci >/dev/null 2>&1 || { echo "IZAKHONO CI sandbox user missing; install IZAKHONO CI WORKER first."; exit 4; }

install -d -m 0755 /opt/izakhono-build-engine /opt/izakhono-build-engine/config
install -d -o root -g izakhono -m 0750 /var/lib/izakhono-build-engine
install -d -o root -g izakhono -m 0750 /var/lib/izakhono-build-engine/work
install -d -o root -g izakhono -m 0750 /var/lib/izakhono-build-engine/receipts
install -d -o root -g izakhono -m 0750 /etc/izakhono/build-engine

install -m 0644 "$ROOT/engine.mjs" /opt/izakhono-build-engine/engine.mjs
install -m 0644 "$ROOT/backup-five.mjs" /opt/izakhono-build-engine/backup-five.mjs
install -m 0644 "$ROOT/package.json" /opt/izakhono-build-engine/package.json
install -m 0644 "$ROOT/config/five-backups.example.json" /etc/izakhono/build-engine/five-backups.example.json

if [[ ! -f /etc/izakhono/build-engine/five-backups.json ]]; then
  install -m 0600 "$ROOT/config/five-backups.example.json" /etc/izakhono/build-engine/five-backups.json
fi
if [[ ! -f /etc/izakhono/build-engine.env ]]; then
  install -m 0600 /dev/null /etc/izakhono/build-engine.env
fi

cat >/etc/sudoers.d/izakhono-build-engine <<'SUDOERS'
izakhono-ci ALL=(root) NOPASSWD: /usr/bin/systemd-run
SUDOERS
chmod 0440 /etc/sudoers.d/izakhono-build-engine
visudo -cf /etc/sudoers.d/izakhono-build-engine >/dev/null

echo "IZAKHONO_BUILD_ENGINE=INSTALLED"
echo "BUILD_AUTHORITY=IZAKHONO_NODE01"
echo "RUNTIME_AUTHORITY=IZAKHONO_OWNED_RUNTIME"
echo "EXTERNAL_BUILD_PROVIDER_REQUIRED=false"
echo "NEXT=configure five physical backup targets in /etc/izakhono/build-engine/five-backups.json"
