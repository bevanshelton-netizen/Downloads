#!/usr/bin/env bash
set -euo pipefail
if [ "${EUID:-$(id -u)}" -ne 0 ]; then exec sudo -E bash "$0" "$@"; fi

HOSTNAME="${GROWTH_BRIDGE_PUBLIC_HOSTNAME:-bridge.domains.izakhonoafrica.co.za}"
ZONE_NAME="${GROWTH_BRIDGE_PARENT_ZONE:-izakhonoafrica.co.za}"
TUNNEL_NAME="${GROWTH_BRIDGE_TUNNEL_NAME:-izakhono-growth-os-bridge}"
LOCAL_ORIGIN="http://127.0.0.1:8920"
REPORT="/var/lib/izakhono-deploy/growth-bridge-public.json"
ENV_FILE="/etc/izakhono/growth-bridge-cloudflare.env"
UNIT="/etc/systemd/system/izakhono-growth-bridge-tunnel.service"

need(){ command -v "$1" >/dev/null 2>&1 || { echo "Missing $1" >&2; exit 2; }; }
for c in curl node systemctl openssl; do need "$c"; done
mkdir -p /var/lib/izakhono-deploy /etc/izakhono
chmod 0700 /var/lib/izakhono-deploy /etc/izakhono

LOCAL="$(curl -fsS --max-time 5 "$LOCAL_ORIGIN/health" 2>/dev/null || true)"
node -e 'const x=JSON.parse(process.argv[1]||"{}");if(x.ok!==true||x.service!=="izakhono-growth-bridge"||x.runtime!=="izakhono-owned"||x.arbitraryProxy!==false||x.shellAccess!==false)process.exit(2)' "$LOCAL" || { echo "Growth bridge is not healthy locally." >&2; exit 11; }

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
TUNNEL_TOKEN="$(read_key GROWTH_BRIDGE_TUNNEL_TOKEN "${SECRET_FILES[@]}" || true)"
ACCOUNT_ID=""; ZONE_ID=""; TUNNEL_ID=""

cf(){
  local method="$1" url="$2" body="${3:-}"
  if [ -n "$body" ]; then curl -fsS -X "$method" "$url" -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" --data-binary "$body";
  else curl -fsS -X "$method" "$url" -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json"; fi
}

if [ -z "$TUNNEL_TOKEN" ] && [ -n "$CF_TOKEN" ]; then
  ZONES="$(cf GET "https://api.cloudflare.com/client/v4/zones?name=$ZONE_NAME&status=active&per_page=50")"
  read -r ZONE_ID ACCOUNT_ID < <(node -e 'const x=JSON.parse(process.argv[1]);const z=(x.result||[]).find(z=>z.name===process.argv[2]);if(!z)process.exit(2);process.stdout.write(z.id+" "+z.account.id)' "$ZONES" "$ZONE_NAME")
  TUNNELS="$(cf GET "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/cfd_tunnel?name=$TUNNEL_NAME&is_deleted=false&per_page=50")"
  TUNNEL_ID="$(node -e 'const x=JSON.parse(process.argv[1]);const t=(x.result||[]).find(t=>t.name===process.argv[2]);if(t)process.stdout.write(t.id)' "$TUNNELS" "$TUNNEL_NAME")"
  if [ -z "$TUNNEL_ID" ]; then
    SECRET="$(openssl rand -base64 32 | tr -d "\n")"
    BODY="$(node -e 'process.stdout.write(JSON.stringify({name:process.argv[1],tunnel_secret:process.argv[2],config_src:"cloudflare"}))' "$TUNNEL_NAME" "$SECRET")"
    CREATED="$(cf POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/cfd_tunnel" "$BODY")"
    TUNNEL_ID="$(node -e 'const x=JSON.parse(process.argv[1]);if(!x.success||!x.result?.id)process.exit(2);process.stdout.write(x.result.id)' "$CREATED")"
  fi
  CONFIG="$(node -e 'const h=process.argv[1],o=process.argv[2];process.stdout.write(JSON.stringify({config:{ingress:[{hostname:h,service:o},{service:"http_status:404"}]}}))' "$HOSTNAME" "$LOCAL_ORIGIN")"
  cf PUT "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/cfd_tunnel/$TUNNEL_ID/configurations" "$CONFIG" >/dev/null
  RECORDS="$(cf GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?name=$HOSTNAME&per_page=100")"
  RID="$(node -e 'const x=JSON.parse(process.argv[1]);const r=(x.result||[])[0];if(r)process.stdout.write(r.id)' "$RECORDS")"
  RTYPE="$(node -e 'const x=JSON.parse(process.argv[1]);const r=(x.result||[])[0];if(r)process.stdout.write(r.type)' "$RECORDS")"
  TARGET="$TUNNEL_ID.cfargotunnel.com"
  DNS="$(node -e 'process.stdout.write(JSON.stringify({type:"CNAME",name:process.argv[1],content:process.argv[2],proxied:true,ttl:1}))' "$HOSTNAME" "$TARGET")"
  if [ -n "$RID" ]; then
    [ "$RTYPE" = "CNAME" ] || { echo "Existing non-CNAME record blocks bridge hostname." >&2; exit 31; }
    cf PUT "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$RID" "$DNS" >/dev/null
  else
    cf POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" "$DNS" >/dev/null
  fi
  TOKEN_JSON="$(cf GET "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/cfd_tunnel/$TUNNEL_ID/token")"
  TUNNEL_TOKEN="$(node -e 'const x=JSON.parse(process.argv[1]);if(!x.success||!x.result)process.exit(2);process.stdout.write(x.result)' "$TOKEN_JSON")"
fi

if [ -z "$TUNNEL_TOKEN" ]; then
  echo "No Cloudflare API/tunnel credential is available on NODE01." >&2
  exit 30
fi

if ! command -v cloudflared >/dev/null 2>&1; then
  ARCH="$(dpkg --print-architecture 2>/dev/null || echo amd64)"
  TMP="$(mktemp --suffix=.deb)"
  curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-$ARCH.deb" -o "$TMP"
  dpkg -i "$TMP" >/dev/null || { apt-get -f install -y >/dev/null; dpkg -i "$TMP" >/dev/null; }
  rm -f "$TMP"
fi

umask 077
printf "GROWTH_BRIDGE_TUNNEL_TOKEN=%s\n" "$TUNNEL_TOKEN" > "$ENV_FILE"
chmod 0600 "$ENV_FILE"
cat >"$UNIT" <<EOF
[Unit]
Description=IZAKHONO Growth OS OIDC Bridge outbound tunnel
After=network-online.target izakhono-growth-bridge-node.service
Wants=network-online.target izakhono-growth-bridge-node.service
[Service]
Type=simple
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/cloudflared tunnel --no-autoupdate run --token ${GROWTH_BRIDGE_TUNNEL_TOKEN}
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
systemctl enable --now izakhono-growth-bridge-tunnel.service >/dev/null
sleep 3
systemctl is-active --quiet izakhono-growth-bridge-tunnel.service || exit 33

PUBLIC_OK=false
for _ in $(seq 1 24); do
  BODY="$(curl -fsS --max-time 10 "https://$HOSTNAME/health" 2>/dev/null || true)"
  if node -e 'const x=JSON.parse(process.argv[1]||"{}");if(x.ok!==true||x.service!=="izakhono-growth-bridge"||x.arbitraryProxy!==false||x.shellAccess!==false)process.exit(1)' "$BODY" 2>/dev/null; then PUBLIC_OK=true; break; fi
  sleep 5
done
node - "$REPORT" "$HOSTNAME" "$TUNNEL_NAME" "$TUNNEL_ID" "$PUBLIC_OK" <<'NODE'
const fs=require("fs");
const [path,hostname,tunnelName,tunnelId,publicOk]=process.argv.slice(2);
fs.writeFileSync(path,JSON.stringify({
 schema:"izakhono.growth-bridge-public/v1",
 authoritative_origin:"NODE01",
 public_hostname:hostname,
 transport:"Cloudflare Tunnel",
 tunnel_name:tunnelName,
 tunnel_id:tunnelId||null,
 oidc_required:true,
 custom_audience:"https://bridge.domains.izakhonoafrica.co.za",
 public_https_verified:publicOk==="true",
 inbound_port_forwarding_required:false,
 generated_at:new Date().toISOString()
},null,2)+"\n",{mode:0o600});
NODE
chmod 0600 "$REPORT"
[ "$PUBLIC_OK" = true ] || exit 34
echo "IZAKHONO GROWTH BRIDGE PUBLIC: LIVE AND VERIFIED"
