#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

services=(
  izakhono-data-node
  izakhono-runtime-node
  izakhono-edge-node
  izakhono-object-node
  izakhono-queue-node
  izakhono-auth-node
  izakhono-analytics-node
  izakhono-notify-node
  izakhono-ai-gateway-node
  izakhono-code-node
  izakhono-backup-node
  izakhono-ci-worker-node
  izakhono-replica-node
  izakhono-dns-node
  izakhono-package-node
  izakhono-failover-node
  izakhono-witness-node
)

scripts=(
  izakhono-owned-cloud/install-owned-stack.sh
  izakhono-owned-cloud/deploy-primary-node.sh
  izakhono-owned-cloud/first-host-proof.sh
  izakhono-owned-cloud/deploy-witness-node.sh
  izakhono-owned-cloud/bootstrap-ha-cluster.sh
  izakhono-owned-cloud/configure-witness-member.sh
  izakhono-owned-cloud/set-witness-mode.sh
  izakhono-owned-cloud/prove-physical-ha.sh
  izakhono-owned-cloud/controlled-failover-drill.sh
  izakhono-owned-cloud/controlled-failback.sh
  izakhono-owned-cloud/configure-stack-backup.sh
  izakhono-owned-cloud/deploy-recovery-node.sh
  izakhono-owned-cloud/deploy-fortress-protector.sh
  izakhono-owned-cloud/go-live-izakhono-pay.sh
)

fail(){ echo "FAIL $*" >&2; exit 20; }
pass(){ echo "PASS $*"; }

node -e 'const [a,b]=process.versions.node.split(".").map(Number); if(a<22 || (a===22&&b<13)) process.exit(2)'   || fail "Node.js 22.13+ required"
pass "Node version"

for dir in "${services[@]}"; do
  [ -f "$dir/package.json" ] || fail "$dir package missing"
  [ -f "$dir/server.mjs" ] || fail "$dir server missing"
  deps="$(node -e 'const p=require("./'"$dir"'/package.json"); console.log(Object.keys(p.dependencies||{}).length)')"
  [ "$deps" = "0" ] || fail "$dir has runtime npm dependencies"
done
pass "17 owned node packages present with zero runtime npm dependencies"

for file in "${scripts[@]}"; do
  [ -f "$file" ] || fail "$file missing"
  bash -n "$file" || fail "$file shell syntax"
done
pass "Owned Cloud deployment and HA scripts parse cleanly"

grep -q 'automaticPromotion:false' izakhono-failover-node/server.mjs || fail "FAILOVER automatic promotion boundary missing"
grep -q 'fence-required' izakhono-failover-node/server.mjs || fail "FAILOVER fencing boundary missing"
grep -q 'automaticFailover:false' izakhono-witness-node/server.mjs || fail "WITNESS auto-failover boundary missing"
grep -q 'independentFailureDomainRequired:true' izakhono-witness-node/server.mjs || fail "WITNESS independent failure-domain requirement missing"
grep -q 'mode!=="enforce"' izakhono-runtime-node/witness-lease.mjs || fail "RUNTIME witness enforce gate missing"
grep -q 'mode!=="enforce"' izakhono-edge-node/witness-lease.mjs || fail "EDGE witness enforce gate missing"
grep -q 'write blocked because witness leadership lease is not valid' izakhono-runtime-node/server.mjs || fail "RUNTIME fail-closed write gate missing"
grep -q 'write blocked because witness leadership lease is not valid' izakhono-edge-node/server.mjs || fail "EDGE fail-closed write gate missing"
grep -q 'RUN-CONTROLLED-FAILOVER' izakhono-owned-cloud/controlled-failover-drill.sh || fail "Controlled failover explicit confirmation missing"
grep -q 'RUN-CONTROLLED-FAILBACK' izakhono-owned-cloud/controlled-failback.sh || fail "Controlled failback explicit confirmation missing"
pass "HA/fencing safety contracts"

grep -q 'payment_credentials_stored.*False' izakhono-owned-cloud/deploy-fortress-protector.sh || fail "FORTRESS payment-credential boundary missing"
grep -q '127.0.0.1' izakhono-owned-cloud/deploy-fortress-protector.sh || fail "FORTRESS private-bind contract missing"
pass "FORTRESS private protection boundary"

grep -q 'IZAKHONO_DNS_CONTROL_PORT || 8900' izakhono-dns-node/server.mjs || fail "DNS control port contract missing"
grep -q 'process.env.PORT || 8910' izakhono-package-node/server.mjs || fail "PACKAGE port contract missing"
grep -q 'PORT || 8920' izakhono-failover-node/server.mjs || fail "FAILOVER port contract missing"
grep -q 'PORT || 8930' izakhono-witness-node/server.mjs || fail "WITNESS port contract missing"
pass "Owned control-plane port contracts"

echo
echo "IZAKHONO OWNED CLOUD SOFTWARE ACCEPTANCE: STATIC PASS"
echo "Dynamic node self-tests and Growth OS build are enforced by the release workflow."
echo "Physical production activation is a separate acceptance stage."
