#!/usr/bin/env python3
import hashlib
import hmac
import json
import os
import re
import sqlite3
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

PORT = int(os.environ.get("ANALYTICS_PORT", "8080"))
DB_PATH = os.environ.get("ANALYTICS_DB_PATH", "/data/analytics.db")
HASH_SECRET = os.environ.get("ANALYTICS_HASH_SECRET", "")
RETENTION_DAYS = max(7, int(os.environ.get("ANALYTICS_RETENTION_DAYS", "180")))
PLATFORMS = {
    p.strip() for p in os.environ.get(
        "ANALYTICS_PLATFORMS",
        "ecd360,allegro-vibez,the-chancellor,shelton-fortress,legacymart,faisready,kora-network"
    ).split(",") if p.strip()
}

if len(HASH_SECRET) < 32:
    raise SystemExit("ANALYTICS_HASH_SECRET must be at least 32 characters")

os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
conn = sqlite3.connect(DB_PATH, check_same_thread=False)
conn.execute("PRAGMA journal_mode=WAL")
conn.execute("PRAGMA synchronous=NORMAL")
conn.executescript("""
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts_utc INTEGER NOT NULL,
  platform TEXT NOT NULL,
  event TEXT NOT NULL,
  path TEXT NOT NULL,
  referrer_host TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  session_hash TEXT NOT NULL,
  device TEXT NOT NULL,
  is_bot INTEGER NOT NULL DEFAULT 0,
  value_minor INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_events_time ON events(ts_utc);
CREATE INDEX IF NOT EXISTS idx_events_platform_time ON events(platform, ts_utc);
CREATE INDEX IF NOT EXISTS idx_events_event_time ON events(event, ts_utc);
""")
conn.commit()

BOT_RE = re.compile(r"(bot|crawler|spider|slurp|headless|preview|facebookexternalhit|bingpreview|uptime|monitor)", re.I)
MOBILE_RE = re.compile(r"(android|iphone|ipad|mobile)", re.I)

def utc_now():
    return int(time.time())

def sha_token(value):
    if not value:
        return ""
    return hmac.new(HASH_SECRET.encode(), value.encode(), hashlib.sha256).hexdigest()

def safe_text(value, max_len):
    return str(value or "").replace("\x00", "").strip()[:max_len]

def safe_path(value):
    value = safe_text(value, 500)
    return value if value.startswith("/") else "/" + value

def referrer_host(value):
    try:
        return safe_text(urlparse(str(value or "")).hostname or "", 200)
    except Exception:
        return ""

def classify_device(ua):
    ua = str(ua or "")
    if BOT_RE.search(ua):
        return "bot", 1
    if MOBILE_RE.search(ua):
        return "mobile", 0
    return "desktop", 0

def cleanup():
    cutoff = utc_now() - RETENTION_DAYS * 86400
    conn.execute("DELETE FROM events WHERE ts_utc < ?", (cutoff,))
    conn.commit()

cleanup()

BEACON_JS = r"""
(() => {
  const current = document.currentScript;
  const u = new URL(current.src);
  const platform = u.searchParams.get('platform') || '';
  if (!platform) return;
  const endpoint = u.origin + '/v1/hit';
  const key = 'izakhono.analytics.visitor.' + platform;
  const sessionKey = 'izakhono.analytics.session.' + platform;
  const randomId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random());
  let visitor = localStorage.getItem(key);
  if (!visitor) { visitor = randomId(); localStorage.setItem(key, visitor); }
  let session = sessionStorage.getItem(sessionKey);
  if (!session) { session = randomId(); sessionStorage.setItem(sessionKey, session); }

  function send(event = 'pageview', extra = {}) {
    const payload = {
      platform,
      event,
      path: location.pathname + location.search,
      referrer: document.referrer || '',
      visitor_id: visitor,
      session_id: session,
      value_minor: Number.isFinite(Number(extra.value_minor)) ? Number(extra.value_minor) : 0
    };
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([body], {type:'application/json'}));
    } else {
      fetch(endpoint, {method:'POST', headers:{'content-type':'application/json'}, body, keepalive:true}).catch(()=>{});
    }
  }

  window.izakhonoTrack = (event, data={}) => send(event, data);
  send('pageview');

  let last = location.href;
  const routeCheck = () => {
    if (location.href !== last) {
      last = location.href;
      setTimeout(() => send('pageview'), 0);
    }
  };
  const push = history.pushState.bind(history);
  history.pushState = (...args) => { push(...args); routeCheck(); };
  const replace = history.replaceState.bind(history);
  history.replaceState = (...args) => { replace(...args); routeCheck(); };
  addEventListener('popstate', routeCheck);
})();
"""

def summary(days=1):
    days = min(365, max(1, int(days)))
    since = utc_now() - days * 86400
    totals = conn.execute("""
      SELECT
        SUM(CASE WHEN event='pageview' AND is_bot=0 THEN 1 ELSE 0 END),
        COUNT(DISTINCT CASE WHEN event='pageview' AND is_bot=0 AND visitor_hash<>'' THEN visitor_hash END),
        COUNT(DISTINCT CASE WHEN event='pageview' AND is_bot=0 AND session_hash<>'' THEN session_hash END),
        SUM(CASE WHEN event='signup' AND is_bot=0 THEN 1 ELSE 0 END),
        SUM(CASE WHEN event='checkout_start' AND is_bot=0 THEN 1 ELSE 0 END),
        SUM(CASE WHEN event='purchase' AND is_bot=0 THEN 1 ELSE 0 END),
        SUM(CASE WHEN event='purchase' AND is_bot=0 THEN value_minor ELSE 0 END),
        SUM(CASE WHEN is_bot=1 THEN 1 ELSE 0 END)
      FROM events WHERE ts_utc >= ?
    """, (since,)).fetchone()

    platforms = conn.execute("""
      SELECT platform,
        SUM(CASE WHEN event='pageview' AND is_bot=0 THEN 1 ELSE 0 END) views,
        COUNT(DISTINCT CASE WHEN event='pageview' AND is_bot=0 AND visitor_hash<>'' THEN visitor_hash END) visitors,
        COUNT(DISTINCT CASE WHEN event='pageview' AND is_bot=0 AND session_hash<>'' THEN session_hash END) sessions,
        SUM(CASE WHEN event='signup' AND is_bot=0 THEN 1 ELSE 0 END) signups,
        SUM(CASE WHEN event='checkout_start' AND is_bot=0 THEN 1 ELSE 0 END) checkouts,
        SUM(CASE WHEN event='purchase' AND is_bot=0 THEN 1 ELSE 0 END) purchases,
        SUM(CASE WHEN event='purchase' AND is_bot=0 THEN value_minor ELSE 0 END) revenue_minor
      FROM events WHERE ts_utc >= ?
      GROUP BY platform ORDER BY views DESC
    """, (since,)).fetchall()

    top_pages = conn.execute("""
      SELECT platform, path, COUNT(*) views
      FROM events
      WHERE ts_utc >= ? AND event='pageview' AND is_bot=0
      GROUP BY platform, path
      ORDER BY views DESC LIMIT 20
    """, (since,)).fetchall()

    return {
        "ok": True,
        "days": days,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "totals": {
            "pageviews": totals[0] or 0,
            "unique_visitors": totals[1] or 0,
            "sessions": totals[2] or 0,
            "signups": totals[3] or 0,
            "checkout_starts": totals[4] or 0,
            "purchases": totals[5] or 0,
            "revenue_minor": totals[6] or 0,
            "bot_events": totals[7] or 0
        },
        "platforms": [
            {
                "platform": r[0], "pageviews": r[1] or 0, "unique_visitors": r[2] or 0,
                "sessions": r[3] or 0, "signups": r[4] or 0, "checkout_starts": r[5] or 0,
                "purchases": r[6] or 0, "revenue_minor": r[7] or 0
            } for r in platforms
        ],
        "top_pages": [{"platform": r[0], "path": r[1], "pageviews": r[2]} for r in top_pages]
    }

def dashboard_html():
    return """<!doctype html>
<html>
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>IZAKHONO Analytics Command Centre</title>
<style>
body{font-family:Inter,Arial,sans-serif;background:#080b10;color:#f5f7fb;margin:0}
header{padding:24px 28px;border-bottom:1px solid #202735;background:#0d121a}
h1{margin:0;font-size:28px}.sub{color:#9ca8ba;margin-top:7px}
main{padding:24px;max-width:1400px;margin:auto}
.toolbar{display:flex;gap:8px;align-items:center;margin-bottom:18px}
button{background:#141d29;color:#fff;border:1px solid #2c394d;border-radius:9px;padding:9px 14px;cursor:pointer}
button.active{background:#fff;color:#000}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:24px}
.card{background:#101722;border:1px solid #202c3d;border-radius:14px;padding:18px}
.value{font-size:30px;font-weight:800}.label{color:#9aa6b8;font-size:13px;margin-top:6px}
section{background:#101722;border:1px solid #202c3d;border-radius:14px;padding:18px;margin-top:16px;overflow:auto}
table{width:100%;border-collapse:collapse;min-width:760px}
th,td{text-align:left;padding:11px;border-bottom:1px solid #1e2938}
th{color:#9aa6b8;font-size:12px;text-transform:uppercase}
.status{display:inline-block;width:8px;height:8px;border-radius:50%;background:#45d483;margin-right:7px}
small{color:#8390a3}
</style>
</head>
<body>
<header><h1>IZAKHONO Analytics Command Centre</h1><div class="sub">First-party traffic, conversion and revenue intelligence</div></header>
<main>
<div class="toolbar"><button data-days="1" class="active">24 hours</button><button data-days="7">7 days</button><button data-days="30">30 days</button><small id="updated"></small></div>
<div class="cards" id="cards"></div>
<section><h2>Platforms</h2><table><thead><tr><th>Platform</th><th>Views</th><th>Visitors</th><th>Sessions</th><th>Sign-ups</th><th>Checkout starts</th><th>Sales</th><th>Revenue</th><th>Conversion</th></tr></thead><tbody id="platforms"></tbody></table></section>
<section><h2>Top pages</h2><table><thead><tr><th>Platform</th><th>Page</th><th>Views</th></tr></thead><tbody id="pages"></tbody></table></section>
</main>
<script>
let days=1;
const money=n=>'R'+((n||0)/100).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
async function load(){
 const r=await fetch('/api/summary?days='+days); const d=await r.json();
 const t=d.totals;
 const cards=[['Page views',t.pageviews],['Unique visitors',t.unique_visitors],['Sessions',t.sessions],['Sign-ups',t.signups],['Checkout starts',t.checkout_starts],['Sales',t.purchases],['Revenue',money(t.revenue_minor)],['Bots filtered',t.bot_events]];
 document.querySelector('#cards').innerHTML=cards.map(x=>'<div class="card"><div class="value">'+x[1]+'</div><div class="label">'+x[0]+'</div></div>').join('');
 document.querySelector('#platforms').innerHTML=d.platforms.map(p=>{
   const conv=p.unique_visitors?((p.purchases/p.unique_visitors)*100).toFixed(1)+'%':'0.0%';
   return '<tr><td><span class="status"></span>'+p.platform+'</td><td>'+p.pageviews+'</td><td>'+p.unique_visitors+'</td><td>'+p.sessions+'</td><td>'+p.signups+'</td><td>'+p.checkout_starts+'</td><td>'+p.purchases+'</td><td>'+money(p.revenue_minor)+'</td><td>'+conv+'</td></tr>'
 }).join('');
 document.querySelector('#pages').innerHTML=d.top_pages.map(p=>'<tr><td>'+p.platform+'</td><td>'+p.path+'</td><td>'+p.pageviews+'</td></tr>').join('');
 document.querySelector('#updated').textContent='Updated '+new Date().toLocaleTimeString();
}
document.querySelectorAll('button[data-days]').forEach(b=>b.onclick=()=>{days=Number(b.dataset.days);document.querySelectorAll('button').forEach(x=>x.classList.remove('active'));b.classList.add('active');load()});
load(); setInterval(load,30000);
</script>
</body></html>"""

class Handler(BaseHTTPRequestHandler):
    server_version = "IZAKHONOAnalytics/1.0"

    def log_message(self, fmt, *args):
        return

    def _origin_allowed(self):
        origin = self.headers.get("Origin", "")
        if not origin:
            return True
        try:
            parsed = urlparse(origin)
            return parsed.scheme in ("http", "https") and (
                parsed.hostname in ("127.0.0.1", "localhost") or parsed.scheme == "https"
            )
        except Exception:
            return False

    def _send(self, status, body, content_type="application/json; charset=utf-8", cors=False):
        data = body.encode() if isinstance(body, str) else json.dumps(body, separators=(",", ":")).encode()
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if cors and self._origin_allowed():
            self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin") or "*")
            self.send_header("Vary", "Origin")
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        if not self._origin_allowed():
            return self._send(403, {"error": "origin_not_allowed"})
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin", "*"))
        self.send_header("Access-Control-Allow-Methods", "POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "600")
        self.end_headers()

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/healthz":
            return self._send(200, {"ok": True, "service": "IZAKHONO Analytics", "privacy": "no-raw-ip-storage"})
        if url.path == "/beacon.js":
            platform = safe_text(parse_qs(url.query).get("platform", [""])[0], 64)
            if platform not in PLATFORMS:
                return self._send(404, "/* unknown platform */", "application/javascript")
            return self._send(200, BEACON_JS, "application/javascript; charset=utf-8", cors=True)
        if url.path == "/api/summary":
            days = parse_qs(url.query).get("days", ["1"])[0]
            try:
                return self._send(200, summary(days))
            except Exception:
                return self._send(400, {"error": "invalid_days"})
        if url.path in ("/", "/dashboard"):
            return self._send(200, dashboard_html(), "text/html; charset=utf-8")
        return self._send(404, {"error": "not_found"})

    def do_POST(self):
        if self.path != "/v1/hit":
            return self._send(404, {"error": "not_found"})
        if not self._origin_allowed():
            return self._send(403, {"error": "origin_not_allowed"}, cors=True)
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > 16384:
            return self._send(413, {"error": "invalid_body"}, cors=True)
        try:
            body = json.loads(self.rfile.read(length))
        except Exception:
            return self._send(400, {"error": "invalid_json"}, cors=True)

        platform = safe_text(body.get("platform"), 64)
        if platform not in PLATFORMS:
            return self._send(400, {"error": "unknown_platform"}, cors=True)
        event = safe_text(body.get("event") or "pageview", 64)
        if not re.fullmatch(r"[a-z][a-z0-9_.-]{0,63}", event):
            return self._send(400, {"error": "invalid_event"}, cors=True)

        device, is_bot = classify_device(self.headers.get("User-Agent", ""))
        try:
            value_minor = max(0, min(1000000000, int(body.get("value_minor", 0))))
        except Exception:
            value_minor = 0

        conn.execute("""
          INSERT INTO events(ts_utc,platform,event,path,referrer_host,visitor_hash,session_hash,device,is_bot,value_minor)
          VALUES(?,?,?,?,?,?,?,?,?,?)
        """, (
            utc_now(), platform, event, safe_path(body.get("path") or "/"),
            referrer_host(body.get("referrer")),
            sha_token(safe_text(body.get("visitor_id"), 160)),
            sha_token(safe_text(body.get("session_id"), 160)),
            device, is_bot, value_minor
        ))
        conn.commit()
        return self._send(202, {"ok": True}, cors=True)

if __name__ == "__main__":
    httpd = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"IZAKHONO Analytics listening on :{PORT}", flush=True)
    httpd.serve_forever()
