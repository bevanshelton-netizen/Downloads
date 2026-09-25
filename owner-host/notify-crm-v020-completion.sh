#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo -E bash "$0" "$@"
fi

RECEIPT="${IZAKHONO_CRM_RECEIPT:-/var/lib/izakhono-deploy/crm-v020.json}"
MARKER="${IZAKHONO_CRM_NOTIFY_MARKER:-/var/lib/izakhono-deploy/crm-v020-notified.json}"
NOTIFY_ENV="${IZAKHONO_NOTIFY_ENV:-/etc/izakhono/notify-node.env}"
NOTIFY_URL="${IZAKHONO_NOTIFY_URL:-http://127.0.0.1:8840}"
RECIPIENT_REF="${IZAKHONO_CRM_NOTIFY_RECIPIENT:-owner-bevan}"
TEMPLATE_NAME="crm-node01-deployment-complete"

[ -s "$RECEIPT" ] || { echo "CRM_NOTIFY=WAITING_RECEIPT"; exit 0; }

readarray -t META < <(node - "$RECEIPT" <<'NODE'
const fs=require('fs');
const x=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
console.log(String(x.status||''));
console.log(String(x.request_id||''));
console.log(String(x.crm_version||''));
console.log(String(x.source_commit||''));
console.log(String(x.authority||''));
console.log(String(x.evidence_path||''));
NODE
)
STATUS="${META[0]:-}"
REQUEST_ID="${META[1]:-}"
CRM_VERSION="${META[2]:-}"
SOURCE_COMMIT="${META[3]:-}"
AUTHORITY="${META[4]:-}"
EVIDENCE_PATH="${META[5]:-}"

[ "$STATUS" = "success" ] || { echo "CRM_NOTIFY=WAITING_SUCCESS status=$STATUS"; exit 0; }
[ -n "$REQUEST_ID" ] || { echo "CRM_NOTIFY=INVALID_RECEIPT"; exit 2; }

if [ -s "$MARKER" ]; then
  if node - "$MARKER" "$REQUEST_ID" <<'NODE'
const fs=require('fs');
const [path,id]=process.argv.slice(2);
const x=JSON.parse(fs.readFileSync(path,'utf8'));
process.exit(x.request_id===id && x.notified===true ? 0 : 1);
NODE
  then
    echo "CRM_NOTIFY=ALREADY_SENT request=$REQUEST_ID"
    exit 0
  fi
fi

[ -s "$NOTIFY_ENV" ] || { echo "CRM_NOTIFY=WAITING_NOTIFY_NODE_CONFIG"; exit 0; }
NOTIFY_KEY="$(awk -F= '$1=="IZAKHONO_NOTIFY_KEY"{sub(/^[^=]*=/,"");print;exit}' "$NOTIFY_ENV")"
[ -n "$NOTIFY_KEY" ] || { echo "CRM_NOTIFY=WAITING_NOTIFY_KEY"; exit 0; }

if ! curl -fsS --max-time 3 "$NOTIFY_URL/health" >/tmp/izakhono-notify-health.json 2>/dev/null; then
  echo "CRM_NOTIFY=WAITING_NOTIFY_NODE"
  exit 0
fi

HEADERS=(-H "x-izakhono-key: $NOTIFY_KEY" -H "content-type: application/json")

TEMPLATE_PAYLOAD="$(node - <<'NODE'
console.log(JSON.stringify({
  channel:'in_app',
  subject:'NODE01 CRM deployment complete',
  body:'IZAKHONO CRM {{version}} completed on {{authority}}. Request: {{request}}. Source: {{source}}. Evidence: {{evidence}}.'
}));
NODE
)"

TEMPLATE_RESPONSE="$(curl -fsS --max-time 5 -X PUT "${HEADERS[@]}" --data "$TEMPLATE_PAYLOAD" "$NOTIFY_URL/v1/templates/$TEMPLATE_NAME")"
TEMPLATE_ID="$(node -e 'const x=JSON.parse(process.argv[1]);process.stdout.write(String(x.template?.id||""))' "$TEMPLATE_RESPONSE")"
[ -n "$TEMPLATE_ID" ] || { echo "CRM_NOTIFY=TEMPLATE_FAILED"; exit 3; }

SEND_PAYLOAD="$(node - "$RECIPIENT_REF" "$TEMPLATE_ID" "$REQUEST_ID" "$CRM_VERSION" "$SOURCE_COMMIT" "$AUTHORITY" "$EVIDENCE_PATH" <<'NODE'
const [recipientRef,templateId,request,version,source,authority,evidence]=process.argv.slice(2);
console.log(JSON.stringify({
  recipientRef,
  channel:'in_app',
  templateId,
  variables:{request,version,source,authority,evidence},
  idempotencyKey:'crm-node01-complete:'+request,
  maxAttempts:3
}));
NODE
)"

SEND_RESPONSE="$(curl -fsS --max-time 5 -X POST "${HEADERS[@]}" --data "$SEND_PAYLOAD" "$NOTIFY_URL/v1/send")"
MESSAGE_ID="$(node -e 'const x=JSON.parse(process.argv[1]);process.stdout.write(String(x.message?.id||""))' "$SEND_RESPONSE")"
[ -n "$MESSAGE_ID" ] || { echo "CRM_NOTIFY=SEND_FAILED"; exit 4; }

mkdir -p "$(dirname "$MARKER")"
node - "$MARKER" "$REQUEST_ID" "$MESSAGE_ID" "$CRM_VERSION" "$SOURCE_COMMIT" "$AUTHORITY" <<'NODE'
const fs=require('fs');
const [path,requestId,messageId,version,source,authority]=process.argv.slice(2);
fs.writeFileSync(path,JSON.stringify({
  schema:'izakhono.crm-v020.notification/v1',
  request_id:requestId,
  message_id:messageId,
  notified:true,
  channel:'in_app',
  recipient_ref:'owner-bevan',
  crm_version:version,
  source_commit:source,
  authority,
  third_party_notification_control_required:false,
  notified_at:new Date().toISOString()
},null,2)+'\n',{mode:0o600});
NODE
chmod 0600 "$MARKER"

echo "CRM_NOTIFY=SENT message=$MESSAGE_ID request=$REQUEST_ID"
