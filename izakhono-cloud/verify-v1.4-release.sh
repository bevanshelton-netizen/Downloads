#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
RELEASE_DIR="$ROOT/release/v1.4"
EXPECTED_RELEASE_SHA="3df20c679d0ce8956ccfba7f4deb7528e221b9f112a2ceb238a22b045e9d939f"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

for tool in base64 sha256sum unzip python3; do
  command -v "$tool" >/dev/null 2>&1 || { echo "missing required verification tool: $tool" >&2; exit 1; }
done

: > "$TMP/release.b64"
for part in 00 01 02 03 04 05 06 07; do
  file="$RELEASE_DIR/part${part}.b64"
  [ -s "$file" ] || { echo "missing release part: $file" >&2; exit 1; }
  cat "$file" >> "$TMP/release.b64"
done

base64 -d "$TMP/release.b64" > "$TMP/release.zip"
ACTUAL_SHA=$(sha256sum "$TMP/release.zip" | awk '{print $1}')
FILE_SHA=$(awk 'NR==1 {print $1}' "$RELEASE_DIR/izakhono-cloud-v1.4-zero-touch.zip.sha256")

[ "$ACTUAL_SHA" = "$EXPECTED_RELEASE_SHA" ] || { echo "release payload SHA mismatch: $ACTUAL_SHA" >&2; exit 1; }
[ "$FILE_SHA" = "$EXPECTED_RELEASE_SHA" ] || { echo "checksum file mismatch: $FILE_SHA" >&2; exit 1; }

bash -n "$ROOT/install-first-server.sh"
bash -n "$ROOT/check-first-server.sh"
grep -Eq 'RELEASE_REF=\$\{IZAKHONO_RELEASE_REF:-[0-9a-f]{40}\}' "$ROOT/install-first-server.sh" || { echo "installer release ref is not immutable" >&2; exit 1; }
grep -Eq 'INSTALLER_REF=[0-9a-f]{40}' "$ROOT/cloud-init.yaml" || { echo "cloud-init installer ref is not immutable" >&2; exit 1; }

unzip -q "$TMP/release.zip" -d "$TMP/unpacked"
PKG="$TMP/unpacked/izakhono-cloud-v1.4-zero-touch"
[ -d "$PKG" ] || { echo "release root missing" >&2; exit 1; }

for script in bootstrap-ubuntu.sh production-proof.sh owner-install.sh server-readiness.sh install-first-server.sh check-first-server.sh; do
  [ -f "$PKG/$script" ] || { echo "packaged script missing: $script" >&2; exit 1; }
  bash -n "$PKG/$script"
done

python3 -m py_compile \
  "$PKG/control/app/main.py" \
  "$PKG/identity/app/main.py" \
  "$PKG/ops-agent/app/main.py" \
  "$PKG/runner/runner.py"

(
  cd "$PKG"
  python3 launch-gate.py
)

echo "IZAKHONO CLOUD v1.4 release verification: PASS"
echo "release_sha256=$ACTUAL_SHA"
