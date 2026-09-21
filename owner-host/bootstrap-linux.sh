#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo -E bash "$0" "$@"
fi

REPO_URL="https://github.com/bevanshelton-netizen/Downloads.git"
ROOT="/opt/izakhono-source"
REPO="$ROOT/Downloads"
REPORT_DIR="/var/lib/izakhono-deploy"
REPORT="$REPORT_DIR/owner-host.json"

need_root_cmd(){ command -v "$1" >/dev/null 2>&1; }

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git jq openssl docker.io python3 sqlite3
systemctl enable --now docker

if ! command -v node >/dev/null 2>&1 || ! node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)' >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource-22.sh
  bash /tmp/nodesource-22.sh
  rm -f /tmp/nodesource-22.sh
  apt-get install -y nodejs
fi

mkdir -p "$ROOT" "$REPORT_DIR"
chmod 0700 "$REPORT_DIR"

if [ ! -d "$REPO/.git" ]; then
  git clone --filter=blob:none "$REPO_URL" "$REPO"
else
  if [ -n "$(git -C "$REPO" status --porcelain)" ]; then
    echo "Owner-host source checkout has local changes; refusing to overwrite." >&2
    exit 3
  fi
  git -C "$REPO" fetch origin main
  git -C "$REPO" checkout main
  git -C "$REPO" reset --hard origin/main
fi

cd "$REPO"

export IZAKHONO_EDGE_MODE=tunnel
bash izakhono-owned-cloud/install-owned-stack.sh
bash izakhono-owned-cloud/deploy-fortress-protector.sh
bash izakhono-owned-cloud/configure-growth-os.sh
bash izakhono-owned-cloud/configure-stack-backup.sh

if [ ! -f /etc/izakhono/code-source.env ]; then
  bash izakhono-owned-cloud/migrate-source-to-code.sh
fi

bash izakhono-owned-cloud/first-host-proof.sh

echo "Deploying IZAKHONO Growth OS v2 to the owned runtime..."
export GROWTH_OS_V2_HOSTNAME="${GROWTH_OS_V2_HOSTNAME:-growth.domains.izakhonoafrica.co.za}"
bash izakhono-owned-cloud/deploy-growth-os-v2.sh main
GROWTH_OS_STATE="RUNTIME_VERIFIED"
if [ -f /var/lib/izakhono-deploy/growth-os-v2.json ]; then
  if grep -q '"public_https": "VERIFIED"' /var/lib/izakhono-deploy/growth-os-v2.json 2>/dev/null; then
    GROWTH_OS_STATE="PUBLIC_HTTPS_VERIFIED"
  fi
fi

TUNNEL_STATE="TOKEN_REQUIRED"
if [ -s /etc/izakhono/cloudflare-tunnel.token ]; then
  if bash owner-host/install-cloudflare-tunnel.sh; then
    TUNNEL_STATE="ACTIVE"
  else
    TUNNEL_STATE="FAILED"
  fi
else
  install -d -m 0700 /etc/izakhono
  : > /etc/izakhono/cloudflare-tunnel.token
  chmod 0600 /etc/izakhono/cloudflare-tunnel.token
fi

OWNED_EDGE_STATE="NOT_ATTEMPTED"
set +e
IZAKHONO_PUBLIC_EXTRA_HOSTS="${IZAKHONO_PUBLIC_EXTRA_HOSTS:-growth.domains.izakhonoafrica.co.za}" \
  bash izakhono-owned-cloud/activate-owned-public-edge.sh
OWNED_EDGE_CODE=$?
set -e
case "$OWNED_EDGE_CODE" in
  0) OWNED_EDGE_STATE="ACTIVE_HYBRID" ;;
  20) OWNED_EDGE_STATE="PARENT_DNS_OR_ROUTER_REQUIRED" ;;
  21) OWNED_EDGE_STATE="TLS_OR_PORTS_REQUIRED" ;;
  *) OWNED_EDGE_STATE="FAILED_$OWNED_EDGE_CODE" ;;
esac

SOURCE_COMMIT="$(git rev-parse HEAD)"
node - "$REPORT" "$SOURCE_COMMIT" "$TUNNEL_STATE" "$GROWTH_OS_STATE" "$OWNED_EDGE_STATE" <<'NODE'
const fs=require("fs");
const [path,commit,tunnel,growthOs,ownedEdge]=process.argv.slice(2);
const body={
  schema:"izakhono.owner-host/v1",
  node_name:"ISN-01",
  source_commit:commit,
  runtime:"owner-controlled-linux",
  edge_mode:"cloudflare-tunnel-origin",
  edge_origin:"http://127.0.0.1:8780",
  fortress_private_control_plane:true,
  growth_os_v2:growthOs,
  tunnel_state:tunnel,
  owned_public_edge_state:ownedEdge,
  source_of_truth:"IZAKHONO CODE after bootstrap migration",
  public_ready:tunnel==="ACTIVE"||ownedEdge==="ACTIVE_HYBRID",
  commercial_ready:false,
  generated_at:new Date().toISOString()
};
fs.writeFileSync(path,JSON.stringify(body,null,2)+"\n",{mode:0o600});
console.log(JSON.stringify(body,null,2));
NODE
chmod 0600 "$REPORT"

echo
echo "IZAKHONO OWNER HOST SOFTWARE: READY"
echo "Owner-host receipt: $REPORT"
if [ "$OWNED_EDGE_STATE" = "ACTIVE_HYBRID" ]; then
  echo "PUBLIC INGRESS: IZAKHONO-owned HTTPS ACTIVE; tunnel fallback remains available"
elif [ "$TUNNEL_STATE" = "ACTIVE" ]; then
  echo "PUBLIC INGRESS: ACTIVE through the configured tunnel; owned-edge state=$OWNED_EDGE_STATE"
else
  echo "PUBLIC INGRESS: owned-edge state=$OWNED_EDGE_STATE; tunnel token may still be required at /etc/izakhono/cloudflare-tunnel.token"
fi
echo "GROWTH OS v2: deployed to IZAKHONO RUNTIME and health-gated"
echo "KORA and other applications remain behind their own readiness/payment gates until deployed."
