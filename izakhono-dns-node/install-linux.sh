#!/usr/bin/env bash
set -euo pipefail
if [ "${EUID:-$(id -u)}" -ne 0 ]; then exec sudo -E bash "$0" "$@"; fi
node -e 'const [a,b]=process.versions.node.split(".").map(Number);if(a<22||(a===22&&b<13))process.exit(1)' || { echo "Node.js 22.13+ required"; exit 2; }

useradd --system --home /nonexistent --shell /usr/sbin/nologin izakhono-dns 2>/dev/null || true
install -d -m 0750 -o root -g izakhono-dns /opt/izakhono-dns-node
install -d -m 0750 -o izakhono-dns -g izakhono-dns /var/log/izakhono-dns
install -d -m 0750 -o root -g izakhono-dns /etc/izakhono
install -m 0750 -o root -g izakhono-dns server.mjs /opt/izakhono-dns-node/server.mjs

if [ ! -f /etc/izakhono/dns-zone.json ]; then
  cat >/etc/izakhono/dns-zone.json <<'JSON'
{
  "zone": "domains.izakhonoafrica.co.za.",
  "ttl": 300,
  "soa": {
    "mname": "ns1.izakhonoafrica.co.za.",
    "rname": "hostmaster.izakhonoafrica.co.za.",
    "serial": 1,
    "refresh": 3600,
    "retry": 600,
    "expire": 1209600,
    "minimum": 300
  },
  "records": [
    {"name":"@","type":"NS","value":"ns1.izakhonoafrica.co.za.","ttl":300},
    {"name":"@","type":"A","value":"127.0.0.1","ttl":60}
  ]
}
JSON
fi
chown root:izakhono-dns /etc/izakhono/dns-zone.json
chmod 0640 /etc/izakhono/dns-zone.json

if [ ! -f /etc/izakhono/dns-node.env ]; then
  KEY="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  cat >/etc/izakhono/dns-node.env <<EOF
IZAKHONO_DNS_HOST=127.0.0.1
IZAKHONO_DNS_PORT=5353
IZAKHONO_DNS_TCP=true
IZAKHONO_DNS_ZONE=/etc/izakhono/dns-zone.json
IZAKHONO_DNS_CONTROL_HOST=127.0.0.1
IZAKHONO_DNS_CONTROL_PORT=8900
IZAKHONO_DNS_KEY=$KEY
EOF
fi
chown root:izakhono-dns /etc/izakhono/dns-node.env
chmod 0640 /etc/izakhono/dns-node.env

install -m 0644 systemd/izakhono-dns-node.service /etc/systemd/system/izakhono-dns-node.service
systemctl daemon-reload
systemctl enable --now izakhono-dns-node
sleep 1
curl -fsS http://127.0.0.1:8900/health
echo
echo "IZAKHONO DNS NODE: INSTALLED (safe loopback mode)"
