#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then exec sudo -E bash "$0" "$@"; fi
  echo "ERROR: run as root or with sudo." >&2; exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl gnupg ufw python3

if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  ARCH=$(dpkg --print-architecture)
  echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

ufw allow OpenSSH >/dev/null || true
ufw allow 80/tcp >/dev/null || true
ufw allow 443/tcp >/dev/null || true
ufw --force enable >/dev/null || true

PUBLIC_IP=${IZAKHONO_PUBLIC_IP:-}
if [ -z "$PUBLIC_IP" ]; then
  PUBLIC_IP=$(curl -4fsS --max-time 10 https://api.ipify.org || true)
fi
if ! echo "$PUBLIC_IP" | grep -Eq '^[0-9]{1,3}(\.[0-9]{1,3}){3}$'; then
  echo "ERROR: Could not determine public IPv4. Re-run with IZAKHONO_PUBLIC_IP=x.x.x.x" >&2
  exit 1
fi
DASHED=${PUBLIC_IP//./-}
DOMAIN=${IZAKHONO_DOMAIN:-${DASHED}.sslip.io}
EMAIL=${IZAKHONO_ACME_EMAIL:-owner@${DOMAIN}}

if [ ! -f .env ]; then cp .env.example .env; fi
python3 - "$DOMAIN" "$EMAIL" <<'PY'
from pathlib import Path
import sys,re
p=Path('.env'); s=p.read_text(); domain,email=sys.argv[1:]
s=re.sub(r'^CLOUD_DOMAIN=.*$',f'CLOUD_DOMAIN={domain}',s,flags=re.M)
s=re.sub(r'^ACME_EMAIL=.*$',f'ACME_EMAIL={email}',s,flags=re.M)
s=re.sub(r'^PUBLIC_EDGE_DOMAIN=.*$',f'PUBLIC_EDGE_DOMAIN=apps.{domain}',s,flags=re.M)
p.write_text(s)
PY

cp gateway/Caddyfile.staging gateway/Caddyfile

./owner-install.sh

sleep 8
./server-readiness.sh || true

echo
echo "========================================"
echo " IZAKHONO CLOUD STAGING IS INSTALLED"
echo "========================================"
echo "Cloud:         https://${DOMAIN}"
echo "Identity:      https://id.${DOMAIN}"
echo "Apps gateway:  https://apps.${DOMAIN}/<project-slug>/"
echo "Owner Console: https://owner.${DOMAIN}"
echo "Public IP:     ${PUBLIC_IP}"
echo
echo "Owner credentials: $(pwd)/.owner-credentials"
echo "Keep that file private."
