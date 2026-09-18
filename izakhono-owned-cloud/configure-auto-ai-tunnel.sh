#!/usr/bin/env bash
set -euo pipefail

HOSTNAME="${AUTO_AI_HOSTNAME:-autoai.izakhonoafrica.co.za}"
TOKEN_INPUT="${1:-}"
EDGE_ENV="/etc/izakhono/edge-node.env"
TOKEN_DIR="/etc/izakhono/tunnel"
TOKEN_FILE="$TOKEN_DIR/auto-ai.token"
UNIT="/etc/systemd/system/izakhono-auto-ai-tunnel.service"

fail(){ echo "FAIL: $*" >&2; exit 2; }

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo bash "$0" "$@"
fi

command -v cloudflared >/dev/null 2>&1 || fail "cloudflared is not installed."
command -v curl >/dev/null 2>&1 || fail "curl is required."
command -v node >/dev/null 2>&1 || fail "node is required."
[ -f "$EDGE_ENV" ] || fail "IZAKHONO EDGE NODE is not installed."
[ -n "$TOKEN_INPUT" ] || fail "Usage: $0 /path/to/cloudflare-tunnel-token-file"
[ -f "$TOKEN_INPUT" ] || fail "Tunnel token file not found: $TOKEN_INPUT"

TOKEN="$(tr -d '\r\n' < "$TOKEN_INPUT")"
[ -n "$TOKEN" ] || fail "Tunnel token file is empty."
case "$TOKEN" in
  eyJ*) ;;
  *) fail "Tunnel token does not look valid." ;;
esac

useradd --system --home /nonexistent --shell /usr/sbin/nologin izakhono-tunnel 2>/dev/null || true
install -d -o root -g izakhono-tunnel -m 0750 "$TOKEN_DIR"
printf '%s' "$TOKEN" | install -o root -g izakhono-tunnel -m 0640 /dev/stdin "$TOKEN_FILE"
unset TOKEN

python3 - "$EDGE_ENV" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1])
updates={
  "IZAKHONO_EDGE_MODE":"tunnel",
  "TUNNEL_HOST":"127.0.0.1",
  "TUNNEL_PORT":"8780",
}
lines=p.read_text(encoding="utf-8").splitlines()
seen=set(); out=[]
for line in lines:
    if "=" in line and not line.lstrip().startswith("#"):
        k=line.split("=",1)[0].strip()
        if k in updates:
            out.append(f"{k}={updates[k]}")
            seen.add(k)
            continue
    out.append(line)
for k,v in updates.items():
    if k not in seen: out.append(f"{k}={v}")
p.write_text("\n".join(out)+"\n",encoding="utf-8")
PY
chmod 600 "$EDGE_ENV"

cat >"$UNIT" <<EOF
[Unit]
Description=IZAKHONO AUTO AI Cloudflare Tunnel Connector
After=network-online.target izakhono-edge-node.service
Wants=network-online.target
Requires=izakhono-edge-node.service

[Service]
Type=simple
User=izakhono-tunnel
Group=izakhono-tunnel
ExecStart=$(command -v cloudflared) tunnel --no-autoupdate run --token-file $TOKEN_FILE
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadOnlyPaths=$TOKEN_FILE

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl restart izakhono-edge-node
systemctl enable --now izakhono-auto-ai-tunnel.service

for _ in $(seq 1 40); do
  if curl -fsS -H "Host: $HOSTNAME" http://127.0.0.1:8780/api/health >/tmp/auto-ai-local-tunnel-health.json 2>/dev/null; then
    break
  fi
  sleep .5
done
node -e 'const x=require("/tmp/auto-ai-local-tunnel-health.json"); if(x.ok!==true||x.service!=="auto-ai")process.exit(2)'   || fail "Local EDGE tunnel origin did not return AUTO AI health."

echo "LOCAL_TUNNEL_ORIGIN=VERIFIED"

PUBLIC_OK=0
for _ in $(seq 1 60); do
  if curl -fsS -D /tmp/auto-ai-public-headers.txt "https://$HOSTNAME/api/health" -o /tmp/auto-ai-public-health.json 2>/dev/null; then
    if grep -qi '^x-izakhono-edge: 1' /tmp/auto-ai-public-headers.txt        && node -e 'const x=require("/tmp/auto-ai-public-health.json"); if(x.ok!==true||x.service!=="auto-ai")process.exit(2)'; then
      PUBLIC_OK=1
      break
    fi
  fi
  sleep 2
done

if [ "$PUBLIC_OK" = "1" ]; then
  echo "AUTO AI PUBLIC TUNNEL: VERIFIED"
  echo "HOSTNAME=$HOSTNAME"
  echo "EDGE=IZAKHONO"
  echo "PUBLIC_HTTPS=VERIFIED"
  echo "SAFE_TO_SWITCH_CUSTOMER_LINKS=YES"
  exit 0
fi

echo "AUTO AI tunnel connector is running, but the public hostname is not verified yet."
echo "Cloudflare must have a Published Application route:"
echo "  Hostname: $HOSTNAME"
echo "  Service URL: http://localhost:8780"
echo "Customer links have NOT been switched."
exit 4
