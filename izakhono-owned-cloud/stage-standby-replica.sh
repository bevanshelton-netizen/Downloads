#!/usr/bin/env bash
set -euo pipefail

if [ "\${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo bash "$0" "$@"
fi

RECOVERY_KEY_FILE="\${1:-}"
MAX_AGE_MINUTES="\${2:-1440}"

[ -n "$RECOVERY_KEY_FILE" ] || { echo "Usage: sudo bash $0 <offline-recovery-key-file> [max-age-minutes]"; exit 2; }
[ -f "$RECOVERY_KEY_FILE" ] || { echo "Recovery-key file not found."; exit 3; }
[[ "$MAX_AGE_MINUTES" =~ ^[0-9]+$ ]] || { echo "max-age-minutes must be an integer."; exit 4; }

REPLICA_ENV=/etc/izakhono/replica-node.env
[ -f "$REPLICA_ENV" ] || { echo "REPLICA NODE is not installed."; exit 5; }
[ -f /opt/izakhono-backup-node/server.mjs ] || { echo "BACKUP NODE is not installed."; exit 6; }
[ -f /opt/izakhono-backup-node/scripts/restore-external.mjs ] || { echo "External restore utility is not installed."; exit 7; }

ADMIN_KEY="$(awk -F= '$1=="IZAKHONO_REPLICA_ADMIN_KEY"{sub(/^[^=]*=/,"");print;exit}' "$REPLICA_ENV")"
PORT="$(awk -F= '$1=="PORT"{sub(/^[^=]*=/,"");print;exit}' "$REPLICA_ENV")"
HOST="$(awk -F= '$1=="HOST"{sub(/^[^=]*=/,"");print;exit}' "$REPLICA_ENV")"
PORT="\${PORT:-8890}"
HOST="\${HOST:-127.0.0.1}"
[ -n "$ADMIN_KEY" ] || { echo "REPLICA admin key missing."; exit 8; }

OBJECTS="$(curl -fsS --max-time 5 -H "x-izakhono-key: $ADMIN_KEY" "http://$HOST:$PORT/v1/objects")" || {
  echo "Cannot list replicated backup objects."
  exit 9
}

SELECTION="$(OBJECTS="$OBJECTS" MAX_AGE_MINUTES="$MAX_AGE_MINUTES" node - <<'NODE'
const x=JSON.parse(process.env.OBJECTS);
const max=Number(process.env.MAX_AGE_MINUTES)*60*1000;
const rows=(x.objects||[])
  .filter(v=>typeof v.object_key==="string" && typeof v.sha256==="string")
  .sort((a,b)=>new Date(b.received_at)-new Date(a.received_at));
if(!rows.length) process.exit(2);
const r=rows[0];
const age=Date.now()-new Date(r.received_at).getTime();
if(!Number.isFinite(age) || age<0 || age>max) process.exit(3);
process.stdout.write(JSON.stringify({
  id:r.id,
  sourceNode:r.source_node,
  objectKey:r.object_key,
  sha256:r.sha256,
  receivedAt:r.received_at,
  ageMinutes:Math.floor(age/60000)
}));
NODE
)" || {
  code=$?
  if [ "$code" = "3" ]; then echo "Latest replicated backup is older than allowed recovery-point age."; else echo "No usable replicated backup object found."; fi
  exit 10
}

OBJECT_ID="$(SELECTION="$SELECTION" node -e 'const x=JSON.parse(process.env.SELECTION);process.stdout.write(x.id)')"
SOURCE_NODE="$(SELECTION="$SELECTION" node -e 'const x=JSON.parse(process.env.SELECTION);process.stdout.write(x.sourceNode)')"
OBJECT_KEY="$(SELECTION="$SELECTION" node -e 'const x=JSON.parse(process.env.SELECTION);process.stdout.write(x.objectKey)')"
SHA256="$(SELECTION="$SELECTION" node -e 'const x=JSON.parse(process.env.SELECTION);process.stdout.write(x.sha256)')"
AGE_MINUTES="$(SELECTION="$SELECTION" node -e 'const x=JSON.parse(process.env.SELECTION);process.stdout.write(String(x.ageMinutes))')"

VERIFY="$(curl -fsS -X POST -H "x-izakhono-key: $ADMIN_KEY" "http://$HOST:$PORT/v1/objects/$OBJECT_ID/verify")" || {
  echo "Replica SHA-256 verification failed."
  exit 11
}
VERIFY_SHA="$(VERIFY="$VERIFY" node -e 'const x=JSON.parse(process.env.VERIFY);if(x.verified!==true)process.exit(2);process.stdout.write(x.sha256)')" || {
  echo "Replica verification response invalid."
  exit 12
}
[ "$VERIFY_SHA" = "$SHA256" ] || { echo "Replica verification digest mismatch."; exit 13; }

case "$SOURCE_NODE" in *[!A-Za-z0-9._-]*|'') echo "Invalid replica source node."; exit 14;; esac
case "$OBJECT_KEY" in *[!A-Za-z0-9._-]*|'') echo "Invalid replica object key."; exit 15;; esac

ARCHIVE="/srv/izakhono-replica-objects/$SOURCE_NODE/$OBJECT_KEY"
[ -f "$ARCHIVE" ] || { echo "Verified replica archive is missing from local object store."; exit 16; }

DEST="standby-\${OBJECT_ID}"
RESTORE_JSON="$(IZAKHONO_STANDBY_RESTORE_ROOT=/var/lib/izakhono-standby/restores \
  node /opt/izakhono-backup-node/scripts/restore-external.mjs \
    --archive "$ARCHIVE" \
    --expected-sha256 "$SHA256" \
    --recovery-key-file "$RECOVERY_KEY_FILE" \
    --destination-name "$DEST")" || {
  echo "Standby restore staging failed."
  exit 17
}

REPORT_DIR=/var/lib/izakhono-deploy/proofs
mkdir -p "$REPORT_DIR"
chmod 0700 "$REPORT_DIR"
REPORT="$REPORT_DIR/standby-restore-staged.json"

SELECTION="$SELECTION" RESTORE_JSON="$RESTORE_JSON" node - <<'NODE' >"$REPORT"
const selection=JSON.parse(process.env.SELECTION);
const restore=JSON.parse(process.env.RESTORE_JSON);
const report={
  product:"IZAKHONO WARM STANDBY RECOVERY POINT",
  status:"STAGED_AND_VERIFIED",
  replica:{
    object_id:selection.id,
    source_node:selection.sourceNode,
    object_key:selection.objectKey,
    sha256:selection.sha256,
    received_at:selection.receivedAt,
    age_minutes:selection.ageMinutes
  },
  restore,
  live_directories_modified:false,
  promotion_performed:false,
  dns_changed:false,
  public_route_changed:false,
  proved_at:new Date().toISOString()
};
process.stdout.write(JSON.stringify(report,null,2));
NODE
chmod 0600 "$REPORT"

unset ADMIN_KEY
echo "IZAKHONO WARM STANDBY RECOVERY POINT: STAGED"
echo "Replica age: $AGE_MINUTES minute(s)"
echo "Live directories modified: NO"
echo "Promotion performed: NO"
echo "Report: $REPORT"
