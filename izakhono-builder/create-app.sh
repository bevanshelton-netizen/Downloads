#!/usr/bin/env bash
set -euo pipefail

SLUG="${1:-}"
NAME="${2:-}"
DEST="${3:-../${SLUG}}"

if [ -z "$SLUG" ] || [ -z "$NAME" ]; then
  echo 'Usage: ./create-app.sh <slug> "App Name" [destination]' >&2
  exit 1
fi
if ! [[ "$SLUG" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
  echo 'Slug must contain lowercase letters, numbers and hyphens only.' >&2
  exit 1
fi
if [ -e "$DEST" ]; then
  echo "Destination already exists: $DEST" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")" && pwd)"
cp -R "$ROOT/template" "$DEST"

python3 - "$DEST" "$SLUG" "$NAME" <<'PY'
from pathlib import Path
import sys
root=Path(sys.argv[1]); slug=sys.argv[2]; name=sys.argv[3]
for p in root.rglob('*'):
    if not p.is_file():
        continue
    try:
        text=p.read_text()
    except UnicodeDecodeError:
        continue
    text=text.replace('__APP_SLUG__',slug).replace('__APP_NAME__',name)
    p.write_text(text)
PY

chmod +x "$DEST/scripts/bootstrap.sh"
echo "Created $NAME at $DEST"
echo "Next: cd $DEST && ./scripts/bootstrap.sh"
