#!/usr/bin/env bash
set -euo pipefail

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3.11+ is required."
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
sudo useradd --system --home /nonexistent --shell /usr/sbin/nologin izakhono-watch 2>/dev/null || true
sudo mkdir -p /opt/izakhono-portfolio-watch /var/lib/izakhono-portfolio-watch /etc/izakhono

sudo cp "$SCRIPT_DIR/app.py" /opt/izakhono-portfolio-watch/app.py
sudo cp "$SCRIPT_DIR/portfolio.json" /opt/izakhono-portfolio-watch/portfolio.json
sudo chown -R root:root /opt/izakhono-portfolio-watch
sudo chown -R izakhono-watch:izakhono-watch /var/lib/izakhono-portfolio-watch

if [ ! -f /etc/izakhono/portfolio-watch.env ]; then
  TOKEN="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"
  sudo tee /etc/izakhono/portfolio-watch.env >/dev/null <<EOF
IZA_WATCH_HOST=127.0.0.1
IZA_WATCH_PORT=8860
IZA_WATCH_ADMIN_TOKEN=$TOKEN
IZA_WATCH_INTERVAL_MINUTES=360
IZA_WATCH_DB=/var/lib/izakhono-portfolio-watch/portfolio-watch.db
IZA_WATCH_REGISTRY=/opt/izakhono-portfolio-watch/portfolio.json
IZA_WATCH_NOTIFY_URL=
IZA_WATCH_NOTIFY_KEY=
EOF
  sudo chmod 600 /etc/izakhono/portfolio-watch.env
fi

sudo cp "$SCRIPT_DIR/systemd/izakhono-portfolio-watch.service" /etc/systemd/system/izakhono-portfolio-watch.service
sudo systemctl daemon-reload
sudo systemctl enable --now izakhono-portfolio-watch

echo
echo "IZAKHONO Portfolio Watch installed."
sudo systemctl --no-pager --full status izakhono-portfolio-watch
echo
echo "Health:"
curl -fsS http://127.0.0.1:8860/health
echo
