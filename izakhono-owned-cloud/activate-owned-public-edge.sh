#!/usr/bin/env bash
set -euo pipefail
if [ "${EUID:-$(id -u)}" -ne 0 ]; then exec sudo -E bash "$0" "$@"; fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOSTNAME="${IZAKHONO_PUBLIC_HOSTNAME:-domains.izakhonoafrica.co.za}"
ZONE="${IZAKHONO_PUBLIC_ZONE:-domains.izakhonoafrica.co.za}"
EXTRA_HOSTS_RAW="${IZAKHONO_PUBLIC_EXTRA_HOSTS:-growth.domains.izakhonoafrica.co.za}"
NS1="${IZAKHONO_NS1:-ns1.izakhonoafrica.co.za}"
NS2="${IZAKHONO_NS2:-}"
REPORT=/var/lib/izakhono-deploy/owned-public-edge.json
mkdir -p /var/lib/izakhono-deploy
chmod 0700 /var/lib/izakhono-deploy

need(){ command -v "$1" >/dev/null 2>&1 || { echo "Missing $1" >&2; exit 2; }; }
for c in curl node ip systemctl openssl python3; do need "$c"; done

LOCAL_IP="${IZAKHONO_OWNER_LAN_IPV4:-$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src"){print $(i+1);exit}}')}"
[ -n "$LOCAL_IP" ] || { echo "Could not determine owner-host IPv4." >&2; exit 3; }

PUBLIC_IP="${IZAKHONO_PUBLIC_IPV4:-}"
if [ -z "$PUBLIC_IP" ]; then PUBLIC_IP="$(curl -4fsS --max-time 8 https://api.ipify.org || true)"; fi
node -e 'const p=process.argv[1].split(".").map(Number);if(p.length!==4||p.some(x=>!Number.isInteger(x)||x<0||x>255))process.exit(1)' "$PUBLIC_IP" || {
  echo "A usable public IPv4 was not detected. Set IZAKHONO_PUBLIC_IPV4 explicitly." >&2
  exit 4
}

echo "IZAKHONO OWNED PUBLIC EDGE"
echo "Owner host LAN IPv4: $LOCAL_IP"
echo "Detected public IPv4: $PUBLIC_IP"

cd "$ROOT/izakhono-dns-node"
bash install-linux.sh

SERIAL="$(date -u +%Y%m%d%H)"
node - /etc/izakhono/dns-zone.json "$ZONE" "$HOSTNAME" "$NS1" "$NS2" "$PUBLIC_IP" "$SERIAL" "$EXTRA_HOSTS_RAW" <<'NODE'
const fs=require("fs");
const [path,zoneName,hostName,ns1,ns2,ip,serial,extraRaw]=process.argv.slice(2);
const zoneBare=zoneName.replace(/\.$/,"").toLowerCase();
const hostBare=hostName.replace(/\.$/,"").toLowerCase();
const zone=zoneBare+".";
const records=[
  {name:"@",type:"NS",value:ns1.replace(/\.$/,"")+".",ttl:300},
  {name:"@",type:"A",value:ip,ttl:120}
];
if(ns2) records.splice(1,0,{name:"@",type:"NS",value:ns2.replace(/\.$/,"")+".",ttl:300});
function addHost(host){
  const bare=host.replace(/\.$/,"").toLowerCase();
  if(!bare || bare===zoneBare) return;
  if(!bare.endsWith("."+zoneBare)) throw new Error("Public hostname must be inside IZAKHONO_PUBLIC_ZONE: "+bare);
  const relative=bare.slice(0,-1-zoneBare.length);
  if(!records.some(r=>r.type==="A"&&r.name===relative)) records.push({name:relative,type:"A",value:ip,ttl:120});
}
addHost(hostBare);
for(const extra of (extraRaw||"").split(/[\s,]+/).filter(Boolean)) addHost(extra);
const body={
  zone,ttl:300,
  soa:{mname:ns1.replace(/\.$/,"")+".",rname:"hostmaster.izakhonoafrica.co.za.",serial:Number(serial),refresh:3600,retry:600,expire:1209600,minimum:300},
  records
};
fs.writeFileSync(path,JSON.stringify(body,null,2)+"\n",{mode:0o640});
NODE
chown root:izakhono-dns /etc/izakhono/dns-zone.json
chmod 0640 /etc/izakhono/dns-zone.json

python3 - /etc/izakhono/dns-node.env "$LOCAL_IP" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1]); host=sys.argv[2]
updates={"IZAKHONO_DNS_HOST":host,"IZAKHONO_DNS_PORT":"53","IZAKHONO_DNS_TCP":"true"}
lines=p.read_text().splitlines(); seen=set(); out=[]
for line in lines:
    if "=" in line and not line.lstrip().startswith("#"):
        k=line.split("=",1)[0]
        if k in updates:
            out.append(f"{k}={updates[k]}"); seen.add(k); continue
    out.append(line)
for k,v in updates.items():
    if k not in seen: out.append(f"{k}={v}")
p.write_text("\n".join(out)+"\n")
PY
systemctl restart izakhono-dns-node
sleep 1
curl -fsS http://127.0.0.1:8900/health >/dev/null

node - "$LOCAL_IP" "$ZONE" "$HOSTNAME" "$EXTRA_HOSTS_RAW" <<'NODE'
const d=require("dgram");
const host=process.argv[2];
const extra=(process.argv[5]||"").split(/[\s,]+/).filter(Boolean);
const names=[process.argv[3],process.argv[4],...extra].map(x=>x.replace(/\.$/,""));
function query(name,id){
  return new Promise((resolve,reject)=>{
    const labels=name.split(".");
    const q=Buffer.concat([Buffer.from([(id>>8)&255,id&255,0x01,0x00,0x00,0x01,0,0,0,0,0,0]),...labels.flatMap(x=>[Buffer.from([Buffer.byteLength(x)]),Buffer.from(x)]),Buffer.from([0,0,1,0,1])]);
    const s=d.createSocket("udp4");
    const t=setTimeout(()=>{s.close();reject(new Error("DNS local authoritative probe timed out: "+name));},2500);
    s.on("message",m=>{clearTimeout(t);s.close();if(m.length<12||m.readUInt16BE(6)<1)reject(new Error("No authoritative A answer for "+name));else resolve();});
    s.send(q,53,host);
  });
}
(async()=>{let i=0x1234;for(const name of [...new Set(names)])await query(name,i++);})().catch(e=>{console.error(e.message);process.exit(2)});
NODE

HOST_A_READY=false
RESOLVED="$(getent ahostsv4 "$HOSTNAME" 2>/dev/null | awk 'NR==1{print $1}' || true)"
if [ "$RESOLVED" = "$PUBLIC_IP" ]; then HOST_A_READY=true; fi

EXTRA_A_READY=true
for extra_host in $(printf '%s' "$EXTRA_HOSTS_RAW" | tr ',' ' '); do
  [ -n "$extra_host" ] || continue
  EXTRA_RESOLVED="$(getent ahostsv4 "$extra_host" 2>/dev/null | awk 'NR==1{print $1}' || true)"
  if [ "$EXTRA_RESOLVED" != "$PUBLIC_IP" ]; then EXTRA_A_READY=false; fi
done

DELEGATION_READY=false
if node - "$ZONE" "$NS1" <<'NODE'
const dns=require("dns").promises;
const [zone,expected]=process.argv.slice(2);
dns.resolveNs(zone).then(xs=>{
  const want=expected.toLowerCase().replace(/\.$/,"");
  process.exit(xs.map(x=>x.toLowerCase().replace(/\.$/,"")).includes(want)?0:1);
}).catch(()=>process.exit(1));
NODE
then DELEGATION_READY=true; fi

TLS_READY=false
if [ -f /etc/izakhono/tls/fullchain.pem ] && [ -f /etc/izakhono/tls/privkey.pem ] && openssl x509 -in /etc/izakhono/tls/fullchain.pem -noout -checkhost "$HOSTNAME" >/dev/null 2>&1; then
  TLS_READY=true
  for extra_host in $(printf '%s' "$EXTRA_HOSTS_RAW" | tr ',' ' '); do
    [ -n "$extra_host" ] || continue
    if ! openssl x509 -in /etc/izakhono/tls/fullchain.pem -noout -checkhost "$extra_host" >/dev/null 2>&1; then TLS_READY=false; fi
  done
fi

if [ "$HOST_A_READY" = true ] && [ "$DELEGATION_READY" = true ] && [ "$TLS_READY" = false ]; then
  echo "Owned DNS delegation is visible. Attempting trusted ACME TLS..."
  apt-get update >/dev/null
  apt-get install -y certbot >/dev/null
  EDGE_WAS_ACTIVE=false
  if systemctl is-active --quiet izakhono-edge-node 2>/dev/null; then EDGE_WAS_ACTIVE=true; systemctl stop izakhono-edge-node; fi
  CERT_NAME="izakhono-owned-edge"
  CERT_ARGS=(-d "$ZONE")
  if [ "$HOSTNAME" != "$ZONE" ]; then CERT_ARGS+=(-d "$HOSTNAME"); fi
  for extra_host in $(printf '%s' "$EXTRA_HOSTS_RAW" | tr ',' ' '); do
    [ -n "$extra_host" ] || continue
    if [ "$extra_host" != "$ZONE" ] && [ "$extra_host" != "$HOSTNAME" ]; then CERT_ARGS+=(-d "$extra_host"); fi
  done
  EXPAND_ARGS=()
  if [ -d "/etc/letsencrypt/live/$CERT_NAME" ]; then EXPAND_ARGS+=(--expand); fi
  if certbot certonly --standalone --preferred-challenges http --non-interactive --agree-tos --register-unsafely-without-email --cert-name "$CERT_NAME" "${EXPAND_ARGS[@]}" "${CERT_ARGS[@]}"; then
    mkdir -p /etc/izakhono/tls
    ln -sfn "/etc/letsencrypt/live/$CERT_NAME/fullchain.pem" /etc/izakhono/tls/fullchain.pem
    ln -sfn "/etc/letsencrypt/live/$CERT_NAME/privkey.pem" /etc/izakhono/tls/privkey.pem
    TLS_READY=true
  else
    if [ "$EDGE_WAS_ACTIVE" = true ]; then systemctl start izakhono-edge-node || true; fi
  fi
fi

EDGE_DIRECT=false
GROWTH_OS_EDGE=false
if [ "$TLS_READY" = true ]; then
  cd "$ROOT/izakhono-edge-node"
  IZAKHONO_EDGE_MODE=direct bash install-linux.sh >/dev/null
  sleep 1
  EDGE_JSON="$(curl -fsS http://127.0.0.1:8795/health)"
  node -e 'const x=JSON.parse(process.argv[1]);if(x.status!=="healthy"||x.ingressMode!=="direct"||x.tls!==true||x.fortressProtector!==true)process.exit(1)' "$EDGE_JSON"
  curl -kfsS --resolve "$HOSTNAME:443:127.0.0.1" "https://$HOSTNAME/health" >/dev/null
  EDGE_DIRECT=true
  if curl -kfsS --resolve "growth.domains.izakhonoafrica.co.za:443:127.0.0.1" "https://growth.domains.izakhonoafrica.co.za/api/health" >/tmp/growth-os-owned-edge.json 2>/dev/null; then
    if node -e 'const x=require("/tmp/growth-os-owned-edge.json");if(x.ok!==true||x.service!=="growth-os-v2")process.exit(2)' 2>/dev/null; then GROWTH_OS_EDGE=true; fi
  fi
fi

node - "$REPORT" "$LOCAL_IP" "$PUBLIC_IP" "$HOSTNAME" "$ZONE" "$NS1" "$NS2" "$HOST_A_READY" "$EXTRA_A_READY" "$DELEGATION_READY" "$TLS_READY" "$EDGE_DIRECT" "$GROWTH_OS_EDGE" "$EXTRA_HOSTS_RAW" <<'NODE'
const fs=require("fs");
const [path,lan,publicIp,host,zone,ns1,ns2,aReady,extraAReady,delegation,tls,edge,growthOsEdge,extraRaw]=process.argv.slice(2);
const body={
  schema:"izakhono.owned-public-edge/v1",
  owner_host_lan_ipv4:lan,
  public_ipv4:publicIp,
  hostname:host,
  authoritative_zone:zone,
  nameservers:[ns1,...(ns2?[ns2]:[])],
  hostname_resolves_to_owner_ip:aReady==="true",
  extra_hostnames:(extraRaw||"").split(/[\s,]+/).filter(Boolean),
  extra_hostnames_resolve_to_owner_ip:extraAReady==="true",
  growth_os_edge_verified:growthOsEdge==="true",
  parent_delegation_observed:delegation==="true",
  tls_ready:tls==="true",
  edge_direct:edge==="true",
  fortress:true,
  cloudflare_compute_required:false,
  cloudflare_tunnel_required:false,
  public_ready:aReady==="true"&&extraAReady==="true"&&delegation==="true"&&tls==="true"&&edge==="true",
  required_inbound_ports:["53/udp","53/tcp","80/tcp","443/tcp"],
  generated_at:new Date().toISOString()
};
fs.writeFileSync(path,JSON.stringify(body,null,2)+"\n",{mode:0o600});
console.log(JSON.stringify(body,null,2));
NODE
chmod 0600 "$REPORT"

if [ "$DELEGATION_READY" != true ] || [ "$HOST_A_READY" != true ] || [ "$EXTRA_A_READY" != true ]; then
  echo
  echo "ONE-TIME PARENT DNS BOOTSTRAP REQUIRED:"
  echo "  A  $NS1 -> $PUBLIC_IP"
  echo "  NS $ZONE -> $NS1"
  if [ -n "$NS2" ]; then
    echo "  A  $NS2 -> ${IZAKHONO_SECONDARY_DNS_IPV4:-<secondary-public-ip>}"
    echo "  NS $ZONE -> $NS2"
  fi
  echo
  if [ "$HOSTNAME" != "$ZONE" ]; then
    echo "  Owned DNS will publish A $HOSTNAME -> $PUBLIC_IP automatically after delegation."
  fi
  for extra_host in $(printf '%s' "$EXTRA_HOSTS_RAW" | tr ',' ' '); do
    [ -n "$extra_host" ] && echo "  Owned DNS will publish A $extra_host -> $PUBLIC_IP automatically after delegation."
  done
  echo "Router/firewall must forward 53/udp, 53/tcp, 80/tcp and 443/tcp to $LOCAL_IP."
  echo "After propagation, rerun this launcher. It will obtain TLS and switch EDGE to direct mode."
  exit 20
fi

if [ "$EDGE_DIRECT" != true ]; then
  echo "Owned DNS delegation is visible, but trusted TLS/direct EDGE could not yet be proved."
  echo "Ensure inbound TCP 80 and 443 reach $LOCAL_IP, then rerun."
  exit 21
fi

echo
echo "IZAKHONO OWNED PUBLIC EDGE: LOCAL CUTOVER PROVED"
echo "Cloudflare Tunnel is no longer required for $HOSTNAME."
echo "Keep the existing tunnel for other hostnames until each is migrated separately."
