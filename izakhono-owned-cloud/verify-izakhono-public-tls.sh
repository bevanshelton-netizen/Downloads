#!/usr/bin/env bash
set -euo pipefail

HOSTNAME="${IZAKHONO_FLAGSHIP_HOSTNAME:-izakhono.co.za}"
URL="https://$HOSTNAME"

fail(){ echo "TLS_NOT_READY: $*" >&2; exit 2; }
for c in curl openssl node; do command -v "$c" >/dev/null 2>&1 || fail "$c missing"; done

CERT="$(echo | openssl s_client -connect "$HOSTNAME:443" -servername "$HOSTNAME" 2>/dev/null | openssl x509 -noout -subject -issuer -dates -ext subjectAltName 2>/dev/null)" || fail "No trusted certificate could be read for $HOSTNAME."
echo "$CERT" | grep -Eq "DNS:$HOSTNAME([,[:space:]]|$)" || fail "Certificate does not include $HOSTNAME."

curl -fsS --max-time 15 "$URL/health" >/tmp/izakhono-public-health.json || fail "HTTPS health request failed."
node -e 'const x=require("/tmp/izakhono-public-health.json");if(x.ok!==true||x.service!=="IZAKHONO FLAGSHIP")process.exit(2)' || fail "HTTPS endpoint is not the IZAKHONO flagship."

HEADERS="$(mktemp)"
trap 'rm -f "$HEADERS" /tmp/izakhono-public-health.json' EXIT
curl -fsS -D "$HEADERS" --max-time 15 "$URL/" -o /tmp/izakhono-public-home.html || fail "Homepage HTTPS request failed."
grep -q "WE BUILD" /tmp/izakhono-public-home.html || fail "Public homepage is not the current flagship build."

echo "IZAKHONO_PUBLIC_TLS=VERIFIED"
echo "HOSTNAME=$HOSTNAME"
echo "HTTPS=TRUSTED"
echo "CERTIFICATE_HOSTNAME_MATCH=YES"
echo "FLAGSHIP_HEALTH=VERIFIED"
echo "SAFE_TO_SHARE=YES"
