#!/usr/bin/env bash
set -euo pipefail
[ "${EUID:-$(id -u)}" -eq 0 ] || exec sudo -E bash "$0" "$@"
REPO="${IZAKHONO_REPO:-https://github.com/bevanshelton-netizen/Downloads.git}"
ROOT=/opt/izakhono-source/Downloads
command -v git >/dev/null || { apt-get update; apt-get install -y git curl jq ca-certificates; }
id izakhono >/dev/null 2>&1 || useradd -m -s /bin/bash izakhono
install -d -o izakhono -g izakhono -m 0750 /opt/izakhono-source
if [ -d "$ROOT/.git" ]; then sudo -u izakhono git -C "$ROOT" fetch origin main && sudo -u izakhono git -C "$ROOT" reset --hard origin/main
else sudo -u izakhono git clone --depth 1 "$REPO" "$ROOT"; fi
test -f "$ROOT/IZAKHONO-INFRASTRUCTURE-AUTHORITY.json"
node -e 'const x=require(process.argv[1]);if(x.runtime_authority!=="IZAKHONO_INFRASTRUCTURE"||x.laptop?.runtime_dependency!==false)process.exit(2)' "$ROOT/IZAKHONO-INFRASTRUCTURE-AUTHORITY.json"
bash "$ROOT/izakhono-autonomy-engine/install-linux.sh"
echo "IZAKHONO_VM_ROLE=MANAGED_INFRASTRUCTURE"
echo "AUTONOMY_ENGINE=INSTALLED"
echo "LAPTOP_DEPENDENCY=false"
