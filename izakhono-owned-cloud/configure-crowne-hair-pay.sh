#!/usr/bin/env bash
set -euo pipefail
if [ "${EUID:-$(id -u)}" -ne 0 ]; then exec sudo -E bash "$0" "$@"; fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PAY_ENV="${IZAKHONO_PAY_ENV_FILE:-/etc/izakhono/apps/izakhono-pay.env}"
HAIR_ENV="/etc/izakhono/crowne-hair.env"
PAY_HOST="pay.izakhonoafrica.co.za"

[ -f "$PAY_ENV" ] || { echo "FAIL: protected IZAKHONO PAY environment missing at $PAY_ENV" >&2; exit 2; }
mkdir -p /etc/izakhono
cp -a "$PAY_ENV" "$PAY_ENV.bak-crowne-$(date +%Y%m%d%H%M%S)"

python3 - "$PAY_ENV" "$HAIR_ENV" <<'PY'
import json,secrets,sys,tempfile,os
pay_env,hair_env=sys.argv[1:3]
lines=open(pay_env,encoding="utf-8").read().splitlines()
prefix="IZAKHONO_PAY_APPS_JSON="
idx=None; apps={}
for i,line in enumerate(lines):
    if line.startswith(prefix):
        idx=i
        raw=line[len(prefix):].strip()
        apps=json.loads(raw) if raw else {}
        break
if idx is None:
    raise SystemExit("IZAKHONO_PAY_APPS_JSON is missing from protected payment environment")
key=apps.get("crowne-hair") or secrets.token_urlsafe(36)
apps["crowne-hair"]=key
lines[idx]=prefix+json.dumps(apps,separators=(",",":"))
tmp=pay_env+".tmp"
open(tmp,"w",encoding="utf-8").write("\n".join(lines)+"\n")
os.replace(tmp,pay_env)
open(hair_env,"w",encoding="utf-8").write(
    "IZAKHONO_PAY_ORIGIN=http://127.0.0.1:8080\n"
    "IZAKHONO_PAY_HOST=pay.izakhonoafrica.co.za\n"
    "IZAKHONO_PAY_APP_KEY="+key+"\n"\n    "CROWNE_HAIR_DIRECT_CHECKOUT=false\n"
)
print("CROWNÉ Hair payment identity configured locally; secret not printed.")
PY

chown root:izakhono "$PAY_ENV" "$HAIR_ENV"
chmod 0640 "$PAY_ENV" "$HAIR_ENV"

set +e
bash "$ROOT/izakhono-owned-cloud/go-live-izakhono-pay.sh"
PAY_RC=$?
set -e
if [ "$PAY_RC" -ne 0 ]; then
  echo "IZAKHONO PAY full public verification did not complete; checking protected local runtime..." >&2
  HEALTH="$(curl -fsS --max-time 8 -H "Host: $PAY_HOST" http://127.0.0.1:8080/health)" || exit "$PAY_RC"
  node -e 'const x=JSON.parse(process.argv[1]);if(x.ok!==true||x.service!=="izakhono-pay"||x.primary_provider!=="ikhokha")process.exit(2)' "$HEALTH"
  echo "IZAKHONO PAY local runtime reloaded and healthy; public hostname cutover remains separate."
fi

echo "CROWNÉ Hair -> IZAKHONO PAY: CONFIGURED"
