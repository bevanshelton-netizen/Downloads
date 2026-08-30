#!/usr/bin/env bash
set -euo pipefail
rm -rf izakhono-cloud-v1.1-hardening
base64 -d izakhono-cloud-v1.1-hardening.tgz.b64 > /tmp/izakhono-cloud-v1.1-hardening.tgz
tar -xzf /tmp/izakhono-cloud-v1.1-hardening.tgz
cd izakhono-cloud-v1.1-hardening
python3 launch-gate.py
printf '\nIZAKHONO CLOUD v1.1 source unpacked and validated.\n'
