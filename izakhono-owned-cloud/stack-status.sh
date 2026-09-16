#!/usr/bin/env bash
set -u

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
  izakhono-ci-worker-node
  izakhono-backup-node
  izakhono-replica-node
  izakhono-edge-node
)

printf "%-28s %-12s\n" "SERVICE" "STATE"
printf "%-28s %-12s\n" "----------------------------" "------------"
for service in "${services[@]}"; do
  if systemctl list-unit-files "${service}.service" >/dev/null 2>&1; then
    state="$(systemctl is-active "$service" 2>/dev/null || true)"
  else
    state="not-installed"
  fi
  printf "%-28s %-12s\n" "$service" "$state"
done

echo
probe() {
  local label="$1"
  local url="$2"
  if curl -fsS --max-time 2 "$url" >/dev/null 2>&1; then
    echo "$label=HEALTHY"
  else
    echo "$label=UNREACHABLE"
  fi
}

probe DATA http://127.0.0.1:8787/health
probe RUNTIME http://127.0.0.1:8790/health
probe OBJECT http://127.0.0.1:8800/health
probe QUEUE http://127.0.0.1:8810/health
probe AUTH http://127.0.0.1:8820/health
probe ANALYTICS http://127.0.0.1:8830/health
probe NOTIFY http://127.0.0.1:8840/health
probe AI_GATEWAY http://127.0.0.1:8850/health
probe CODE http://127.0.0.1:8860/health
probe BACKUP http://127.0.0.1:8870/health
probe CI_WORKER http://127.0.0.1:8880/health
probe REPLICA http://127.0.0.1:8890/health
probe EDGE http://127.0.0.1:8795/health
probe FORTRESS http://127.0.0.1:18109/health
