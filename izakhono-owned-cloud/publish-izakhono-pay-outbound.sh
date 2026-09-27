#!/usr/bin/env bash
set -euo pipefail
if [ "${EUID:-$(id -u)}" -ne 0 ]; then exec sudo -E bash "$0" "$@"; fi

ROOT="${IZAKHONO_INFRA_SOURCE_ROOT:-/opt/izakhono-source/Downloads}"
HOSTNAME="pay.izakhonoafrica.co.za"
ZONE_NAME="izakhonoafrica.co.za"
TUNNEL_NAME="izakhono-pay"
LOCAL_ORIGIN="http://127.0.0.1:8080"
ENV_FILE="/etc/izakhono/pay-cloudflare.env"
UNIT="/etc/systemd/system/izakhono-pay-tunnel.service"
REPORT="/var/lib/izakhono-deploy/izakhono-pay-public.json"

bash "$ROOT/izakhono-infrastructure-executor/host-eligibility.sh" >/tmp/pay-host.txt
grep -q '^INFRASTRUCTURE_HOST_ELIGIBLE=true$' /tmp/pay-host.txt
systemctl is-active --quiet izakhono-edge-node
curl -fsS --max-time 5 http://127.0.0.1:18109/health >/tmp/fortress.json
node -e 'const x=require("/tmp/fortress.json");if(x.status!=="ok"||x.product!=="FORTRESS")process.exit(2)'

LOCAL="$(curl -fsS --max-time 5 -H "Host: $HOSTNAME" "$LOCAL_ORIGIN/health")"
node -e 'const x=JSON.parse(process.argv[1]);if(x.ok!==true||x.service!=="izakhono-pay"||x.primary_provider!=="ikhokha")process.exit(2)' "$LOCAL"

read_key(){ local key="$1"; shift; local f v; if [ -n "${!key:-}" ]; then printf "%s" "${!key}"; return; fi; for f in "$@"; do [ -f "$f" ] || continue; v="$(awk -F= -v k="$key" '$1==k{sub(/^[^=]*=/,"");print;exit}' "$f" 2>/dev/null||true)"; [ -n "$v" ] && { printf "%s" "$v"; return; }; done; return 1; }
SECRET_FILES=(/etc/izakhono/cloudflare.env /etc/izakhono/tunnel.env "$ENV_FILE")
CF_TOKEN="$(read_key CLOUDFLARE_API_TOKEN "${SECRET_FILES[@]}" || true)"
TUNNEL_TOKEN="$(read_key IZAKHONO_PAY_TUNNEL_TOKEN "${SECRET_FILES[@]}" || true)"
ACCOUNT_ID=""; ZONE_ID=""; TUNNEL_ID=""
cf(){ local method="$1" url="$2" body="${3:-}"; if [ -n "$body" ]; then curl -fsS -X "$method" "$url" -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" --data-binary "$body"; else curl -fsS -X "$method" "$url" -H "Authorization: Bearer $CF_TOKEN"; fi; }

if [ -z "$TUNNEL_TOKEN" ] && [ -n "$CF_TOKEN" ]; then
 ZONES="$(cf GET "https://api.cloudflare.com/client/v4/zones?name=$ZONE_NAME&status=active&per_page=50")"
 read -r ZONE_ID ACCOUNT_ID < <(node -e 'const x=JSON.parse(process.argv[1]);const z=(x.result||[]).find(z=>z.name===process.argv[2]);if(!z)process.exit(2);process.stdout.write(z.id+" "+z.account.id)' "$ZONES" "$ZONE_NAME")
 TUNNELS="$(cf GET "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/cfd_tunnel?name=$TUNNEL_NAME&is_deleted=false&per_page=50")"
 TUNNEL_ID="$(node -e 'const x=JSON.parse(process.argv[1]);const t=(x.result||[])[0];if(t)process.stdout.write(t.id)' "$TUNNELS")"
 if [ -z "$TUNNEL_ID" ]; then
   SECRET="$(openssl rand -base64 32|tr -d "\n")"
   BODY="$(node -e 'process.stdout.write(JSON.stringify({name:process.argv[1],tunnel_secret:process.argv[2],config_src:"cloudflare"}))' "$TUNNEL_NAME" "$SECRET")"
   CREATED="$(cf POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/cfd_tunnel" "$BODY")"
   TUNNEL_ID="$(node -e 'const x=JSON.parse(process.argv[1]);if(!x.success||!x.result?.id)process.exit(2);process.stdout.write(x.result.id)' "$CREATED")"
 fi
 CONFIG="$(node -e 'process.stdout.write(JSON.stringify({config:{ingress:[{hostname:process.argv[1],service:process.argv[2],originRequest:{httpHostHeader:process.argv[1]}},{service:"http_status:404"}]}}))' "$HOSTNAME" "$LOCAL_ORIGIN")"
 cf PUT "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/cfd_tunnel/$TUNNEL_ID/configurations" "$CONFIG" >/dev/null
 RECORDS="$(cf GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?name=$HOSTNAME&per_page=100")"
 RID="$(node -e 'const x=JSON.parse(process.argv[1]);const r=(x.result||[])[0];if(r)process.stdout.write(r.id)' "$RECORDS")"
 RTYPE="$(node -e 'const x=JSON.parse(process.argv[1]);const r=(x.result||[])[0];if(r)process.stdout.write(r.type)' "$RECORDS")"
 TARGET="$TUNNEL_ID.cfargotunnel.com"
 DNS="$(node -e 'process.stdout.write(JSON.stringify({type:"CNAME",name:process.argv[1],content:process.argv[2],proxied:true,ttl:1}))' "$HOSTNAME" "$TARGET")"
 if [ -n "$RID" ]; then [ "$RTYPE" = "CNAME" ] || { echo "Existing non-CNAME blocks PAY hostname" >&2; exit 31; }; cf PUT "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$RID" "$DNS" >/dev/null; else cf POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" "$DNS" >/dev/null; fi
 TOKEN_JSON="$(cf GET "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/cfd_tunnel/$TUNNEL_ID/token")"
 TUNNEL_TOKEN="$(node -e 'const x=JSON.parse(process.argv[1]);if(!x.success||!x.result)process.exit(2);process.stdout.write(x.result)' "$TOKEN_JSON")"
fi
[ -n "$TUNNEL_TOKEN" ] || { echo "No Cloudflare credential on managed infrastructure" >&2; exit 30; }

if ! command -v cloudflared >/dev/null; then
 ARCH="$(dpkg --print-architecture 2>/dev/null||echo amd64)"; TMP="$(mktemp --suffix=.deb)"
 curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-$ARCH.deb" -o "$TMP"
 dpkg -i "$TMP" >/dev/null || { apt-get -f install -y >/dev/null; dpkg -i "$TMP" >/dev/null; }; rm -f "$TMP"
fi
umask 077; printf "IZAKHONO_PAY_TUNNEL_TOKEN=%s\n" "$TUNNEL_TOKEN" >"$ENV_FILE"; chmod 0600 "$ENV_FILE"
cat >"$UNIT" <<EOF
[Unit]
Description=IZAKHONO PAY managed outbound tunnel
After=network-online.target izakhono-edge-node.service
Wants=network-online.target izakhono-edge-node.service
[Service]
Type=simple
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/cloudflared tunnel --no-autoupdate run --token ${IZAKHONO_PAY_TUNNEL_TOKEN}
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload; systemctl enable --now izakhono-pay-tunnel.service >/dev/null
sleep 3; systemctl is-active --quiet izakhono-pay-tunnel.service

OK=false
for _ in $(seq 1 24); do
 curl -fsS --max-time 10 -D /tmp/pay-h -o /tmp/pay-b "https://$HOSTNAME/health" 2>/dev/null || { sleep 5; continue; }
 if node -e 'const x=require("/tmp/pay-b");if(x.ok!==true||x.service!=="izakhono-pay"||x.primary_provider!=="ikhokha")process.exit(1)' && grep -qi '^x-fortress-protector: active' /tmp/pay-h; then OK=true; break; fi
 sleep 5
done
[ "$OK" = true ] || { echo "PAY public verification failed closed" >&2; exit 34; }
node - "$REPORT" "$TUNNEL_ID" <<'NODE'
const fs=require("fs");fs.writeFileSync(process.argv[2],JSON.stringify({schema:"izakhono.pay-public/v1",hostname:"pay.izakhonoafrica.co.za",transport:"Cloudflare Tunnel",tunnel_id:process.argv[3]||null,fortress:true,ikhokha_primary:true,public_https_verified:true,laptop_dependency:false,verified_at:new Date().toISOString()},null,2)+"\n",{mode:0o600});
NODE
echo "IZAKHONO PAY PUBLIC: LIVE AND VERIFIED"
