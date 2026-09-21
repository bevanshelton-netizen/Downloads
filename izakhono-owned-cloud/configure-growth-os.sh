#!/usr/bin/env bash
set -euo pipefail

sudo mkdir -p /etc/izakhono/apps

extract_env() {
  local file="$1"
  local key="$2"
  sudo awk -F= -v target="$key" '$1==target {sub(/^[^=]*=/,""); print; exit}' "$file"
}

DATA_KEY="$(extract_env /etc/izakhono/data-node.env IZAKHONO_DATA_KEY)"
OBJECT_KEY="$(extract_env /etc/izakhono/object-node.env IZAKHONO_OBJECT_KEY)"
QUEUE_KEY="$(extract_env /etc/izakhono/queue-node.env IZAKHONO_QUEUE_KEY)"
RUNTIME_KEY="$(extract_env /etc/izakhono/runtime-node.env IZAKHONO_RUNTIME_KEY)"
ANALYTICS_KEY="$(extract_env /etc/izakhono/analytics-node.env IZAKHONO_ANALYTICS_ADMIN_KEY)"
NOTIFY_KEY="$(extract_env /etc/izakhono/notify-node.env IZAKHONO_NOTIFY_KEY)"
MEASUREMENT_KEY="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"

if [ -z "$DATA_KEY" ] || [ -z "$OBJECT_KEY" ] || [ -z "$QUEUE_KEY" ] || [ -z "$RUNTIME_KEY" ] || [ -z "$ANALYTICS_KEY" ] || [ -z "$NOTIFY_KEY" ]; then
  echo "One or more node keys are missing. Install the owned stack first."
  exit 5
fi

TMP="$(mktemp)"
cat >"$TMP" <<EOF
IZAKHONO_DATA_URL=http://127.0.0.1:8787
IZAKHONO_DATA_KEY=$DATA_KEY
IZAKHONO_OBJECT_URL=http://127.0.0.1:8800
IZAKHONO_OBJECT_KEY=$OBJECT_KEY
IZAKHONO_QUEUE_URL=http://127.0.0.1:8810
IZAKHONO_QUEUE_KEY=$QUEUE_KEY
IZAKHONO_RUNTIME_URL=http://127.0.0.1:8790
IZAKHONO_RUNTIME_KEY=$RUNTIME_KEY
IZAKHONO_AUTH_URL=http://127.0.0.1:8820
IZAKHONO_ANALYTICS_URL=http://127.0.0.1:8830
IZAKHONO_ANALYTICS_ADMIN_KEY=$ANALYTICS_KEY
IZAKHONO_NOTIFY_URL=http://127.0.0.1:8840
IZAKHONO_NOTIFY_KEY=$NOTIFY_KEY
IZAKHONO_AI_GATEWAY_URL=http://127.0.0.1:8850
IZAKHONO_CODE_URL=http://127.0.0.1:8860
IZAKHONO_BACKUP_URL=http://127.0.0.1:8870
IZAKHONO_CI_URL=http://127.0.0.1:8880
IZAKHONO_REPLICA_URL=http://127.0.0.1:8890
MEASUREMENT_INGEST_KEY=$MEASUREMENT_KEY
GROWTH_OS_PUBLIC_BASE_URL=${GROWTH_OS_PUBLIC_BASE_URL:-https://growth.domains.izakhonoafrica.co.za}
NEXT_TELEMETRY_DISABLED=1
EOF

sudo install -o root -g izakhono -m 0640 "$TMP" /etc/izakhono/apps/growth-os.env
rm -f "$TMP"

echo "Growth OS owned-infrastructure environment created:"
echo "/etc/izakhono/apps/growth-os.env"
echo "Secrets were not printed."
