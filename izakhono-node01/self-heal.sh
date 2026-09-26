#!/usr/bin/env bash
set -euo pipefail
if [ "${EUID:-$(id -u)}" -ne 0 ]; then exec sudo -E bash "$0" "$@"; fi

REPORT_DIR=/var/lib/izakhono-node01
REPORT="$REPORT_DIR/self-heal.json"
mkdir -p "$REPORT_DIR"
chmod 0700 "$REPORT_DIR"

services=(
  izakhono-data-node
  izakhono-runtime-node
  izakhono-object-node
  izakhono-queue-node
  izakhono-auth-node
  izakhono-analytics-node
  izakhono-notify-node
  izakhono-ai-gateway-node
  izakhono-code-node
  izakhono-package-node
  izakhono-ci-worker-node
  izakhono-backup-node
  izakhono-replica-node
  izakhono-failover-node
  izakhono-dns-node
  izakhono-node01
)

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
restarted=0
checked=0

for service in "${services[@]}"; do
  if ! systemctl list-unit-files "${service}.service" --no-legend 2>/dev/null | grep -q "^"; then
    printf '%s\t%s\n' "$service" "not-installed" >>"$tmp"
    continue
  fi
  enabled="$(systemctl is-enabled "$service" 2>/dev/null || true)"
  if [ "$enabled" != "enabled" ] && [ "$enabled" != "static" ]; then
    printf '%s\t%s\n' "$service" "not-enabled" >>"$tmp"
    continue
  fi
  checked=$((checked+1))
  if systemctl is-active --quiet "$service"; then
    printf '%s\t%s\n' "$service" "active" >>"$tmp"
    continue
  fi
  systemctl restart "$service" >/dev/null 2>&1 || true
  sleep 1
  if systemctl is-active --quiet "$service"; then
    restarted=$((restarted+1))
    printf '%s\t%s\n' "$service" "restarted" >>"$tmp"
  else
    printf '%s\t%s\n' "$service" "failed" >>"$tmp"
  fi
done

node - "$REPORT" "$tmp" "$checked" "$restarted" <<'NODE'
const fs=require('fs');
const [path,tsv,checked,restarted]=process.argv.slice(2);
const services=fs.readFileSync(tsv,'utf8').trim().split(/\n/).filter(Boolean).map(line=>{
  const [service,state]=line.split('\t');
  return {service,state};
});
fs.writeFileSync(path,JSON.stringify({
  schema:'izakhono.node01-self-heal/v1',
  node:'NODE01',
  authority:'IZAKHONO',
  checked:Number(checked),
  restarted:Number(restarted),
  services,
  public_dns_changed:false,
  payment_routing_changed:false,
  external_provider_credentials_changed:false,
  generated_at:new Date().toISOString()
},null,2)+'\n',{mode:0o600});
NODE
chmod 0600 "$REPORT"
