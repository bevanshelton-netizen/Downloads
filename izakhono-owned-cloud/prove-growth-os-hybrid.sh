#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo -E bash "$0" "$@"
fi

OWNED_HOST="${IZAKHONO_HYBRID_OWNED_HOST:-growth.domains.izakhonoafrica.co.za}"
EDGE_ORIGIN="${IZAKHONO_HYBRID_EDGE_ORIGIN:-http://127.0.0.1:8780}"
TAILSCALE_REPORT="${IZAKHONO_HYBRID_TAILSCALE_REPORT:-/var/lib/izakhono-deploy/tailscale-funnel-growth-os.json}"
EXTERNAL_URL="${IZAKHONO_HYBRID_EXTERNAL_URL:-https://izakhono-growth-os.vercel.app}"
EXTERNAL_STATUS_PATH="${IZAKHONO_HYBRID_EXTERNAL_STATUS_PATH:-/api/status}"
REPORT_DIR=/var/lib/izakhono-deploy/proofs
REPORT="$REPORT_DIR/growth-os-hybrid-proof.json"

need(){ command -v "$1" >/dev/null 2>&1 || { echo "FAIL: $1 is required" >&2; exit 2; }; }
for cmd in curl node; do need "$cmd"; done

mkdir -p "$REPORT_DIR"
chmod 0700 "$REPORT_DIR"

OWNED_READY=false
OWNED_HEALTH=""
if OWNED_HEALTH="$(curl -fsS --max-time 5 -H "Host: $OWNED_HOST" "$EDGE_ORIGIN/api/health" 2>/dev/null)"; then
  if node -e 'const x=JSON.parse(process.argv[1]); if(x.ok!==true||x.service!=="growth-os-v2"||x.runtime!=="izakhono-owned") process.exit(2)' "$OWNED_HEALTH" 2>/dev/null; then
    OWNED_READY=true
  fi
fi

BRIDGE_READY=false
BRIDGE_URL=""
BRIDGE_PROVIDER="tailscale-funnel"
if [ -f "$TAILSCALE_REPORT" ]; then
  BRIDGE_HOST="$(node -e 'const fs=require("fs");const x=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(x.public_ready===true&&x.hostname)process.stdout.write(x.hostname)' "$TAILSCALE_REPORT" 2>/dev/null || true)"
  if [ -n "$BRIDGE_HOST" ]; then
    BRIDGE_URL="https://$BRIDGE_HOST"
    if BRIDGE_HEALTH="$(curl -fsS --max-time 8 "$BRIDGE_URL/api/health" 2>/dev/null)"; then
      if node -e 'const x=JSON.parse(process.argv[1]); if(x.ok!==true||x.service!=="growth-os-v2") process.exit(2)' "$BRIDGE_HEALTH" 2>/dev/null; then
        BRIDGE_READY=true
      fi
    fi
  fi
fi

EXTERNAL_READY=false
EXTERNAL_SAFE=false
EXTERNAL_STATUS=""
if EXTERNAL_STATUS="$(curl -fsS --max-time 8 "$EXTERNAL_URL$EXTERNAL_STATUS_PATH" 2>/dev/null)"; then
  if node -e '
    const x=JSON.parse(process.argv[1]);
    if(x.product!=="IZAKHONO GROWTH OS") process.exit(2);
    if(x.liveAdWrites!==false) process.exit(3);
  ' "$EXTERNAL_STATUS" 2>/dev/null; then
    EXTERNAL_READY=true
    EXTERNAL_SAFE=true
  fi
fi

MODE="DEGRADED"
PUBLIC_READ_PATH="NONE"
WRITE_PATH="BLOCKED"

if [ "$OWNED_READY" = true ]; then
  WRITE_PATH="OWNED"
  if [ "$BRIDGE_READY" = true ]; then
    MODE="HYBRID_OWNED_PLUS_EXTERNAL_TRANSPORT"
    PUBLIC_READ_PATH="OWNED_OR_TAILSCALE"
  else
    MODE="OWNED_PRIMARY"
    PUBLIC_READ_PATH="OWNED"
  fi
elif [ "$BRIDGE_READY" = true ]; then
  MODE="EXTERNAL_TRANSPORT_TO_OWNED_COMPUTE"
  PUBLIC_READ_PATH="TAILSCALE_TO_OWNED"
  WRITE_PATH="OWNED_VIA_BRIDGE"
elif [ "$EXTERNAL_READY" = true ] && [ "$EXTERNAL_SAFE" = true ]; then
  MODE="EXTERNAL_COMPUTE_SAFE_FALLBACK"
  PUBLIC_READ_PATH="VERCEL_SAFE"
  WRITE_PATH="BLOCKED"
fi

HYBRID_READY=false
if [ "$OWNED_READY" = true ] && { [ "$BRIDGE_READY" = true ] || [ "$EXTERNAL_READY" = true ]; }; then
  HYBRID_READY=true
fi

TMP="$(mktemp)"
OWNED_READY="$OWNED_READY" BRIDGE_READY="$BRIDGE_READY" BRIDGE_URL="$BRIDGE_URL" EXTERNAL_READY="$EXTERNAL_READY" EXTERNAL_SAFE="$EXTERNAL_SAFE" EXTERNAL_URL="$EXTERNAL_URL" MODE="$MODE" PUBLIC_READ_PATH="$PUBLIC_READ_PATH" WRITE_PATH="$WRITE_PATH" HYBRID_READY="$HYBRID_READY" OWNED_HOST="$OWNED_HOST" node - <<'NODE' >"$TMP"
const report={
  schema:"izakhono.hybrid-resilience/v1",
  product:"IZAKHONO GROWTH OS",
  policy:"owned-primary_external-resilience",
  owned:{
    hostname:process.env.OWNED_HOST,
    ready:process.env.OWNED_READY==="true",
    authority:["writes","data","auth","payments","fortress"]
  },
  external_transport:{
    provider:"tailscale-funnel",
    url:process.env.BRIDGE_URL||null,
    ready:process.env.BRIDGE_READY==="true",
    compute:"izakhono-owned"
  },
  external_compute:{
    provider:"vercel",
    url:process.env.EXTERNAL_URL,
    ready:process.env.EXTERNAL_READY==="true",
    safe_readonly:process.env.EXTERNAL_SAFE==="true",
    write_authority:false
  },
  decision:{
    mode:process.env.MODE,
    public_read_path:process.env.PUBLIC_READ_PATH,
    write_path:process.env.WRITE_PATH,
    hybrid_ready:process.env.HYBRID_READY==="true",
    automatic_dns_mutation:false,
    automatic_payment_reroute:false
  },
  generated_at:new Date().toISOString()
};
process.stdout.write(JSON.stringify(report,null,2)+"\n");
NODE

install -o root -g izakhono -m 0640 "$TMP" "$REPORT"
rm -f "$TMP"

cat "$REPORT"

if [ "$OWNED_READY" != true ]; then
  echo "WARNING: owned Growth OS route is not currently proven healthy on this host." >&2
fi
if [ "$EXTERNAL_READY" != true ]; then
  echo "WARNING: external Vercel contingency is not currently healthy/safe." >&2
fi

echo
echo "IZAKHONO HYBRID RESILIENCE MODE=$MODE"
echo "PUBLIC_READ_PATH=$PUBLIC_READ_PATH"
echo "WRITE_PATH=$WRITE_PATH"
echo "AUTOMATIC_DNS_MUTATION=NO"
echo "AUTOMATIC_PAYMENT_REROUTE=NO"
echo "REPORT=$REPORT"
