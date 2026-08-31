#!/usr/bin/env bash
set -euo pipefail

# IZAKHONO CLOUD v1.16 owner-node public ingress apply.
# Requires an existing READY node, explicit activation marker, Caddy and a
# previously generated public-ingress plan. Rolls Caddy config back if the
# externally addressed HTTPS health check does not pass.

PLAN=${1:-}
READY=${IZAKHONO_READY_MARKER:-/var/lib/izakhono-cloud/READY}
ACTIVATE=${IZAKHONO_PUBLIC_INGRESS_MARKER:-/etc/izakhono-cloud/ALLOW_PUBLIC_INGRESS}
CADDYFILE=${IZAKHONO_CADDYFILE:-/etc/caddy/Caddyfile}
FRAGDIR=${IZAKHONO_CADDY_FRAGMENT_DIR:-/etc/caddy/izakhono}

fail(){ echo "ERROR: $*" >&2; exit 2; }
[[ $EUID -eq 0 ]] || fail "run as root on the owner node"
[[ -n "$PLAN" && -f "$PLAN" ]] || fail "usage: $0 <public-ingress-plan.json>"
[[ -f "$READY" ]] || fail "owner node is not READY"
[[ -f "$ACTIVATE" ]] || fail "explicit public ingress activation marker missing: $ACTIVATE"
command -v python3 >/dev/null || fail "python3 is required"
command -v curl >/dev/null || fail "curl is required"
command -v caddy >/dev/null || fail "caddy is required"
[[ -f "$CADDYFILE" ]] || fail "Caddyfile not found: $CADDYFILE"

readarray -t F < <(python3 - "$PLAN" <<'PY'
import json,sys,re
p=json.load(open(sys.argv[1]))
assert p.get('schema')=='izakhono.public-ingress/v1'
assert p['truth_boundary']['planned_only'] is True
assert p['promotion']['requires_owner_ready_marker'] is True
assert p['promotion']['requires_explicit_public_ingress_activation'] is True
assert p['promotion']['requires_external_https_verification'] is True
h=p['hostname']; port=int(p['upstream']['port']); path=p['upstream']['health_path']
assert re.fullmatch(r'[a-z0-9.-]+',h) and '*' not in h
assert 1024 <= port <= 65535
assert path.startswith('/') and '\n' not in path and '\r' not in path
print(p['project']); print(h); print(port); print(path); print(p['route_config'])
PY
) || fail "invalid ingress plan"
PROJECT=${F[0]}; HOST=${F[1]}; PORT=${F[2]}; HEALTH=${F[3]}
ROUTE=$(python3 - "$PLAN" <<'PY'
import json,sys
print(json.load(open(sys.argv[1]))['route_config'], end='')
PY
)

# Refuse to expose a dead upstream.
curl --fail --silent --show-error --max-time 5 "http://127.0.0.1:${PORT}${HEALTH}" >/dev/null || fail "local upstream health failed"

mkdir -p "$FRAGDIR"
chmod 0755 "$FRAGDIR"
BACKUP=$(mktemp /tmp/izakhono-caddy.XXXXXX)
cp -a "$CADDYFILE" "$BACKUP"
FRAGMENT="$FRAGDIR/${PROJECT}.caddy"
OLD_FRAGMENT=""
if [[ -f "$FRAGMENT" ]]; then OLD_FRAGMENT=$(mktemp /tmp/izakhono-fragment.XXXXXX); cp -a "$FRAGMENT" "$OLD_FRAGMENT"; fi

rollback(){
  echo "Rolling back public ingress for $HOST" >&2
  cp -a "$BACKUP" "$CADDYFILE"
  if [[ -n "$OLD_FRAGMENT" && -f "$OLD_FRAGMENT" ]]; then cp -a "$OLD_FRAGMENT" "$FRAGMENT"; else rm -f "$FRAGMENT"; fi
  caddy validate --config "$CADDYFILE" >/dev/null 2>&1 && caddy reload --config "$CADDYFILE" >/dev/null 2>&1 || true
}
trap 'rollback' ERR

printf '%s' "$ROUTE" > "$FRAGMENT"
chmod 0644 "$FRAGMENT"
IMPORT='import /etc/caddy/izakhono/*.caddy'
grep -Fqx "$IMPORT" "$CADDYFILE" || printf '\n%s\n' "$IMPORT" >> "$CADDYFILE"

caddy validate --config "$CADDYFILE"
caddy reload --config "$CADDYFILE"

# Caddy ACME may take a short time. Require real hostname HTTPS before success.
PASS=0
for _ in $(seq 1 12); do
  if curl --fail --silent --show-error --max-time 8 "https://${HOST}${HEALTH}" >/dev/null 2>&1; then PASS=1; break; fi
  sleep 5
done
[[ "$PASS" == 1 ]] || fail "public HTTPS health proof did not pass; rollback required"

trap - ERR
rm -f "$BACKUP" ${OLD_FRAGMENT:+"$OLD_FRAGMENT"}
printf '{"project":"%s","hostname":"%s","public_https_health_passed":true,"public_ready":false,"commercial_ready":false}\n' "$PROJECT" "$HOST"
