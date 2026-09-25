#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: sudo $0 --hostname <public-kora-host> --cert <fullchain.pem> --key <privkey.pem>"
}

HOST=""
CERT=""
KEY=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --hostname) HOST="${2:-}"; shift 2 ;;
    --cert) CERT="${2:-}"; shift 2 ;;
    --key) KEY="${2:-}"; shift 2 ;;
    *) usage; exit 2 ;;
  esac
done

[[ $EUID -eq 0 ]] || { echo "Run as root."; exit 2; }
[[ -n "$HOST" && -n "$CERT" && -n "$KEY" ]] || { usage; exit 2; }
[[ "$HOST" =~ ^[A-Za-z0-9.-]+$ ]] || { echo "Invalid hostname."; exit 2; }
[[ -f "$CERT" && -f "$KEY" ]] || { echo "TLS certificate/key not found."; exit 2; }
command -v go >/dev/null || { echo "Go compiler is required to build the owned engine."; exit 2; }
command -v systemctl >/dev/null || { echo "systemd is required for persistent owned ingress."; exit 2; }
command -v curl >/dev/null || { echo "curl is required."; exit 2; }

curl --fail --silent --show-error --max-time 8 http://127.0.0.1:18080/api/health >/dev/null ||
  { echo "KORA sovereign runtime is not healthy on 127.0.0.1:18080."; exit 2; }

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if ! id izakhono-edge >/dev/null 2>&1; then
  useradd --system --home /nonexistent --shell /usr/sbin/nologin izakhono-edge
fi

install -d -m 0755 /etc/izakhono-edge
install -d -m 0755 /etc/izakhono-edge/tls
install -d -m 0755 /var/lib/izakhono-edge/acme
install -d -m 0755 /var/lib/izakhono-cloud/edge

(
  cd "$SCRIPT_DIR"
  go test ./...
  go vet ./...
  go build -trimpath -ldflags="-s -w" -o /tmp/izakhono-edge-engine .
)
install -o root -g root -m 0755 /tmp/izakhono-edge-engine /usr/local/sbin/izakhono-edge-engine
install -o root -g izakhono-edge -m 0640 "$CERT" /etc/izakhono-edge/tls/fullchain.pem
install -o root -g izakhono-edge -m 0640 "$KEY" /etc/izakhono-edge/tls/privkey.pem

cat > /etc/izakhono-edge/config.json <<JSON
{
  "schema": "izakhono.edge-engine/v1",
  "node_name": "ISN-01",
  "http_listen": ":80",
  "https_listen": ":443",
  "admin_listen": "127.0.0.1:19090",
  "acme_webroot": "/var/lib/izakhono-edge/acme",
  "tls": {
    "cert_file": "/etc/izakhono-edge/tls/fullchain.pem",
    "key_file": "/etc/izakhono-edge/tls/privkey.pem"
  },
  "routes": [
    {
      "host": "$HOST",
      "upstream": "http://127.0.0.1:18080",
      "health_path": "/api/health"
    }
  ],
  "security": {
    "hsts_seconds": 31536000,
    "rate_limit_per_minute": 600,
    "max_request_body_mb": 64
  }
}
JSON
chown root:izakhono-edge /etc/izakhono-edge/config.json
chmod 0640 /etc/izakhono-edge/config.json

/usr/local/sbin/izakhono-edge-engine -config /etc/izakhono-edge/config.json -check
install -o root -g root -m 0644 "$SCRIPT_DIR/izakhono-edge.service" /etc/systemd/system/izakhono-edge.service
systemctl daemon-reload
systemctl enable --now izakhono-edge.service

for _ in $(seq 1 20); do
  if curl --fail --silent --show-error --max-time 3 http://127.0.0.1:19090/health >/dev/null; then
    break
  fi
  sleep 1
done
curl --fail --silent --show-error --max-time 5 http://127.0.0.1:19090/status

cat > /var/lib/izakhono-cloud/edge/OWNED-EDGE-INSTALLED.txt <<EOF
IZAKHONO EDGE OWNED ENGINE
node=ISN-01
hostname=$HOST
origin=http://127.0.0.1:18080
admin=http://127.0.0.1:19090
external_proxy_required=false
cloudflare_required=false
vercel_required=false
public_ready=unverified
EOF

echo
echo "IZAKHONO EDGE OWNED ENGINE: INSTALLED"
echo "Public readiness remains UNVERIFIED until DNS/router reachability and an external HTTPS round trip are proven."
