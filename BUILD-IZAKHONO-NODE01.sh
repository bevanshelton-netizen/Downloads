#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec sudo -E bash "$ROOT/izakhono-node01/install-linux.sh" "$@"
