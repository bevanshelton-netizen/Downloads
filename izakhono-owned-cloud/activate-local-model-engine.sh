#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo -E bash "$0" "$@"
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODEL="${1:-${IZAKHONO_LOCAL_MODEL:-qwen2.5:3b}}"
HOSTNAME="${IZAKHONO_ONE_AI_HOSTNAME:-one.domains.izakhonoafrica.co.za}"
IMAGE="${IZAKHONO_OLLAMA_IMAGE:-ollama/ollama:latest}"
CONTAINER="${IZAKHONO_OLLAMA_CONTAINER:-izakhono-ollama}"
ENGINE_PORT="${IZAKHONO_OLLAMA_PORT:-11434}"
ENGINE_DATA="/var/lib/izakhono-model-engine/ollama"
MODEL_ENV="/etc/izakhono/model-worker.env"
REPORT_DIR="/var/lib/izakhono-deploy"
REPORT="$REPORT_DIR/izakhono-one-local-model.json"

fail(){ echo "FAIL: $*" >&2; exit 2; }
need(){ command -v "$1" >/dev/null 2>&1 || fail "$1 is required"; }

for c in docker curl node systemctl git; do need "$c"; done
[ -f "$MODEL_ENV" ] || fail "IZAKHONO MODEL WORKER is not installed. Run owner-host bootstrap first."
[ -f /etc/izakhono/gpu-compute-node.env ] || fail "IZAKHONO GPU COMPUTE NODE is not installed."
[ -f /etc/izakhono/ai-gateway-node.env ] || fail "IZAKHONO AI GATEWAY NODE is not installed."

mkdir -p "$ENGINE_DATA" "$REPORT_DIR"
chmod 0700 "$REPORT_DIR"

put_env(){
  local file="$1" key="$2" val="$3"
  local tmp clean
  tmp="$(mktemp)"; clean="$(mktemp)"
  cat "$file" >"$tmp" 2>/dev/null || true
  grep -v "^$key=" "$tmp" >"$clean" || true
  printf '%s=%s\n' "$key" "$val" >>"$clean"
  install -o root -g izakhono -m 0640 "$clean" "$file"
  rm -f "$tmp" "$clean"
}

echo
echo "IZAKHONO ONE — LOCAL MODEL ACTIVATION"
echo "Model: $MODEL"
echo "Engine image: $IMAGE"
echo "Public target: $HOSTNAME"
echo

docker pull "$IMAGE"

docker rm -f "$CONTAINER" >/dev/null 2>&1 || true

GPU_MODE="cpu"
RUN_ARGS=(
  run -d
  --name "$CONTAINER"
  --restart unless-stopped
  -p "127.0.0.1:$ENGINE_PORT:11434"
  -v "$ENGINE_DATA:/root/.ollama"
)

if command -v nvidia-smi >/dev/null 2>&1; then
  if docker info --format '{{json .Runtimes}}' 2>/dev/null | grep -qi 'nvidia'; then
    RUN_ARGS+=(--gpus all)
    GPU_MODE="nvidia-gpu"
  fi
fi

docker "${RUN_ARGS[@]}" "$IMAGE" >/dev/null

ENGINE_READY=false
for _ in $(seq 1 80); do
  if curl -fsS --max-time 2 "http://127.0.0.1:$ENGINE_PORT/api/tags" >/tmp/izakhono-ollama-tags.json 2>/dev/null; then
    ENGINE_READY=true
    break
  fi
  sleep 1
done
[ "$ENGINE_READY" = true ] || fail "Local model engine did not become healthy."

echo "Pulling bootstrap model. This can take time depending on model size and connection..."
docker exec "$CONTAINER" ollama pull "$MODEL"

curl -fsS --max-time 8 "http://127.0.0.1:$ENGINE_PORT/v1/models" >/tmp/izakhono-local-models.json ||   fail "Local model engine does not expose the required OpenAI-compatible /v1/models endpoint."

node - "$MODEL" /tmp/izakhono-local-models.json <<'NODE'
const fs=require("fs");
const [model,path]=process.argv.slice(2);
const x=JSON.parse(fs.readFileSync(path,"utf8"));
const ids=(x.data||[]).map(v=>String(v.id||""));
if(!ids.includes(model)){
  console.error("Requested model not visible through OpenAI-compatible endpoint:",model);
  process.exit(2);
}
NODE

MODEL_JSON="$(node -e 'process.stdout.write(JSON.stringify([{alias:"izakhono-small",upstreamModel:process.argv[1]}]))' "$MODEL")"
put_env "$MODEL_ENV" IZAKHONO_MODEL_ENGINE_URL "http://127.0.0.1:$ENGINE_PORT"
put_env "$MODEL_ENV" IZAKHONO_MODEL_ENGINE_CHAT_PATH "/v1/chat/completions"
put_env "$MODEL_ENV" IZAKHONO_MODEL_ENGINE_KEY ""
put_env "$MODEL_ENV" IZAKHONO_MODEL_ENGINE_ALLOWLIST "127.0.0.1,localhost,::1"
put_env "$MODEL_ENV" IZAKHONO_MODEL_WORKER_MODELS "'$MODEL_JSON'"
put_env "$MODEL_ENV" IZAKHONO_MODEL_WORKER_ALLOW_CPU "true"

systemctl restart izakhono-model-worker-node

WORKER_READY=false
for _ in $(seq 1 50); do
  if curl -fsS --max-time 2 http://127.0.0.1:8866/health >/tmp/izakhono-model-worker-health.json 2>/dev/null; then
    if node -e 'const x=require("/tmp/izakhono-model-worker-health.json");process.exit(x.ready===true&&x.registered===true?0:1)' 2>/dev/null; then
      WORKER_READY=true
      break
    fi
  fi
  sleep 1
done
[ "$WORKER_READY" = true ] || fail "Model Worker did not become ready and registered."

COMPUTE_READY=false
for _ in $(seq 1 30); do
  if curl -fsS --max-time 2 http://127.0.0.1:8865/health >/tmp/izakhono-gpu-compute-health.json 2>/dev/null; then
    if node -e 'const x=require("/tmp/izakhono-gpu-compute-health.json");process.exit(Number(x.healthyWorkers||0)>0?0:1)' 2>/dev/null; then
      COMPUTE_READY=true
      break
    fi
  fi
  sleep 1
done
[ "$COMPUTE_READY" = true ] || fail "GPU/CPU compute pool did not register a healthy model worker."

cd "$ROOT"

if [ -f izakhono-owned-cloud/migrate-source-to-code.sh ]; then
  bash izakhono-owned-cloud/migrate-source-to-code.sh
fi

export IZAKHONO_ONE_AI_HOSTNAME="$HOSTNAME"
export IZAKHONO_GPU_DEFAULT_MODEL_ALIAS=izakhono-small
bash izakhono-owned-cloud/configure-izakhono-one-ai.sh

CONFIG_REPORT="$REPORT_DIR/izakhono-one-ai-config.json"
[ -f "$CONFIG_REPORT" ] || fail "ONE AI configuration receipt missing."
CHAT_READY="$(node -e 'const x=require(process.argv[1]);process.stdout.write(String(x.ai?.chat_ready===true))' "$CONFIG_REPORT")"
[ "$CHAT_READY" = true ] || fail "Inference proof failed. ONE AI remains fail-closed."

bash izakhono-owned-cloud/deploy-izakhono-one-ai.sh main

DEPLOY_REPORT="$REPORT_DIR/izakhono-one-ai.json"
[ -f "$DEPLOY_REPORT" ] || fail "ONE AI deployment receipt missing."

PROXY_HEALTH="$(curl -fsS -H "Host: $HOSTNAME" http://127.0.0.1:8080/health)"
node -e 'const x=JSON.parse(process.argv[1]);if(x.product!=="IZAKHONO ONE AI"||x.chatReady!==true||x.accountReachable!==true)process.exit(2)' "$PROXY_HEALTH"

PUBLIC_HTTPS="$(node -e 'const x=require(process.argv[1]);process.stdout.write(String(x.public_https||"NOT_VERIFIED"))' "$DEPLOY_REPORT")"
PUBLIC_SIGNUP="$(node -e 'const x=require(process.argv[1]);process.stdout.write(String(x.public_signup===true))' "$DEPLOY_REPORT")"

TMP="$(mktemp)"
node - "$TMP" "$MODEL" "$IMAGE" "$GPU_MODE" "$HOSTNAME" "$CHAT_READY" "$PUBLIC_SIGNUP" "$PUBLIC_HTTPS" <<'NODE'
const fs=require("fs");
const [path,model,image,mode,hostname,chatReady,publicSignup,publicHttps]=process.argv.slice(2);
const body={
  schema:"izakhono.one-local-model/v1",
  product:"IZAKHONO ONE AI",
  hostname,
  model,
  engine:"ollama-openai-compatible",
  engine_image:image,
  engine_bind:"127.0.0.1:11434",
  compute_mode:mode,
  route:[
    "IZAKHONO ONE",
    "IZAKHONO AI GATEWAY",
    "IZAKHONO GPU COMPUTE",
    "IZAKHONO MODEL WORKER",
    "LOCAL MODEL ENGINE"
  ],
  chat_ready:chatReady==="true",
  public_signup:publicSignup==="true",
  public_https:publicHttps,
  per_request_external_ai_required:false,
  model_download_external_source_required:true,
  generated_at:new Date().toISOString()
};
fs.writeFileSync(path,JSON.stringify(body,null,2)+"\n");
console.log(JSON.stringify(body,null,2));
NODE
install -o root -g izakhono -m 0640 "$TMP" "$REPORT"
rm -f "$TMP"

echo
echo "IZAKHONO ONE LOCAL MODEL: ACTIVATED"
echo "MODEL=$MODEL"
echo "COMPUTE_MODE=$GPU_MODE"
echo "CHAT_READY=$CHAT_READY"
echo "PUBLIC_SIGNUP=$PUBLIC_SIGNUP"
echo "PUBLIC_HTTPS=$PUBLIC_HTTPS"
echo "RECEIPT=$REPORT"
echo
if [ "$PUBLIC_SIGNUP" != true ]; then
  echo "Account signup remains disabled until a verified SMTP transport is connected."
fi
if [ "$PUBLIC_HTTPS" != VERIFIED ]; then
  echo "The owned runtime is ready; public hostname still requires verified HTTPS cutover."
fi
