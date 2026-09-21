#!/usr/bin/env bash
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22.13+ is required."
  exit 2
fi

MODE="${IZAKHONO_EDGE_MODE:-direct}"
if [ "$MODE" != "direct" ] && [ "$MODE" != "tunnel" ] && [ "$MODE" != "hybrid" ]; then
  echo "IZAKHONO_EDGE_MODE must be direct, tunnel or hybrid."
  exit 4
fi
if [ "$MODE" != "tunnel" ] && { [ ! -f /etc/izakhono/tls/fullchain.pem ] || [ ! -f /etc/izakhono/tls/privkey.pem ]; }; then
  echo "Direct/hybrid EDGE mode requires /etc/izakhono/tls/fullchain.pem and privkey.pem."
  exit 4
fi

sudo useradd --system --home /nonexistent --shell /usr/sbin/nologin izakhono 2>/dev/null || true
sudo mkdir -p /opt/izakhono-edge-node /var/log/izakhono-edge /etc/izakhono
sudo cp server.mjs witness-lease.mjs /opt/izakhono-edge-node/
sudo chown -R izakhono:izakhono /opt/izakhono-edge-node /var/log/izakhono-edge
if [ "$MODE" != "tunnel" ]; then
  sudo chown root:izakhono /etc/izakhono/tls/fullchain.pem /etc/izakhono/tls/privkey.pem
  sudo chmod 640 /etc/izakhono/tls/fullchain.pem /etc/izakhono/tls/privkey.pem
fi

if [ ! -f /etc/izakhono/edge-node.env ]; then
  KEY="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  sudo tee /etc/izakhono/edge-node.env >/dev/null <<EOF
IZAKHONO_EDGE_MODE=$MODE
HTTP_HOST=0.0.0.0
HTTP_PORT=80
HTTPS_HOST=0.0.0.0
HTTPS_PORT=443
TUNNEL_HOST=127.0.0.1
TUNNEL_PORT=8780
CONTROL_HOST=127.0.0.1
CONTROL_PORT=8795
RUNTIME_HOST=127.0.0.1
RUNTIME_PORT=8080
IZAKHONO_EDGE_KEY=$KEY
IZAKHONO_TLS_CERT=/etc/izakhono/tls/fullchain.pem
IZAKHONO_TLS_KEY=/etc/izakhono/tls/privkey.pem
IZAKHONO_EDGE_ACCESS_LOG=/var/log/izakhono-edge/access.jsonl
IZAKHONO_EDGE_MAX_BODY_BYTES=5242880
IZAKHONO_EDGE_RATE_PER_MIN=180
IZAKHONO_EDGE_RATE_BURST=60
FORTRESS_PROTECTOR_MODE=active
FORTRESS_SENSITIVE_RATE_PER_MIN=60
FORTRESS_SENSITIVE_BURST=20
FORTRESS_SENSITIVE_MAX_BODY_BYTES=262144
IZAKHONO_WITNESS_MODE=observe
IZAKHONO_WITNESS_URL=
IZAKHONO_WITNESS_CLUSTER_ID=
IZAKHONO_WITNESS_MEMBER_ID=
IZAKHONO_WITNESS_MEMBER_KEY=
IZAKHONO_WITNESS_PUBLIC_KEY_FILE=/etc/izakhono/witness-member/public.pem
IZAKHONO_WITNESS_RENEW_MS=5000
EOF
else
  sudo python3 - /etc/izakhono/edge-node.env "$MODE" <<'PY'
from pathlib import Path
import sys
path=Path(sys.argv[1])
mode=sys.argv[2]
updates={
  "IZAKHONO_EDGE_MODE":mode,
  "TUNNEL_HOST":"127.0.0.1",
  "TUNNEL_PORT":"8780",
  "FORTRESS_PROTECTOR_MODE":"active",
  "IZAKHONO_WITNESS_MODE":"observe",
}
lines=path.read_text(encoding="utf-8").splitlines()
seen=set()
out=[]
for line in lines:
    if "=" in line and not line.lstrip().startswith("#"):
        key=line.split("=",1)[0].strip()
        if key in updates:
            out.append(f"{key}={updates[key]}")
            seen.add(key)
            continue
    out.append(line)
for key,value in updates.items():
    if key not in seen:
        out.append(f"{key}={value}")
path.write_text("\n".join(out)+"\n",encoding="utf-8")
PY
fi
sudo chmod 600 /etc/izakhono/edge-node.env

sudo cp systemd/izakhono-edge-node.service /etc/systemd/system/izakhono-edge-node.service
sudo systemctl daemon-reload
sudo systemctl enable --now izakhono-edge-node
sudo systemctl --no-pager --full status izakhono-edge-node
