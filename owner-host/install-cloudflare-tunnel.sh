#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo -E bash "$0" "$@"
fi

TOKEN_FILE="/etc/izakhono/cloudflare-tunnel.token"
SERVICE="/etc/systemd/system/izakhono-owner-tunnel.service"
REPORT="/var/lib/izakhono-deploy/owner-tunnel.json"

need(){ command -v "$1" >/dev/null 2>&1 || { echo "Missing $1" >&2; exit 2; }; }
for cmd in curl node systemctl dpkg; do need "$cmd"; done

EDGE="$(curl -fsS --max-time 5 http://127.0.0.1:8795/health)"
node -e 'const x=JSON.parse(process.argv[1]);if(x.status!=="healthy"||x.ingressMode!=="tunnel"||x.fortressProtector!==true)process.exit(2)' "$EDGE"   || { echo "IZAKHONO EDGE tunnel origin is not healthy." >&2; exit 3; }

[ -s "$TOKEN_FILE" ] || {
  install -d -m 0700 /etc/izakhono
  touch "$TOKEN_FILE"
  chmod 0600 "$TOKEN_FILE"
  echo "Cloudflare Tunnel token missing: $TOKEN_FILE" >&2
  exit 12
}
chmod 0600 "$TOKEN_FILE"

if ! command -v cloudflared >/dev/null 2>&1; then
  ARCH="$(dpkg --print-architecture)"
  case "$ARCH" in
    amd64) PKG="cloudflared-linux-amd64.deb" ;;
    arm64) PKG="cloudflared-linux-arm64.deb" ;;
    *) echo "Unsupported architecture: $ARCH" >&2; exit 4 ;;
  esac
  curl -fL "https://github.com/cloudflare/cloudflared/releases/latest/download/$PKG" -o /tmp/cloudflared.deb
  dpkg -i /tmp/cloudflared.deb
  rm -f /tmp/cloudflared.deb
fi

cat > "$SERVICE" <<'UNIT'
[Unit]
Description=IZAKHONO Owner Host Public Tunnel
After=network-online.target izakhono-edge-node.service
Wants=network-online.target izakhono-edge-node.service

[Service]
Type=simple
ExecStart=/usr/bin/cloudflared tunnel --no-autoupdate run --token-file /etc/izakhono/cloudflare-tunnel.token
Restart=always
RestartSec=5
User=root
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadOnlyPaths=/etc/izakhono/cloudflare-tunnel.token

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now izakhono-owner-tunnel
sleep 3
systemctl is-active --quiet izakhono-owner-tunnel

mkdir -p "$(dirname "$REPORT")"
node - "$REPORT" "$(cloudflared --version | head -1)" <<'NODE'
const fs=require("fs");
const [path,version]=process.argv.slice(2);
const body={
  schema:"izakhono.owner-tunnel/v1",
  state:"active",
  edge_origin:"http://127.0.0.1:8780",
  cloudflared:version,
  token_file_mode:"0600",
  token_in_source:false,
  token_in_receipt:false,
  generated_at:new Date().toISOString()
};
fs.writeFileSync(path,JSON.stringify(body,null,2)+"\n",{mode:0o600});
console.log(JSON.stringify(body,null,2));
NODE
chmod 0600 "$REPORT"

echo "IZAKHONO OWNER TUNNEL: ACTIVE"
echo "Origin: http://127.0.0.1:8780"
echo "Configure each public hostname in the Cloudflare tunnel to this HTTP origin."
