#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo -E bash "$0" "$@"
fi

REPO_URL="https://github.com/bevanshelton-netizen/Downloads"
RUNNER_ROOT="/opt/izakhono-actions-runner"
RUNNER_USER="izakhono-runner"
RUNNER_NAME="${IZAKHONO_RUNNER_NAME:-IZAKHONO-NODE01}"
RUNNER_LABELS="${IZAKHONO_RUNNER_LABELS:-izakhono}"
REPORT_DIR="/var/lib/izakhono-deploy"
REPORT="$REPORT_DIR/github-actions-runner.json"
TOKEN="${IZAKHONO_GITHUB_RUNNER_TOKEN:-}"

# Portfolio directive 26 Sep 2026: owner laptop is an administration client only.
# Never expose this laptop as a production execution target.
mkdir -p "$REPORT_DIR"
chmod 0700 "$REPORT_DIR"
if [ -s "$RUNNER_ROOT/.service" ]; then
  LEGACY_SERVICE="$(cat "$RUNNER_ROOT/.service" 2>/dev/null || true)"
  if [ -n "$LEGACY_SERVICE" ]; then
    systemctl stop "$LEGACY_SERVICE" >/dev/null 2>&1 || true
    systemctl disable "$LEGACY_SERVICE" >/dev/null 2>&1 || true
  fi
fi
cat >"$REPORT" <<'JSON'
{
  "schema": "izakhono.github-actions-runner/v1",
  "node": null,
  "runner_name": "IZAKHONO-ADMIN-CLIENT",
  "labels": ["izakhono-admin-client"],
  "repository": "bevanshelton-netizen/Downloads",
  "state": "ADMIN_CLIENT_ONLY",
  "service": null,
  "runner_version": null,
  "token_persisted": false,
  "authority": "ADMIN_CLIENT_ONLY",
  "external_compute_authority": false,
  "platform_execution_allowed": false,
  "production_runner_label": "izakhono-infrastructure",
  "laptop_runtime_dependency": false
}
JSON
chmod 0600 "$REPORT"
echo "IZAKHONO LAPTOP RUNNER: DISABLED FOR PLATFORM EXECUTION"
echo "ROLE=ADMIN_CLIENT_ONLY"
echo "PRODUCTION_RUNNER_LABEL=izakhono-infrastructure"
exit 0

if [ "${1:-}" = "--token-stdin" ]; then
  IFS= read -r TOKEN || true
fi

fail(){ echo "FAIL: $*" >&2; exit 2; }
need(){ command -v "$1" >/dev/null 2>&1 || fail "$1 is required"; }

export DEBIAN_FRONTEND=noninteractive
apt-get update >/dev/null
apt-get install -y ca-certificates curl jq tar gzip >/dev/null
for cmd in curl jq tar systemctl runuser; do need "$cmd"; done

mkdir -p "$REPORT_DIR"
chmod 0700 "$REPORT_DIR"

if ! id "$RUNNER_USER" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "/var/lib/$RUNNER_USER" --shell /bin/bash "$RUNNER_USER"
fi

mkdir -p "$RUNNER_ROOT"
chown -R "$RUNNER_USER:$RUNNER_USER" "$RUNNER_ROOT"

write_report(){
  local state="$1" service="${2:-}" version="${3:-}"
  node - "$REPORT" "$state" "$service" "$version" "$RUNNER_NAME" "$RUNNER_LABELS" <<'NODE'
const fs=require("fs");
const [path,state,service,version,name,labels]=process.argv.slice(2);
fs.writeFileSync(path,JSON.stringify({
  schema:"izakhono.github-actions-runner/v1",
  node:"NODE01",
  runner_name:name,
  labels:["self-hosted","linux","x64",...labels.split(",").map(x=>x.trim()).filter(Boolean)],
  repository:"bevanshelton-netizen/Downloads",
  state,
  service:service||null,
  runner_version:version||null,
  token_persisted:false,
  authority:"NODE01",
  external_compute_authority:false,
  generated_at:new Date().toISOString()
},null,2)+"\n",{mode:0o600});
NODE
  chmod 0600 "$REPORT"
}

cd "$RUNNER_ROOT"

if [ -s .runner ]; then
  SERVICE_NAME="$(cat .service 2>/dev/null || true)"
  if [ -n "$SERVICE_NAME" ]; then
    systemctl enable "$SERVICE_NAME" >/dev/null 2>&1 || true
    systemctl restart "$SERVICE_NAME"
    sleep 2
    systemctl is-active --quiet "$SERVICE_NAME" || fail "Configured runner service did not become active."
    VERSION="$(cat .runner | jq -r '.agentVersion // empty' 2>/dev/null || true)"
    write_report "ACTIVE" "$SERVICE_NAME" "$VERSION"
    echo "IZAKHONO GITHUB RUNNER: ACTIVE"
    echo "RUNNER_NAME=$RUNNER_NAME"
    echo "SERVICE=$SERVICE_NAME"
    echo "TOKEN_PERSISTED=false"
    exit 0
  fi
  fail "Runner is configured but its service registration is missing."
fi

[ -n "$TOKEN" ] || {
  write_report "REGISTRATION_TOKEN_REQUIRED"
  echo "A short-lived GitHub runner registration token is required." >&2
  exit 20
}

RELEASE_JSON="$(curl -fsSL --max-time 20 https://api.github.com/repos/actions/runner/releases/latest)"
TAG="$(jq -r '.tag_name' <<<"$RELEASE_JSON")"
VERSION="${TAG#v}"
[ -n "$VERSION" ] && [ "$VERSION" != "null" ] || fail "Could not resolve the GitHub Actions runner version."

ARCHIVE="actions-runner-linux-x64-$VERSION.tar.gz"
URL="https://github.com/actions/runner/releases/download/$TAG/$ARCHIVE"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"; TOKEN=""; unset IZAKHONO_GITHUB_RUNNER_TOKEN' EXIT

curl -fL --retry 3 --connect-timeout 15 -o "$TMP/$ARCHIVE" "$URL"
tar -tzf "$TMP/$ARCHIVE" >/dev/null
tar -xzf "$TMP/$ARCHIVE" -C "$RUNNER_ROOT"
chown -R "$RUNNER_USER:$RUNNER_USER" "$RUNNER_ROOT"

runuser -u "$RUNNER_USER" -- ./config.sh \
  --url "$REPO_URL" \
  --token "$TOKEN" \
  --name "$RUNNER_NAME" \
  --labels "$RUNNER_LABELS" \
  --work "_work" \
  --unattended \
  --replace

TOKEN=""
unset IZAKHONO_GITHUB_RUNNER_TOKEN

./svc.sh install "$RUNNER_USER"
SERVICE_NAME="$(cat .service 2>/dev/null || true)"
[ -n "$SERVICE_NAME" ] || fail "Runner service name was not created."

systemctl enable "$SERVICE_NAME" >/dev/null
systemctl start "$SERVICE_NAME"
sleep 3
systemctl is-active --quiet "$SERVICE_NAME" || fail "Runner service failed to start."

write_report "ACTIVE" "$SERVICE_NAME" "$VERSION"

echo
echo "IZAKHONO GITHUB RUNNER: ACTIVE"
echo "RUNNER_NAME=$RUNNER_NAME"
echo "LABELS=self-hosted,linux,x64,$RUNNER_LABELS"
echo "SERVICE=$SERVICE_NAME"
echo "TOKEN_PERSISTED=false"
echo "AUTHORITY=NODE01"
echo "RECEIPT=$REPORT"
