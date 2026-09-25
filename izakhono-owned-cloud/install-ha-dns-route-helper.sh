#!/usr/bin/env bash
set -euo pipefail
if [ "${EUID:-$(id -u)}" -ne 0 ]; then exec sudo bash "$0" "$@"; fi
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
install -d -m 0750 -o root -g izakhono-dns /opt/izakhono-owned-cloud
install -m 0750 -o root -g izakhono-dns "$HERE/ha-dns-switch-local.mjs" /opt/izakhono-owned-cloud/ha-dns-switch-local.mjs
install -d -m 0750 -o izakhono-dns -g izakhono-dns /var/lib/izakhono-dns
echo "IZAKHONO HA DNS route helper installed."
