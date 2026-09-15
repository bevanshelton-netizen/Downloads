#!/usr/bin/env bash
set -euo pipefail
BASE="${IZA_AUTOMATIONS_HOME:-/opt/izakhono-automations}"
DB="${IZA_AUTOMATIONS_DB:-$BASE/data/automations.db}"
OUT="${IZA_AUTOMATIONS_BACKUP_DIR:-$BASE/backups}"
mkdir -p "$OUT"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
python3 - "$DB" "$OUT/automations-$STAMP.db" <<'PY'
import sqlite3,sys
src,dst=sys.argv[1],sys.argv[2]
a=sqlite3.connect(src)
b=sqlite3.connect(dst)
with b: a.backup(b)
a.close(); b.close()
print(dst)
PY
find "$OUT" -type f -name 'automations-*.db' -mtime +30 -delete
