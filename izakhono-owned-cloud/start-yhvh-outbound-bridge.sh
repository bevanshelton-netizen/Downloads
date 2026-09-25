#!/usr/bin/env bash
set -euo pipefail
if [ "${EUID:-$(id -u)}" -ne 0 ]; then exec sudo -E bash "$0" "$@"; fi

HOSTNAME="${YHVH_PUBLIC_HOSTNAME:-gospel.domains.izakhonoafrica.co.za}"
ZONE_NAME="${YHVH_PARENT_ZONE:-izakhonoafrica.co.za}"
TUNNEL_NAME="${YHVH_TUNNEL_NAME:-izakhono-yhvh-gospel-tv}"
LOCAL_ORIGIN="${YHVH_LOCAL_ORIGIN:-http://127.0.0.1:8080}"
REPORT="/var/lib/izakhono-deploy/yhvh-last-mile-bridge.json"
ENV_FILE="/etc/izakhono/yhvh-cloudflare-tunnel.env"
UNIT="/etc/systemd/system/izakhono-yhvh-tunnel.service"

need(){ command -v "$1" >/dev/null 2>&1 || { echo "Missing required command: $1" >&2; exit 2; }; }
for c in curl node systemctl openssl; do need "$c"; done
mkdir -p /var/lib/izakhono-deploy /etc/izakhono
chmod 0700 /var/lib/izakhono-deploy /etc/izakhono

echo "YHVH GOSPEL TV — LAST-MILE OUTBOUND BRIDGE"
echo "Owned origin: $LOCAL_ORIGIN"
echo "Public hostname: $HOSTNAME"
echo "Policy: IZAKHONO origin first; external tunnel is transport only."

LOCAL_HEALTH="$(curl -fsS -H "Host: $HOSTNAME" "$LOCAL_ORIGIN/health" 2>/dev/null || true)"
node -e 'const x=JSON.parse(process.argv[1]||"{}");if(x.ok!==true||x.service!=="yhvh-gospel-tv"||x.runtime!=="izakhono-owned")process.exit(1)' "$LOCAL_HEALTH" || {
  echo "Owned YHVH runtime is not healthy on $LOCAL_ORIGIN." >&2
  exit 11
}
echo "Owned runtime health: PASS"

read_key(){
  local key="$1"; shift
  local file value=""
  if [ -n "${!key:-}" ]; then printf "%s" "${!key}"; return 0; fi
  for file in "$@"; do
    [ -f "$file" ] || continue
    value="$(awk -F= -v k="$key" '$1==k{sub(/^[^=]*=/,"");print;exit}' "$file" 2>/dev/null || true)"
    [ -n "$value" ] && { printf "%s" "$value"; return 0; }
  done
  return 1
}

SECRET_FILES=(/etc/izakhono/cloudflare.env /etc/izakhono/tunnel.env /etc/izakhono/edge/cloudflare.env "$ENV_FILE")
CF_TOKEN="$(read_key CLOUDFLARE_API_TOKEN "${SECRET_FILES[@]}" || true)"
TUNNEL_TOKEN="$(read_key CLOUDFLARE_TUNNEL_TOKEN "${SECRET_FILES[@]}" || true)"
ACCOUNT_ID=""
ZONE_ID=""
TUNNEL_ID=""
DNS_RECORD_ID=""

cf(){
  local method="$1" url="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -fsS -X "$method" "$url" -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" --data-binary "$body"
  else
    curl -fsS -X "$method" "$url" -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json"
  fi
}

if [ -z "$TUNNEL_TOKEN" ] && [ -n "$CF_TOKEN" ]; then
  echo "Cloudflare API credential found. Bootstrapping the outbound bridge automatically..."
  ZONES="$(cf GET "https://api.cloudflare.com/client/v4/zones?name=$ZONE_NAME&status=active&per_page=50")"
  read -r ZONE_ID ACCOUNT_ID < <(node -e 'const x=JSON.parse(process.argv[1]);const z=(x.result||[]).find(z=>z.name===process.argv[2]);if(!z)process.exit(2);process.stdout.write(z.id+" "+z.account.id)' "$ZONES" "$ZONE_NAME")
  [ -n "$ZONE_ID" ] && [ -n "$ACCOUNT_ID" ] || { echo "Could not resolve Cloudflare zone/account for $ZONE_NAME." >&2; exit 30; }

  TUNNELS="$(cf GET "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/cfd_tunnel?name=$TUNNEL_NAME&is_deleted=false&per_page=50")"
  TUNNEL_ID="$(node -e 'const x=JSON.parse(process.argv[1]);const t=(x.result||[]).find(t=>t.name===process.argv[2]);if(t)process.stdout.write(t.id)' "$TUNNELS" "$TUNNEL_NAME")"
  if [ -z "$TUNNEL_ID" ]; then
    TUNNEL_SECRET="$(openssl rand -base64 32 | tr -d "\n")"
    CREATE_BODY="$(node -e 'process.stdout.write(JSON.stringify({name:process.argv[1],tunnel_secret:process.argv[2],config_src:"cloudflare"}))' "$TUNNEL_NAME" "$TUNNEL_SECRET")"
    CREATED="$(cf POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/cfd_tunnel" "$CREATE_BODY")"
    TUNNEL_ID="$(node -e 'const x=JSON.parse(process.argv[1]);if(!x.success||!x.result?.id)process.exit(2);process.stdout.write(x.result.id)' "$CREATED")"
  fi

  CONFIG_BODY="$(node -e 'const h=process.argv[1],o=process.argv[2];process.stdout.write(JSON.stringify({config:{ingress:[{hostname:h,service:o,originRequest:{httpHostHeader:h}},{service:"http_status:404"}]}}))' "$HOSTNAME" "$LOCAL_ORIGIN")"
  cf PUT "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/cfd_tunnel/$TUNNEL_ID/configurations" "$CONFIG_BODY" >/dev/null

  RECORDS="$(cf GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?name=$HOSTNAME&per_page=100")"
  DNS_RECORD_ID="$(node -e 'const x=JSON.parse(process.argv[1]);const r=(x.result||[])[0];if(r)process.stdout.write(r.id)' "$RECORDS")"
  DNS_RECORD_TYPE="$(node -e 'const x=JSON.parse(process.argv[1]);const r=(x.result||[])[0];if(r)process.stdout.write(r.type)' "$RECORDS")"
  DNS_TARGET="$TUNNEL_ID.cfargotunnel.com"
  DNS_BODY="$(node -e 'process.stdout.write(JSON.stringify({type:"CNAME",name:process.argv[1],content:process.argv[2],proxied:true,ttl:1}))' "$HOSTNAME" "$DNS_TARGET")"
  if [ -n "$DNS_RECORD_ID" ]; then
    if [ "$DNS_RECORD_TYPE" != "CNAME" ] && [ "${IZAKHONO_ALLOW_BRIDGE_DNS_REPLACE:-1}" != "1" ]; then
      echo "Existing non-CNAME DNS record found for $HOSTNAME; refusing to replace it." >&2
      exit 31
    fi
    cf PUT "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$DNS_RECORD_ID" "$DNS_BODY" >/dev/null
  else
    cf POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" "$DNS_BODY" >/dev/null
  fi

  TOKEN_JSON="$(cf GET "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/cfd_tunnel/$TUNNEL_ID/token")"
  TUNNEL_TOKEN="$(node -e 'const x=JSON.parse(process.argv[1]);if(!x.success||!x.result)process.exit(2);process.stdout.write(x.result)' "$TOKEN_JSON")"
fi

if [ -z "$TUNNEL_TOKEN" ]; then
  cat >&2 <<EOF
No Cloudflare tunnel/API credential is available on this owner host.
Put one of these in a protected root-only file:
  CLOUDFLARE_API_TOKEN=<token with Zone DNS + Tunnel Edit>
or:
  CLOUDFLARE_TUNNEL_TOKEN=<existing remotely-managed tunnel token>
Recommended path: /etc/izakhono/cloudflare.env (chmod 600).
EOF
  exit 30
fi

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "Installing official cloudflared package..."
  ARCH="$(dpkg --print-architecture 2>/dev/null || echo amd64)"
  case "$ARCH" in amd64|arm64) ;; *) echo "Unsupported architecture for automatic cloudflared install: $ARCH" >&2; exit 32;; esac
  TMP_DEB="$(mktemp --suffix=.deb)"
  curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-$ARCH.deb" -o "$TMP_DEB"
  dpkg -i "$TMP_DEB" >/dev/null || { apt-get -f install -y >/dev/null; dpkg -i "$TMP_DEB" >/dev/null; }
  rm -f "$TMP_DEB"
fi

umask 077
printf "CLOUDFLARE_TUNNEL_TOKEN=%s\n" "$TUNNEL_TOKEN" > "$ENV_FILE"
chmod 0600 "$ENV_FILE"
cat > "$UNIT" <<EOF
[Unit]
Description=IZAKHONO YHVH Gospel TV outbound public bridge
After=network-online.target izakhono-runtime-node.service
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/cloudflared tunnel --no-autoupdate run --token \${CLOUDFLARE_TUNNEL_TOKEN}
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now izakhono-yhvh-tunnel.service >/dev/null
sleep 3
systemctl is-active --quiet izakhono-yhvh-tunnel.service || { journalctl -u izakhono-yhvh-tunnel.service -n 80 --no-pager >&2; exit 33; }

PUBLIC_OK=false
PUBLIC_HEALTH=""
for i in $(seq 1 24); do
  PUBLIC_HEALTH="$(curl -fsS --max-time 10 "https://$HOSTNAME/health" 2>/dev/null || true)"
  if node -e 'const x=JSON.parse(process.argv[1]||"{}");if(x.ok!==true||x.service!=="yhvh-gospel-tv"||x.runtime!=="izakhono-owned")process.exit(1)' "$PUBLIC_HEALTH" 2>/dev/null; then PUBLIC_OK=true; break; fi
  sleep 5
done

node - "$REPORT" "$HOSTNAME" "$LOCAL_ORIGIN" "$TUNNEL_NAME" "$TUNNEL_ID" "$PUBLIC_OK" <<'NODE'
const fs=require("fs");
const [path,hostname,origin,tunnelName,tunnelId,publicOk]=process.argv.slice(2);
fs.writeFileSync(path,JSON.stringify({
  schema:"izakhono.yhvh-last-mile-bridge/v1",
  product:"YHVH GOSPEL TV",
  authoritative_origin:"IZAKHONO",
  ingress_transport:"Cloudflare Tunnel",
  owned_origin:origin,
  public_hostname:hostname,
  tunnel_name:tunnelName,
  tunnel_id:tunnelId||null,
  inbound_port_forwarding_required:false,
  public_https_verified:publicOk==="true",
  external_resilience:["Vercel","GitHub Pages"],
  generated_at:new Date().toISOString()
},null,2)+"\n");
NODE
chmod 0600 "$REPORT"

if [ "$PUBLIC_OK" != true ]; then
  echo "Tunnel service is active, but public YHVH health verification did not pass." >&2
  echo "Check DNS/public-hostname routing in the tunnel configuration." >&2
  exit 34
fi

echo "YHVH GOSPEL TV OUTBOUND BRIDGE: LIVE AND VERIFIED"
echo "https://$HOSTNAME"
echo "No inbound 53/80/443 router forwarding is required for this bridge path."
exit 0
