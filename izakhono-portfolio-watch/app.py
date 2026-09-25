#!/usr/bin/env python3
import hashlib
import html
import json
import os
import re
import secrets
import sqlite3
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

BASE = Path(__file__).resolve().parent
REGISTRY_PATH = Path(os.getenv("IZA_WATCH_REGISTRY", str(BASE / "portfolio.json")))
DB_PATH = Path(os.getenv("IZA_WATCH_DB", str(BASE / "data" / "portfolio-watch.db")))
HOST = os.getenv("IZA_WATCH_HOST", "127.0.0.1")
PORT = int(os.getenv("IZA_WATCH_PORT", "8860"))
INTERVAL_MINUTES = max(15, int(os.getenv("IZA_WATCH_INTERVAL_MINUTES", "360")))
ADMIN_TOKEN = os.getenv("IZA_WATCH_ADMIN_TOKEN") or secrets.token_urlsafe(36)
TOKEN_WAS_GENERATED = "IZA_WATCH_ADMIN_TOKEN" not in os.environ
NOTIFY_URL = os.getenv("IZA_WATCH_NOTIFY_URL", "").strip()
NOTIFY_KEY = os.getenv("IZA_WATCH_NOTIFY_KEY", "").strip()
MAX_BYTES = max(100_000, int(os.getenv("IZA_WATCH_MAX_BYTES", "1500000")))
REQUEST_TIMEOUT = max(5, int(os.getenv("IZA_WATCH_REQUEST_TIMEOUT", "20")))

PRICE_RE = re.compile(r"(?i)(?:USD|ZAR|EUR|GBP)\s?\d[\d,\.]*|(?:R|\$|€|£)\s?\d[\d,\.]*(?:\s?[/ ](?:month|mo|year|yr|user|seat))?")
TAG_RE = re.compile(r"<[^>]+>")
SCRIPT_RE = re.compile(r"(?is)<(script|style|noscript|svg)[^>]*>.*?</\1>")
SPACE_RE = re.compile(r"\s+")

DEFAULT_TERMS = [
    "launch", "launched", "new", "introducing", "release", "released", "update",
    "ai", "agent", "assistant", "automation", "workflow", "template", "creator",
    "small business", "pricing", "price", "plan", "package", "subscription",
    "free", "premium", "pro", "business", "enterprise", "credit", "credits",
    "api", "integration", "connector", "mobile", "offline", "collaboration"
]

CATEGORY_TERMS = {
    "design": ["design", "editor", "image", "video", "brand", "layer", "generative", "resize", "presentation"],
    "music": ["artist", "royalty", "streaming", "playlist", "distribution", "music", "audio", "rights", "ticket"],
    "video": ["video", "streaming", "creator", "channel", "live", "cinema", "tv", "subscription"],
    "education": ["qualification", "accreditation", "curriculum", "assessment", "learner", "student", "training", "certificate"],
    "regulatory": ["regulation", "notice", "circular", "effective", "deadline", "compliance", "licence", "accreditation", "requirement"],
    "fintech": ["payment", "checkout", "merchant", "fee", "wallet", "fraud", "bank", "settlement", "transaction"],
    "insurance": ["insurance", "claim", "assistance", "policy", "premium", "legal", "underwriting", "fraud"],
    "automotive": ["vehicle", "repair", "diagnostic", "quote", "service", "parts", "car", "driver", "licence"],
    "jobs": ["job", "hiring", "recruiter", "employer", "candidate", "cv", "resume", "skills", "work"],
    "ecommerce": ["marketplace", "seller", "store", "checkout", "listing", "shipping", "merchant", "commerce"],
    "social": ["social", "community", "creator", "moderation", "safety", "verification", "message", "feed"],
    "productivity": ["document", "spreadsheet", "presentation", "workspace", "collaboration", "automation", "assistant"],
    "infrastructure": ["cloud", "deploy", "runtime", "edge", "dns", "database", "storage", "ci", "cd", "security"],
    "security": ["security", "fraud", "malware", "phishing", "breach", "identity", "risk", "threat", "trust"],
    "accounting": ["accounting", "bookkeeping", "tax", "invoice", "payroll", "cash flow", "expense", "asset"],
    "gaming": ["gaming", "game", "creator", "asset", "render", "3d", "animation", "mod", "engine"],
    "ai": ["model", "llm", "agent", "multimodal", "reasoning", "context", "api", "inference", "gpu"],
    "communications": ["file transfer", "mail", "message", "share", "upload", "download", "storage"],
    "websites": ["website", "site builder", "hosting", "domain", "seo", "commerce", "template", "landing page"],
    "fashion": ["apparel", "fashion", "merch", "clothing", "design", "commerce", "custom", "print"]
}

DECISIONS = {
    "pricing": "Review our packaging and unit economics before changing price; preserve a simpler value proposition rather than copying the competitor.",
    "ai": "Decide whether this capability belongs in the next owned AI milestone, and implement it through a replaceable model adapter rather than vendor lock-in.",
    "workflow": "Reduce the equivalent IZAKHONO workflow to fewer clicks and make the best path available as a one-click or guided action.",
    "regulatory": "Open a compliance impact review now and map the effective date, affected product flow, required evidence and owner before changing the product.",
    "security": "Compare the new control with FORTRESS and our privacy boundary; add the control only if it measurably reduces risk without increasing silent tracking.",
    "default": "Compare this change against the platform roadmap and choose either parity, differentiation, or deliberate non-adoption with a documented reason."
}

def utcnow():
    return datetime.now(timezone.utc)

def iso_now():
    return utcnow().isoformat().replace("+00:00", "Z")

def load_registry():
    data = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    if not isinstance(data.get("platforms"), list):
        raise ValueError("portfolio.json must contain a platforms array")
    return data

def db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=20)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def init_db():
    with db() as c:
        c.executescript("""
        create table if not exists source_state(
          source_id text primary key,
          platform_id text not null,
          url text not null,
          signal_hash text,
          signal_text text,
          prices_json text not null default '[]',
          last_status integer,
          last_checked text,
          last_changed text,
          last_error text
        );
        create table if not exists alerts(
          id integer primary key autoincrement,
          created_at text not null,
          platform_id text not null,
          source_id text not null,
          source_name text not null,
          url text not null,
          category text not null,
          summary text not null,
          impact text not null,
          decision text not null,
          score integer not null,
          notified integer not null default 0
        );
        create table if not exists runs(
          id integer primary key autoincrement,
          started_at text not null,
          finished_at text,
          status text not null,
          checked integer not null default 0,
          changed integer not null default 0,
          alerted integer not null default 0,
          errors integer not null default 0,
          detail text
        );
        """)

def clean_html(raw):
    raw = SCRIPT_RE.sub(" ", raw)
    raw = re.sub(r"(?is)<!--.*?-->", " ", raw)
    raw = TAG_RE.sub(" ", raw)
    raw = html.unescape(raw)
    return SPACE_RE.sub(" ", raw).strip()

def split_sentences(text):
    parts = re.split(r"(?<=[.!?])\s+|\s+[|•·]\s+|\n+", text)
    return [p.strip() for p in parts if len(p.strip()) >= 20]

def terms_for(platform, source):
    terms = set(DEFAULT_TERMS)
    for category in platform.get("categories", []):
        terms.update(CATEGORY_TERMS.get(category, []))
    terms.update(platform.get("keywords", []))
    terms.update(source.get("keywords", []))
    return sorted({t.lower() for t in terms if t})

def extract_signal(text, terms):
    low_terms = tuple(terms)
    selected = []
    for sentence in split_sentences(text):
        s = sentence.lower()
        if any(t in s for t in low_terms) or PRICE_RE.search(sentence):
            selected.append(sentence[:700])
        if len(selected) >= 80:
            break
    prices = sorted(set(PRICE_RE.findall(text)))[:80]
    compact = "\n".join(selected)
    return compact[:40_000], prices

def hash_text(text):
    return hashlib.sha256(text.encode("utf-8", "replace")).hexdigest()

def fetch_url(url):
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError("Only public http/https sources are allowed")
    req = urllib.request.Request(url, headers={
        "User-Agent": "IZAKHONO-Portfolio-Watch/1.0 (+owner-controlled competitive intelligence)"
    })
    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as r:
            raw = r.read(MAX_BYTES)
            charset = r.headers.get_content_charset() or "utf-8"
            return r.status, raw.decode(charset, "replace")
    except urllib.error.HTTPError as e:
        raw = e.read(min(MAX_BYTES, 100_000))
        return e.code, raw.decode("utf-8", "replace")

def classify_change(old_signal, new_signal, old_prices, new_prices, platform):
    old_set = set(split_sentences(old_signal or ""))
    new_set = set(split_sentences(new_signal or ""))
    added = [s for s in new_set - old_set][:12]
    removed = [s for s in old_set - new_set][:6]
    score = 0
    labels = set()
    joined = " ".join(added).lower()

    price_changed = sorted(set(old_prices) ^ set(new_prices))
    if price_changed:
        score += 5
        labels.add("pricing")
    if any(k in joined for k in ("ai ", " ai", "agent", "assistant", "generative", "model", "automation")):
        score += 4
        labels.add("ai")
    if any(k in joined for k in ("workflow", "creator", "small business", "one click", "collaboration", "integration", "connector")):
        score += 3
        labels.add("workflow")
    if any(k in joined for k in ("regulation", "effective", "deadline", "compliance", "licence", "accreditation", "requirement", "notice")):
        score += 5
        labels.add("regulatory")
    if any(k in joined for k in ("security", "fraud", "malware", "phishing", "identity", "risk", "breach")):
        score += 4
        labels.add("security")
    if added:
        score += min(4, len(added) // 2 + 1)
    if removed:
        score += 1

    threshold = int(platform.get("alert_threshold", 4))
    return score, labels, added, removed, price_changed, score >= threshold

def source_lookup():
    registry = load_registry()
    sources = []
    for platform in registry["platforms"]:
        if platform.get("enabled", True) is False:
            continue
        for idx, source in enumerate(platform.get("sources", [])):
            item = dict(source)
            item["platform"] = platform
            item["source_id"] = source.get("id") or f'{platform["id"]}:{idx}'
            sources.append(item)
    return registry, sources

def notify(alert):
    if not NOTIFY_URL:
        return False
    payload = json.dumps({
        "type": "izakhono.portfolio-watch.alert",
        "platformId": alert["platform_id"],
        "source": alert["source_name"],
        "url": alert["url"],
        "summary": alert["summary"],
        "impact": alert["impact"],
        "decision": alert["decision"],
        "score": alert["score"]
    }).encode()
    headers = {"Content-Type": "application/json", "User-Agent": "IZAKHONO-Portfolio-Watch/1.0"}
    if NOTIFY_KEY:
        headers["x-izakhono-adapter-key"] = NOTIFY_KEY
    req = urllib.request.Request(NOTIFY_URL, data=payload, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as r:
            return 200 <= r.status < 300
    except Exception:
        return False

def decision_for(labels):
    for key in ("regulatory", "security", "pricing", "ai", "workflow"):
        if key in labels:
            return DECISIONS[key]
    return DECISIONS["default"]

def make_summary(platform, source, added, price_changed, labels):
    bits = []
    if price_changed:
        bits.append("Pricing or packaging markers changed: " + ", ".join(price_changed[:8]) + ".")
    if added:
        bits.append("New watched signal: " + added[0][:450])
    if labels:
        bits.append("Detected themes: " + ", ".join(sorted(labels)) + ".")
    if not bits:
        bits.append("A material watched section changed on the source page.")
    return " ".join(bits)

def impact_for(platform, labels):
    name = platform.get("name") or platform["id"]
    if "regulatory" in labels:
        return f"This may change compliance, eligibility, claims, onboarding or evidence requirements for {name}."
    if "pricing" in labels:
        return f"This may change the value comparison, packaging or margin assumptions for {name}."
    if "ai" in labels:
        return f"This may raise user expectations for AI-assisted creation, automation or support inside {name}."
    if "workflow" in labels:
        return f"This may change the expected speed or simplicity of the core workflow in {name}."
    if "security" in labels:
        return f"This may affect the security baseline or trust proposition for {name}."
    return f"This is a competitor or market change worth comparing with the current roadmap for {name}."

def process_source(source):
    platform = source["platform"]
    source_id = source["source_id"]
    status, raw = fetch_url(source["url"])
    text = clean_html(raw)
    signal, prices = extract_signal(text, terms_for(platform, source))
    signal_hash = hash_text(signal + "\n" + "\n".join(prices))
    now = iso_now()

    with db() as c:
        prev = c.execute("select * from source_state where source_id=?", (source_id,)).fetchone()
        if not prev:
            c.execute(
                """insert into source_state(source_id,platform_id,url,signal_hash,signal_text,prices_json,last_status,last_checked,last_changed,last_error)
                   values(?,?,?,?,?,?,?,?,?,?)""",
                (source_id, platform["id"], source["url"], signal_hash, signal, json.dumps(prices), status, now, now, None)
            )
            return {"changed": False, "alerted": False, "baseline": True}

        old_prices = json.loads(prev["prices_json"] or "[]")
        changed = prev["signal_hash"] != signal_hash
        alerted = False
        if changed:
            score, labels, added, removed, price_changed, meaningful = classify_change(
                prev["signal_text"] or "", signal, old_prices, prices, platform
            )
            c.execute(
                """update source_state set signal_hash=?, signal_text=?, prices_json=?, last_status=?, last_checked=?, last_changed=?, last_error=null
                   where source_id=?""",
                (signal_hash, signal, json.dumps(prices), status, now, now, source_id)
            )
            if meaningful:
                alert = {
                    "platform_id": platform["id"],
                    "source_id": source_id,
                    "source_name": source.get("name") or source_id,
                    "url": source["url"],
                    "category": ",".join(platform.get("categories", [])),
                    "summary": make_summary(platform, source, added, price_changed, labels),
                    "impact": impact_for(platform, labels),
                    "decision": source.get("decision") or decision_for(labels),
                    "score": score,
                }
                cur = c.execute(
                    """insert into alerts(created_at,platform_id,source_id,source_name,url,category,summary,impact,decision,score,notified)
                       values(?,?,?,?,?,?,?,?,?,?,0)""",
                    (now, alert["platform_id"], source_id, alert["source_name"], alert["url"],
                     alert["category"], alert["summary"], alert["impact"], alert["decision"], score)
                )
                alerted = notify(alert)
                if alerted:
                    c.execute("update alerts set notified=1 where id=?", (cur.lastrowid,))
        else:
            c.execute(
                "update source_state set last_status=?, last_checked=?, last_error=null where source_id=?",
                (status, now, source_id)
            )
        return {"changed": changed, "alerted": alerted, "baseline": False}

def record_error(source, exc):
    now = iso_now()
    with db() as c:
        c.execute(
            """insert into source_state(source_id,platform_id,url,last_checked,last_error)
               values(?,?,?,?,?)
               on conflict(source_id) do update set last_checked=excluded.last_checked,last_error=excluded.last_error""",
            (source["source_id"], source["platform"]["id"], source["url"], now, str(exc)[:1200])
        )

def run_once(trigger="scheduler"):
    registry, sources = source_lookup()
    started = iso_now()
    with db() as c:
        cur = c.execute("insert into runs(started_at,status,detail) values(?,?,?)", (started, "running", trigger))
        run_id = cur.lastrowid
    stats = {"checked": 0, "changed": 0, "alerted": 0, "errors": 0}
    with ThreadPoolExecutor(max_workers=WORKERS, thread_name_prefix="portfolio-watch") as pool:
        future_map = {pool.submit(process_source, source): source for source in sources}
        for future in as_completed(future_map):
            source = future_map[future]
            try:
                result = future.result()
                stats["checked"] += 1
                stats["changed"] += int(result["changed"])
                stats["alerted"] += int(result["alerted"])
            except Exception as exc:
                stats["errors"] += 1
                record_error(source, exc)
    with db() as c:
        c.execute(
            """update runs set finished_at=?,status=?,checked=?,changed=?,alerted=?,errors=?,detail=? where id=?""",
            (iso_now(), "ok" if stats["errors"] == 0 else "partial", stats["checked"], stats["changed"],
             stats["alerted"], stats["errors"], f'platforms={len(registry["platforms"])}; trigger={trigger}', run_id)
        )
    return stats

def scheduler_loop():
    time.sleep(10)
    while True:
        try:
            run_once("internal-scheduler")
        except Exception as exc:
            print("watch run failed:", exc, flush=True)
        time.sleep(INTERVAL_MINUTES * 60)

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print("%s - %s" % (self.address_string(), fmt % args), flush=True)

    def send_json(self, status, obj):
        raw = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def authorized(self):
        return self.headers.get("Authorization", "") == f"Bearer {ADMIN_TOKEN}"

    def require_auth(self):
        if self.authorized():
            return True
        self.send_json(401, {"error": "unauthorized"})
        return False

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/health":
            with db() as c:
                latest = c.execute("select * from runs order by id desc limit 1").fetchone()
                alert_count = c.execute("select count(*) from alerts").fetchone()[0]
            return self.send_json(200, {
                "ok": True,
                "service": "izakhono-portfolio-watch",
                "time": iso_now(),
                "interval_minutes": INTERVAL_MINUTES,
                "last_run": dict(latest) if latest else None,
                "alerts": alert_count
            })
        if not self.require_auth():
            return
        if path == "/api/platforms":
            registry = load_registry()
            return self.send_json(200, registry)
        if path == "/api/alerts":
            with db() as c:
                rows = c.execute("select * from alerts order by id desc limit 200").fetchall()
            return self.send_json(200, {"alerts": [dict(r) for r in rows]})
        if path == "/api/runs":
            with db() as c:
                rows = c.execute("select * from runs order by id desc limit 100").fetchall()
            return self.send_json(200, {"runs": [dict(r) for r in rows]})
        return self.send_json(404, {"error": "not found"})

    def do_POST(self):
        path = urlparse(self.path).path
        if not self.require_auth():
            return
        if path == "/api/run":
            stats = run_once("manual")
            return self.send_json(200, stats)
        return self.send_json(404, {"error": "not found"})

def main():
    init_db()
    load_registry()
    t = threading.Thread(target=scheduler_loop, name="portfolio-watch-scheduler", daemon=True)
    t.start()
    print(f"IZAKHONO Portfolio Watch listening on http://{HOST}:{PORT}", flush=True)
    print(f"Registry: {REGISTRY_PATH}", flush=True)
    print(f"Database: {DB_PATH}", flush=True)
    if TOKEN_WAS_GENERATED:
        print("SECURITY: generated temporary admin token; set IZA_WATCH_ADMIN_TOKEN before production.", flush=True)
        print(ADMIN_TOKEN, flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()

if __name__ == "__main__":
    main()
