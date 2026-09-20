#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${GOSPEL_SIMULCAST_ENV:-/etc/izakhono/kora-gospel-tv-simulcast.env}"
PID_FILE="${GOSPEL_SIMULCAST_PID:-/run/kora-gospel-tv-simulcast.pid}"
LOG_FILE="${GOSPEL_SIMULCAST_LOG:-/var/log/izakhono/kora-gospel-tv-simulcast.log}"

fail(){ echo "FAIL: $*" >&2; exit 2; }
need(){ command -v "$1" >/dev/null 2>&1 || fail "$1 is required"; }

need ffmpeg
[ -f "$ENV_FILE" ] || fail "Missing $ENV_FILE"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

SOURCE="${GOSPEL_MASTER_INPUT_URL:-}"
[ -n "$SOURCE" ] || fail "GOSPEL_MASTER_INPUT_URL is required"

declare -a outputs=()
for n in 1 2 3 4 5 6 7 8; do
  label_var="GOSPEL_OUTPUT_${n}_LABEL"
  url_var="GOSPEL_OUTPUT_${n}_URL"
  enabled_var="GOSPEL_OUTPUT_${n}_ENABLED"
  label="${!label_var:-}"
  url="${!url_var:-}"
  enabled="${!enabled_var:-0}"
  if [ "$enabled" = "1" ] && [ -n "$url" ]; then
    case "$url" in
      rtmp://*|rtmps://*|srt://*|udp://*) ;;
      *) fail "Output $n ($label) uses an unsupported protocol" ;;
    esac
    outputs+=("[f=flv:onfail=ignore]${url}")
  fi
done

[ "${#outputs[@]}" -gt 0 ] || fail "No enabled simulcast outputs are configured"

mkdir -p "$(dirname "$LOG_FILE")" "$(dirname "$PID_FILE")"
umask 077

TEE="$(IFS='|'; echo "${outputs[*]}")"
MODE="${GOSPEL_TRANSCODE_MODE:-copy}"

case "$MODE" in
  copy)
    codec_args=(-c:v copy -c:a copy)
    ;;
  h264-aac)
    codec_args=(-c:v libx264 -preset veryfast -tune zerolatency -pix_fmt yuv420p -g 50 -c:a aac -b:a 128k -ar 48000)
    ;;
  *)
    fail "GOSPEL_TRANSCODE_MODE must be copy or h264-aac"
    ;;
esac

if [ -f "$PID_FILE" ]; then
  old="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -n "$old" ] && kill -0 "$old" 2>/dev/null; then
    fail "Simulcast is already running as PID $old"
  fi
  rm -f "$PID_FILE"
fi

{
  echo "[$(date -Iseconds)] Starting KORA GOSPEL TV simulcast"
  echo "[$(date -Iseconds)] Master input configured"
  echo "[$(date -Iseconds)] Enabled outputs: ${#outputs[@]}"
  echo "[$(date -Iseconds)] Transcode mode: $MODE"
} >>"$LOG_FILE"

nohup ffmpeg -hide_banner -loglevel warning -re -i "$SOURCE" \
  -map 0:v:0 -map 0:a:0? "${codec_args[@]}" \
  -f tee "$TEE" >>"$LOG_FILE" 2>&1 &

pid=$!
echo "$pid" >"$PID_FILE"
sleep 2
if ! kill -0 "$pid" 2>/dev/null; then
  tail -n 50 "$LOG_FILE" >&2 || true
  fail "Simulcast process exited during startup"
fi

echo "KORA GOSPEL TV SIMULCAST STARTED"
echo "PID=$pid"
echo "OUTPUTS=${#outputs[@]}"
echo "LOG=$LOG_FILE"
