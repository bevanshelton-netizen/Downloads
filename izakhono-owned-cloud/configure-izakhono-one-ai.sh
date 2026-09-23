#!/usr/bin/env bash
set -euo pipefail

AUTH_ENV=/etc/izakhono/auth-node.env
NOTIFY_ENV=/etc/izakhono/notify-node.env
GATEWAY_ENV=/etc/izakhono/ai-gateway-node.env
GPU_ENV=/etc/izakhono/gpu-compute-node.env
MAIL_ENV=/etc/izakhono/mail-relay.env
APP_ENV=/etc/izakhono/apps/izakhono-one-ai.env
REPORT_DIR=/var/lib/izakhono-deploy
REPORT=$REPORT_DIR/izakhono-one-ai-config.json
PUBLIC_BASE="${IZAKHONO_ONE_PUBLIC_BASE_URL:-https://one.domains.izakhonoafrica.co.za}"
MODEL_ALIAS="${IZAKHONO_ONE_MODEL_ALIAS:-izakhono-one}"
GPU_MODEL_ALIAS="${IZAKHONO_GPU_DEFAULT_MODEL_ALIAS:-izakhono-small}"

fail(){ echo "FAIL: $*" >&2; exit 2; }
value(){
  local file="$1" key="$2"
  sudo awk -F= -v k="$key" '$1==k{sub(/^[^=]*=/,"");print;exit}' "$file" 2>/dev/null || true
}
put_env(){
  local file="$1" key="$2" val="$3"
  local tmp clean
  tmp="$(mktemp)"; clean="$(mktemp)"
  sudo cat "$file" >"$tmp" 2>/dev/null || true
  grep -v "^$key=" "$tmp" >"$clean" || true
  printf '%s=%s\n' "$key" "$val" >>"$clean"
  sudo install -o root -g izakhono -m 0640 "$clean" "$file"
  rm -f "$tmp" "$clean"
}

for f in "$AUTH_ENV" "$NOTIFY_ENV" "$GATEWAY_ENV" "$GPU_ENV"; do
  [ -f "$f" ] || fail "Required owned service environment missing: $f"
done

NOTIFY_KEY="$(value "$NOTIFY_ENV" IZAKHONO_NOTIFY_KEY)"
EMAIL_ADAPTER="$(value "$NOTIFY_ENV" IZAKHONO_EMAIL_ADAPTER_URL)"
EMAIL_TRANSPORT="none"
if [ -n "$EMAIL_ADAPTER" ]; then EMAIL_TRANSPORT="configured-fallback"; fi
if [ -f "$MAIL_ENV" ]; then
  SMTP_HOST="$(value "$MAIL_ENV" IZAKHONO_SMTP_HOST)"
  SMTP_FROM="$(value "$MAIL_ENV" IZAKHONO_SMTP_FROM)"
  MAIL_KEY="$(value "$MAIL_ENV" IZAKHONO_MAIL_ADAPTER_KEY)"
  if [ -n "$SMTP_HOST" ] && [ -n "$SMTP_FROM" ] && [ -n "$MAIL_KEY" ]; then
    put_env "$NOTIFY_ENV" IZAKHONO_EMAIL_ADAPTER_URL http://127.0.0.1:8870/v1/send
    put_env "$NOTIFY_ENV" IZAKHONO_NOTIFY_ADAPTER_KEY "$MAIL_KEY"
    sudo systemctl restart izakhono-mail-relay-adapter
    sudo systemctl restart izakhono-notify-node
    sleep 1
    MAIL_HEALTH="$(curl -fsS http://127.0.0.1:8870/health)"
    node -e 'const x=JSON.parse(process.argv[1]);if(x.status!=="healthy"||x.configured!==true)process.exit(2)' "$MAIL_HEALTH"
    EMAIL_ADAPTER=http://127.0.0.1:8870/v1/send
    EMAIL_TRANSPORT="izakhono-mail-relay"
  fi
fi
GATEWAY_ADMIN="$(value "$GATEWAY_ENV" IZAKHONO_AI_GATEWAY_ADMIN_KEY)"
GPU_KEY="$(value "$GPU_ENV" IZAKHONO_GPU_COMPUTE_KEY)"
[ -n "$NOTIFY_KEY" ] || fail "IZAKHONO NOTIFY key missing"
[ -n "$GATEWAY_ADMIN" ] || fail "AI Gateway admin key missing"
[ -n "$GPU_KEY" ] || fail "GPU Compute service key missing"

SIGNUP_ENABLED=false
if [ -n "$EMAIL_ADAPTER" ]; then SIGNUP_ENABLED=true; fi

put_env "$AUTH_ENV" IZAKHONO_AUTH_PUBLIC_SIGNUP "$SIGNUP_ENABLED"
put_env "$AUTH_ENV" IZAKHONO_AUTH_REQUIRE_EMAIL_VERIFICATION true
put_env "$AUTH_ENV" IZAKHONO_AUTH_PUBLIC_BASE_URL "$PUBLIC_BASE"
put_env "$AUTH_ENV" IZAKHONO_NOTIFY_URL http://127.0.0.1:8840
put_env "$AUTH_ENV" IZAKHONO_NOTIFY_KEY "$NOTIFY_KEY"
sudo systemctl restart izakhono-auth-node
sleep 1
curl -fsS http://127.0.0.1:8820/health >/tmp/izakhono-auth-health.json

PROVIDER_PAYLOAD="$(GPU_KEY="$GPU_KEY" node -e 'process.stdout.write(JSON.stringify({name:"izakhono-gpu-compute",baseUrl:"http://127.0.0.1:8865",isLocal:true,priority:1,timeoutMs:120000,apiKey:process.env.GPU_KEY}))')"
PROVIDER_RESPONSE="$(curl -fsS -X POST http://127.0.0.1:8850/v1/admin/providers -H "content-type: application/json" -H "x-izakhono-key: $GATEWAY_ADMIN" --data-binary "$PROVIDER_PAYLOAD")"
PROVIDER_ID="$(node -e 'const x=JSON.parse(process.argv[1]);if(!x.provider?.id)process.exit(2);process.stdout.write(x.provider.id)' "$PROVIDER_RESPONSE")"
unset GPU_KEY PROVIDER_PAYLOAD PROVIDER_RESPONSE

ROUTE_PAYLOAD="$(MODEL_ALIAS="$MODEL_ALIAS" GPU_MODEL_ALIAS="$GPU_MODEL_ALIAS" PROVIDER_ID="$PROVIDER_ID" node -e 'process.stdout.write(JSON.stringify({alias:process.env.MODEL_ALIAS,providerId:process.env.PROVIDER_ID,upstreamModel:process.env.GPU_MODEL_ALIAS,rank:1,maxInputChars:500000}))')"
curl -fsS -X POST http://127.0.0.1:8850/v1/admin/routes -H "content-type: application/json" -H "x-izakhono-key: $GATEWAY_ADMIN" --data-binary "$ROUTE_PAYLOAD" >/tmp/izakhono-one-route.json
unset ROUTE_PAYLOAD

sudo mkdir -p /etc/izakhono/apps /var/lib/izakhono-runtime/app-data/izakhono-one-ai "$REPORT_DIR"
sudo chown -R izakhono:izakhono /var/lib/izakhono-runtime/app-data/izakhono-one-ai
if [ ! -f "$APP_ENV" ]; then sudo install -o root -g izakhono -m 0640 /dev/null "$APP_ENV"; fi

ONE_SERVICE_KEY="$(value "$APP_ENV" IZAKHONO_ONE_AI_KEY)"
if [ -z "$ONE_SERVICE_KEY" ]; then
  ONE_SERVICE_KEY="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  put_env "$APP_ENV" IZAKHONO_ONE_AI_KEY "$ONE_SERVICE_KEY"
fi

CLIENT_KEY="$(value "$APP_ENV" IZAKHONO_ONE_AI_GATEWAY_KEY)"
if [ -z "$CLIENT_KEY" ]; then
  CLIENTS="$(curl -fsS http://127.0.0.1:8850/v1/admin/clients -H "x-izakhono-key: $GATEWAY_ADMIN")"
  CLIENT_ID="$(node -e 'const x=JSON.parse(process.argv[1]);const c=(x.clients||[]).find(v=>v.name==="izakhono-one");if(c)process.stdout.write(c.id)' "$CLIENTS")"
  if [ -n "$CLIENT_ID" ]; then
    ROTATED="$(curl -fsS -X POST "http://127.0.0.1:8850/v1/admin/clients/$CLIENT_ID/rotate-key" -H "content-type: application/json" -H "x-izakhono-key: $GATEWAY_ADMIN" --data '{}')"
    CLIENT_KEY="$(node -e 'const x=JSON.parse(process.argv[1]);if(!x.apiKey)process.exit(2);process.stdout.write(x.apiKey)' "$ROTATED")"
  else
    CREATED="$(MODEL_ALIAS="$MODEL_ALIAS" node -e 'process.stdout.write(JSON.stringify({name:"izakhono-one",allowedAliases:[process.env.MODEL_ALIAS],dailyRequests:1000000,dailyTokens:1000000000}))' | curl -fsS -X POST http://127.0.0.1:8850/v1/admin/clients -H "content-type: application/json" -H "x-izakhono-key: $GATEWAY_ADMIN" --data-binary @-)"
    CLIENT_KEY="$(node -e 'const x=JSON.parse(process.argv[1]);if(!x.apiKey)process.exit(2);process.stdout.write(x.apiKey)' "$CREATED")"
  fi
  put_env "$APP_ENV" IZAKHONO_ONE_AI_GATEWAY_KEY "$CLIENT_KEY"
fi

put_env "$APP_ENV" IZAKHONO_ONE_AI_GATEWAY_URL http://127.0.0.1:8850
put_env "$APP_ENV" IZAKHONO_ONE_AI_MODEL_ALIAS "$MODEL_ALIAS"
put_env "$APP_ENV" IZAKHONO_ONE_AUTH_URL http://127.0.0.1:8820
put_env "$APP_ENV" IZAKHONO_ONE_USAGE_DB /var/lib/izakhono-runtime/app-data/izakhono-one-ai/one-ai.sqlite
put_env "$APP_ENV" IZAKHONO_ONE_FREE_DAILY_REQUESTS 0

GPU_HEALTH="$(curl -fsS http://127.0.0.1:8865/health)"
GPU_WORKERS="$(node -e 'const x=JSON.parse(process.argv[1]);process.stdout.write(String(x.healthyWorkers||0))' "$GPU_HEALTH")"
CHAT_READY=false
if [ "$GPU_WORKERS" -gt 0 ]; then
  if CLIENT_KEY="$CLIENT_KEY" MODEL_ALIAS="$MODEL_ALIAS" node - <<'NODE' >/tmp/izakhono-one-capacity.json 2>/dev/null
const key=process.env.CLIENT_KEY,model=process.env.MODEL_ALIAS;
const r=await fetch("http://127.0.0.1:8850/v1/chat/completions",{
  method:"POST",
  headers:{"content-type":"application/json","authorization":"Bearer "+key},
  body:JSON.stringify({model,messages:[{role:"user",content:"Reply with OK."}],max_tokens:8}),
  signal:AbortSignal.timeout(15000)
});
if(!r.ok) process.exit(2);
console.log(await r.text());
NODE
  then CHAT_READY=true; fi
fi
put_env "$APP_ENV" IZAKHONO_ONE_CHAT_READY "$CHAT_READY"

node - "$REPORT" "$SIGNUP_ENABLED" "$CHAT_READY" "$GPU_WORKERS" "$MODEL_ALIAS" "$GPU_MODEL_ALIAS" "$EMAIL_TRANSPORT" <<'NODE'
const fs=require("fs");
const [path,signup,chatReady,workers,modelAlias,gpuAlias,emailTransport]=process.argv.slice(2);
fs.writeFileSync(path,JSON.stringify({
  schema:"izakhono.one-ai-config/v1",
  account:{public_signup:signup==="true",email_verification:true,recovery:true,email_transport:emailTransport},
  ai:{model_alias:modelAlias,gpu_model_alias:gpuAlias,chat_ready:chatReady==="true",healthy_gpu_workers:Number(workers),gateway:"IZAKHONO_AI_GATEWAY"},
  usage:{consumer_daily_message_cap:null,fair_use:true},
  secrets_exposed:false,
  generated_at:new Date().toISOString()
},null,2)+"\n");
NODE
sudo chown root:izakhono "$REPORT"
sudo chmod 0640 "$REPORT"

unset NOTIFY_KEY GATEWAY_ADMIN CLIENT_KEY ONE_SERVICE_KEY MAIL_KEY SMTP_HOST SMTP_FROM
echo "IZAKHONO ONE configured."
echo "PUBLIC_SIGNUP=$SIGNUP_ENABLED"
echo "EMAIL_TRANSPORT=$EMAIL_TRANSPORT"
echo "CHAT_READY=$CHAT_READY"
echo "HEALTHY_GPU_WORKERS=$GPU_WORKERS"
echo "Receipt: $REPORT"
