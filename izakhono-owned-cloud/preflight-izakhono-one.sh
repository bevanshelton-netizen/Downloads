#!/usr/bin/env bash
set -euo pipefail

HOSTNAME="\${IZAKHONO_ONE_AI_HOSTNAME:-one.domains.izakhonoafrica.co.za}"
REPORT_DIR="/var/lib/izakhono-deploy"
REPORT="$REPORT_DIR/izakhono-one-deployment-readiness.json"
SUMMARY="$REPORT_DIR/izakhono-one-deployment-readiness.txt"

mkdir -p "$REPORT_DIR"

json_field(){
  node - "$1" "$2" <<'NODE'
const fs=require("fs");
const [path,key]=process.argv.slice(2);
try{
  const x=JSON.parse(fs.readFileSync(path,"utf8"));
  let v=x;
  for(const p of key.split(".")) v=v?.[p];
  if(typeof v==="boolean") process.stdout.write(v?"true":"false");
  else if(v==null) process.stdout.write("");
  else process.stdout.write(String(v));
}catch{ process.stdout.write(""); }
NODE
}

AUTH_HEALTH=false
NOTIFY_HEALTH=false
GATEWAY_HEALTH=false
GPU_HEALTH=false
MODEL_WORKER_HEALTH=false
RUNTIME_HEALTH=false
EDGE_HEALTH=false
LOCAL_ONE_HEALTH=false
PUBLIC_HTTPS=false
SMTP_VERIFIED=false
CHAT_READY=false
ACCOUNT_REACHABLE=false
PUBLIC_SIGNUP=false
DEPLOY_RECEIPT=false
MODEL_RECEIPT=false
CONFIG_RECEIPT=false

curl -fsS --max-time 3 http://127.0.0.1:8820/health >/tmp/one-preflight-auth.json 2>/dev/null && AUTH_HEALTH=true || true
curl -fsS --max-time 3 http://127.0.0.1:8840/health >/tmp/one-preflight-notify.json 2>/dev/null && NOTIFY_HEALTH=true || true
curl -fsS --max-time 3 http://127.0.0.1:8850/health >/tmp/one-preflight-gateway.json 2>/dev/null && GATEWAY_HEALTH=true || true
curl -fsS --max-time 3 http://127.0.0.1:8865/health >/tmp/one-preflight-gpu.json 2>/dev/null && GPU_HEALTH=true || true
curl -fsS --max-time 3 http://127.0.0.1:8866/health >/tmp/one-preflight-worker.json 2>/dev/null && MODEL_WORKER_HEALTH=true || true
curl -fsS --max-time 3 http://127.0.0.1:8790/health >/tmp/one-preflight-runtime.json 2>/dev/null && RUNTIME_HEALTH=true || true
curl -fsS --max-time 3 -H "Host: $HOSTNAME" http://127.0.0.1:8780/health >/tmp/one-preflight-edge.json 2>/dev/null && EDGE_HEALTH=true || true

if curl -fsS --max-time 5 -H "Host: $HOSTNAME" http://127.0.0.1:8080/health >/tmp/one-preflight-local.json 2>/dev/null; then
  if node -e 'const x=require("/tmp/one-preflight-local.json");process.exit(x.product==="IZAKHONO ONE AI"&&x.status==="healthy"?0:1)' 2>/dev/null; then
    LOCAL_ONE_HEALTH=true
    CHAT_READY="$(node -e 'const x=require("/tmp/one-preflight-local.json");process.stdout.write(String(x.chatReady===true))')"
    ACCOUNT_REACHABLE="$(node -e 'const x=require("/tmp/one-preflight-local.json");process.stdout.write(String(x.accountReachable===true))')"
    PUBLIC_SIGNUP="$(node -e 'const x=require("/tmp/one-preflight-local.json");process.stdout.write(String(x.publicSignup===true))')"
  fi
fi

if curl -fsS --max-time 8 "https://$HOSTNAME/health" >/tmp/one-preflight-public.json 2>/dev/null; then
  if node -e 'const x=require("/tmp/one-preflight-public.json");process.exit(x.product==="IZAKHONO ONE AI"&&x.status==="healthy"?0:1)' 2>/dev/null; then
    PUBLIC_HTTPS=true
  fi
fi

if [ -f /etc/izakhono/mail-relay.env ]; then
  MAIL_KEY="$(awk -F= '$1=="IZAKHONO_MAIL_ADAPTER_KEY"{sub(/^[^=]*=/,"");print;exit}' /etc/izakhono/mail-relay.env 2>/dev/null || true)"
  if [ -n "$MAIL_KEY" ]; then
    if curl -fsS --max-time 8 -X POST http://127.0.0.1:8870/v1/probe \
      -H "content-type: application/json" \
      -H "x-izakhono-adapter-key: $MAIL_KEY" \
      --data '{}' >/tmp/one-preflight-mail.json 2>/dev/null; then
      if node -e 'const x=require("/tmp/one-preflight-mail.json");process.exit(x.ready===true?0:1)' 2>/dev/null; then
        SMTP_VERIFIED=true
      fi
    fi
  fi
  unset MAIL_KEY
fi

[ -f "$REPORT_DIR/izakhono-one-ai-config.json" ] && CONFIG_RECEIPT=true || true
[ -f "$REPORT_DIR/izakhono-one-local-model.json" ] && MODEL_RECEIPT=true || true
[ -f "$REPORT_DIR/izakhono-one-ai.json" ] && DEPLOY_RECEIPT=true || true

if [ "$CONFIG_RECEIPT" = true ] && [ "$CHAT_READY" != true ]; then
  CHAT_READY="$(json_field "$REPORT_DIR/izakhono-one-ai-config.json" "ai.chat_ready")"
fi
if [ "$DEPLOY_RECEIPT" = true ]; then
  [ "$ACCOUNT_REACHABLE" = true ] || ACCOUNT_REACHABLE="$(json_field "$REPORT_DIR/izakhono-one-ai.json" "account_reachable")"
  [ "$PUBLIC_SIGNUP" = true ] || PUBLIC_SIGNUP="$(json_field "$REPORT_DIR/izakhono-one-ai.json" "public_signup")"
fi

TECHNICAL_RUNTIME_READY=false
if [ "$AUTH_HEALTH" = true ] &&
   [ "$NOTIFY_HEALTH" = true ] &&
   [ "$GATEWAY_HEALTH" = true ] &&
   [ "$GPU_HEALTH" = true ] &&
   [ "$MODEL_WORKER_HEALTH" = true ] &&
   [ "$RUNTIME_HEALTH" = true ] &&
   [ "$LOCAL_ONE_HEALTH" = true ] &&
   [ "$CHAT_READY" = true ] &&
   [ "$ACCOUNT_REACHABLE" = true ]; then
  TECHNICAL_RUNTIME_READY=true
fi

PUBLIC_PILOT_READY=false
if [ "$TECHNICAL_RUNTIME_READY" = true ] &&
   [ "$EDGE_HEALTH" = true ] &&
   [ "$PUBLIC_HTTPS" = true ] &&
   [ "$SMTP_VERIFIED" = true ] &&
   [ "$PUBLIC_SIGNUP" = true ]; then
  PUBLIC_PILOT_READY=true
fi

COMMERCIAL_READY=false
COMMERCIAL_REASON="Commercial gate remains separate: publish final pricing, legal terms/privacy/refund/support, and verify payment/entitlement end-to-end before sellable status."
if [ -f "$REPORT_DIR/izakhono-one-commercial-gate.json" ]; then
  COMMERCIAL_READY="$(json_field "$REPORT_DIR/izakhono-one-commercial-gate.json" "commercial_ready")"
fi

OVERALL="NO_GO"
if [ "$TECHNICAL_RUNTIME_READY" = true ]; then OVERALL="GO_TECHNICAL_RUNTIME_ONLY"; fi
if [ "$PUBLIC_PILOT_READY" = true ]; then OVERALL="GO_PUBLIC_PILOT"; fi
if [ "$COMMERCIAL_READY" = true ] && [ "$PUBLIC_PILOT_READY" = true ]; then OVERALL="GO_COMMERCIAL"; fi

TMP="$(mktemp)"
node - "$TMP" "$HOSTNAME" "$OVERALL" \
  "$AUTH_HEALTH" "$NOTIFY_HEALTH" "$GATEWAY_HEALTH" "$GPU_HEALTH" "$MODEL_WORKER_HEALTH" "$RUNTIME_HEALTH" "$EDGE_HEALTH" "$LOCAL_ONE_HEALTH" \
  "$CHAT_READY" "$ACCOUNT_REACHABLE" "$SMTP_VERIFIED" "$PUBLIC_SIGNUP" "$PUBLIC_HTTPS" \
  "$CONFIG_RECEIPT" "$MODEL_RECEIPT" "$DEPLOY_RECEIPT" "$TECHNICAL_RUNTIME_READY" "$PUBLIC_PILOT_READY" "$COMMERCIAL_READY" "$COMMERCIAL_REASON" <<'NODE'
const fs=require("fs");
const [
  path,hostname,overall,
  auth,notify,gateway,gpu,worker,runtime,edge,localOne,
  chat,account,smtp,signup,publicHttps,
  configReceipt,modelReceipt,deployReceipt,technical,pilot,commercial,commercialReason
]=process.argv.slice(2);
const B=v=>v==="true";
const checks={
  auth_health:B(auth),notify_health:B(notify),ai_gateway_health:B(gateway),
  gpu_compute_health:B(gpu),model_worker_health:B(worker),runtime_health:B(runtime),
  edge_health:B(edge),local_one_health:B(localOne),chat_ready:B(chat),
  account_reachable:B(account),smtp_verified:B(smtp),public_signup:B(signup),
  public_https:B(publicHttps),config_receipt:B(configReceipt),
  local_model_receipt:B(modelReceipt),deployment_receipt:B(deployReceipt)
};
const blockers=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);
const body={
  schema:"izakhono.one-deployment-readiness/v1",
  product:"IZAKHONO ONE",
  hostname,overall,
  readiness:{technical_runtime_ready:B(technical),public_pilot_ready:B(pilot),commercial_ready:B(commercial)},
  checks,blockers,commercial_note:commercialReason,generated_at:new Date().toISOString()
};
fs.writeFileSync(path,JSON.stringify(body,null,2)+"\n");
NODE
install -o root -g izakhono -m 0640 "$TMP" "$REPORT"
rm -f "$TMP"

node - "$REPORT" >"$SUMMARY" <<'NODE'
const x=require(process.argv[2]);
const yes=v=>v?"PASS":"WAIT";
console.log("IZAKHONO ONE — DEPLOYMENT READINESS");
console.log("Overall: "+x.overall);
console.log("Hostname: "+x.hostname);
console.log("");
console.log("Technical runtime: "+yes(x.readiness.technical_runtime_ready));
console.log("Public pilot:      "+yes(x.readiness.public_pilot_ready));
console.log("Commercial launch: "+yes(x.readiness.commercial_ready));
console.log("");
for(const [k,v] of Object.entries(x.checks)) console.log((v?"PASS ":"WAIT ")+k);
console.log("");
if(x.blockers.length) console.log("Blockers: "+x.blockers.join(", "));
console.log(x.commercial_note);
console.log("Generated: "+x.generated_at);
NODE
chmod 0640 "$SUMMARY"

cat "$SUMMARY"
echo
echo "JSON_RECEIPT=$REPORT"
echo "TEXT_RECEIPT=$SUMMARY"
