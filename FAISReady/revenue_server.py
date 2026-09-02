#!/usr/bin/env python3
"""FAISReady bootstrap revenue server.

Purpose:
- run on the IZAKHONO CLOUD native Launch Bridge with no Docker requirement;
- keep the public sales page and paid learning route on one loopback-only process;
- store bootstrap orders and entitlements in local SQLite instead of requiring
  Supabase before the first sale;
- create signed PayFast hosted-checkout forms server-side;
- grant access only after a fail-closed PayFast ITN verification path.

This is a bootstrap commerce layer, not the final distributed platform. Real
merchant credentials, tunnel credentials and production domains stay outside
source control.
"""
from __future__ import annotations

import argparse
import hashlib
import hmac
import html
import ipaddress
import json
import os
import re
import secrets
import socket
import sqlite3
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Iterable

APP_DIR = Path(__file__).resolve().parent
DEFAULT_DATA_DIR = Path.home() / ".izakhono-cloud" / "faisready"
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
ORDER_RE = re.compile(r"^fr_[A-Za-z0-9_-]{16,80}$")
TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{32,160}$")
MAX_BODY = 128 * 1024

PLANS = {
    "re5": {
        "label": "RE5 Complete Prep",
        "amount": "299.00",
        "days": 90,
    },
    "re1": {
        "label": "RE1 Complete Prep",
        "amount": "399.00",
        "days": 90,
    },
    "combo": {
        "label": "RE5 + RE1 Complete Prep",
        "amount": "549.00",
        "days": 120,
    },
}

PAYFAST_VALID_HOSTS = (
    "www.payfast.co.za",
    "w1w.payfast.co.za",
    "w2w.payfast.co.za",
    "sandbox.payfast.co.za",
)

DB_LOCK = threading.RLock()


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime | None = None) -> str:
    return (dt or now_utc()).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def env_bool(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def data_dir() -> Path:
    raw = os.environ.get("FAISREADY_DATA_DIR", "").strip()
    path = Path(raw).expanduser() if raw else DEFAULT_DATA_DIR
    path.mkdir(parents=True, exist_ok=True)
    return path


def db_path() -> Path:
    return data_dir() / "faisready-bootstrap.sqlite3"


def connect_db(path: Path | None = None) -> sqlite3.Connection:
    conn = sqlite3.connect(path or db_path(), timeout=10, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=10000")
    return conn


def init_db(path: Path | None = None) -> None:
    with DB_LOCK, connect_db(path) as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS orders (
                order_id TEXT PRIMARY KEY,
                email TEXT NOT NULL,
                name_first TEXT NOT NULL,
                name_last TEXT NOT NULL,
                plan TEXT NOT NULL,
                amount TEXT NOT NULL,
                status TEXT NOT NULL CHECK(status IN ('pending','paid','cancelled','failed')),
                created_at TEXT NOT NULL,
                paid_at TEXT,
                payfast_payment_id TEXT,
                access_token TEXT UNIQUE,
                entitlement_expires_at TEXT
            );

            CREATE TABLE IF NOT EXISTS payment_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id TEXT,
                payfast_payment_id TEXT,
                payment_status TEXT,
                amount_gross TEXT,
                source_ip TEXT,
                signature_valid INTEGER NOT NULL,
                source_valid INTEGER NOT NULL,
                merchant_valid INTEGER NOT NULL,
                amount_valid INTEGER NOT NULL,
                server_valid INTEGER NOT NULL,
                accepted INTEGER NOT NULL,
                received_at TEXT NOT NULL,
                FOREIGN KEY(order_id) REFERENCES orders(order_id)
            );

            CREATE INDEX IF NOT EXISTS payment_events_order_idx
                ON payment_events(order_id, received_at);
            CREATE INDEX IF NOT EXISTS orders_email_idx
                ON orders(email, created_at);
            """
        )


def clean_text(value: object, field: str, max_len: int) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{field} must be text")
    out = " ".join(value.strip().split())
    if not out or len(out) > max_len:
        raise ValueError(f"{field} is required and must be <= {max_len} characters")
    if any(ord(c) < 32 for c in out):
        raise ValueError(f"{field} contains invalid control characters")
    return out


def clean_email(value: object) -> str:
    email_value = clean_text(value, "email", 100).lower()
    if not EMAIL_RE.fullmatch(email_value):
        raise ValueError("enter a valid email address")
    return email_value


def public_base_url() -> str:
    value = os.environ.get("PUBLIC_BASE_URL", "").strip().rstrip("/")
    if not value:
        raise ValueError("PUBLIC_BASE_URL is not configured")
    parsed = urllib.parse.urlsplit(value)
    allow_http = env_bool("FAISREADY_ALLOW_HTTP_BASE", False)
    if parsed.scheme not in ({"http", "https"} if allow_http else {"https"}):
        raise ValueError("PUBLIC_BASE_URL must use HTTPS")
    if not parsed.netloc or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("PUBLIC_BASE_URL must be a clean public origin")
    if not allow_http and (parsed.hostname or "").lower() in {"localhost", "127.0.0.1", "::1"}:
        raise ValueError("PUBLIC_BASE_URL must be publicly reachable")
    return value


def payment_settings() -> dict:
    merchant_id = os.environ.get("PAYFAST_MERCHANT_ID", "").strip()
    merchant_key = os.environ.get("PAYFAST_MERCHANT_KEY", "").strip()
    passphrase = os.environ.get("PAYFAST_PASSPHRASE", "").strip()
    sandbox = env_bool("PAYFAST_SANDBOX", True)
    ready = bool(merchant_id and merchant_key and passphrase)
    base_ready = True
    try:
        base = public_base_url()
    except ValueError:
        base = None
        base_ready = False
    return {
        "merchant_id": merchant_id,
        "merchant_key": merchant_key,
        "passphrase": passphrase,
        "sandbox": sandbox,
        "ready": ready and base_ready,
        "base_url": base,
        "host": "sandbox.payfast.co.za" if sandbox else "www.payfast.co.za",
    }


def pf_encode(value: str) -> str:
    return urllib.parse.quote_plus(value.strip(), safe="")


def payfast_param_string(pairs: Iterable[tuple[str, str]]) -> str:
    encoded: list[str] = []
    for key, value in pairs:
        value = str(value).strip()
        if value != "":
            encoded.append(f"{key}={pf_encode(value)}")
    return "&".join(encoded)


def payfast_signature(pairs: Iterable[tuple[str, str]], passphrase: str) -> str:
    param = payfast_param_string(pairs)
    if passphrase:
        param += "&passphrase=" + pf_encode(passphrase)
    return hashlib.md5(param.encode("utf-8"), usedforsecurity=False).hexdigest()


def create_order(plan_key: str, first: str, last: str, email_value: str, path: Path | None = None) -> sqlite3.Row:
    if plan_key not in PLANS:
        raise ValueError("unknown plan")
    plan = PLANS[plan_key]
    order_id = "fr_" + secrets.token_urlsafe(18)
    created = iso()
    with DB_LOCK, connect_db(path) as conn:
        conn.execute(
            """
            INSERT INTO orders(order_id,email,name_first,name_last,plan,amount,status,created_at)
            VALUES(?,?,?,?,?,?, 'pending', ?)
            """,
            (order_id, email_value, first, last, plan_key, plan["amount"], created),
        )
        row = conn.execute("SELECT * FROM orders WHERE order_id=?", (order_id,)).fetchone()
    assert row is not None
    return row


def get_order(order_id: str, path: Path | None = None) -> sqlite3.Row | None:
    if not ORDER_RE.fullmatch(order_id):
        return None
    with DB_LOCK, connect_db(path) as conn:
        return conn.execute("SELECT * FROM orders WHERE order_id=?", (order_id,)).fetchone()


def active_entitlement(token: str, path: Path | None = None) -> sqlite3.Row | None:
    if not TOKEN_RE.fullmatch(token):
        return None
    with DB_LOCK, connect_db(path) as conn:
        row = conn.execute(
            "SELECT * FROM orders WHERE access_token=? AND status='paid'",
            (token,),
        ).fetchone()
    if row is None or not row["entitlement_expires_at"]:
        return None
    try:
        expiry = datetime.fromisoformat(row["entitlement_expires_at"].replace("Z", "+00:00"))
    except ValueError:
        return None
    return row if expiry > now_utc() else None


def grant_entitlement(order_id: str, pf_payment_id: str, path: Path | None = None) -> sqlite3.Row:
    with DB_LOCK, connect_db(path) as conn:
        conn.execute("BEGIN IMMEDIATE")
        try:
            row = conn.execute("SELECT * FROM orders WHERE order_id=?", (order_id,)).fetchone()
            if row is None:
                raise ValueError("order not found")
            if row["status"] == "paid" and row["access_token"]:
                conn.execute("COMMIT")
                return row
            days = int(PLANS[row["plan"]]["days"])
            paid_at = now_utc()
            expiry = paid_at + timedelta(days=days)
            token = secrets.token_urlsafe(36)
            conn.execute(
                """
                UPDATE orders
                SET status='paid', paid_at=?, payfast_payment_id=?, access_token=?, entitlement_expires_at=?
                WHERE order_id=?
                """,
                (iso(paid_at), pf_payment_id, token, iso(expiry), order_id),
            )
            row = conn.execute("SELECT * FROM orders WHERE order_id=?", (order_id,)).fetchone()
            conn.execute("COMMIT")
            assert row is not None
            return row
        except Exception:
            conn.execute("ROLLBACK")
            raise


def checkout_fields(order: sqlite3.Row) -> tuple[str, list[tuple[str, str]]]:
    cfg = payment_settings()
    if not cfg["ready"]:
        raise ValueError("secure checkout is not configured on this host")
    base = cfg["base_url"]
    assert base
    fields: list[tuple[str, str]] = [
        ("merchant_id", cfg["merchant_id"]),
        ("merchant_key", cfg["merchant_key"]),
        ("return_url", f"{base}/payment/return?order={urllib.parse.quote(order['order_id'])}"),
        ("cancel_url", f"{base}/payment/cancel?order={urllib.parse.quote(order['order_id'])}"),
        ("notify_url", f"{base}/api/payfast/itn"),
        ("name_first", order["name_first"]),
        ("name_last", order["name_last"]),
        ("email_address", order["email"]),
        ("m_payment_id", order["order_id"]),
        ("amount", order["amount"]),
        ("item_name", PLANS[order["plan"]]["label"]),
        ("item_description", "FAISReady regulatory exam preparation access"),
        ("custom_str1", order["plan"]),
    ]
    fields.append(("signature", payfast_signature(fields, cfg["passphrase"])))
    return f"https://{cfg['host']}/eng/process", fields


def resolved_payfast_ips() -> set[str]:
    result: set[str] = set()
    for host in PAYFAST_VALID_HOSTS:
        try:
            for item in socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM):
                result.add(str(ipaddress.ip_address(item[4][0])))
        except (socket.gaierror, ValueError):
            continue
    return result


def request_source_ip(handler: BaseHTTPRequestHandler) -> str:
    peer = handler.client_address[0]
    if env_bool("FAISREADY_TRUST_CLOUDFLARE", False):
        try:
            peer_ip = ipaddress.ip_address(peer)
        except ValueError:
            peer_ip = None
        if peer_ip is not None and peer_ip.is_loopback:
            forwarded = handler.headers.get("CF-Connecting-IP", "").strip()
            if forwarded:
                try:
                    return str(ipaddress.ip_address(forwarded))
                except ValueError:
                    return peer
    try:
        return str(ipaddress.ip_address(peer))
    except ValueError:
        return peer


def validate_payfast_source(source_ip: str) -> bool:
    try:
        candidate = str(ipaddress.ip_address(source_ip))
    except ValueError:
        return False
    return candidate in resolved_payfast_ips()


def validate_payfast_server(param_string: str, sandbox: bool) -> bool:
    host = "sandbox.payfast.co.za" if sandbox else "www.payfast.co.za"
    url = f"https://{host}/eng/query/validate"
    req = urllib.request.Request(
        url,
        data=param_string.encode("utf-8"),
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "FAISReady-IZAKHONO/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            return response.read(32).decode("utf-8", "replace").strip() == "VALID"
    except (urllib.error.URLError, TimeoutError, OSError):
        return False


def record_payment_event(
    *,
    order_id: str | None,
    pf_payment_id: str,
    payment_status: str,
    amount_gross: str,
    source_ip: str,
    signature_valid: bool,
    source_valid: bool,
    merchant_valid: bool,
    amount_valid: bool,
    server_valid: bool,
    accepted: bool,
    path: Path | None = None,
) -> None:
    with DB_LOCK, connect_db(path) as conn:
        conn.execute(
            """
            INSERT INTO payment_events(
                order_id,payfast_payment_id,payment_status,amount_gross,source_ip,
                signature_valid,source_valid,merchant_valid,amount_valid,server_valid,
                accepted,received_at
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                order_id,
                pf_payment_id,
                payment_status,
                amount_gross,
                source_ip,
                int(signature_valid),
                int(source_valid),
                int(merchant_valid),
                int(amount_valid),
                int(server_valid),
                int(accepted),
                iso(),
            ),
        )


def csp() -> str:
    return (
        "default-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "script-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https://images.unsplash.com; "
        "connect-src 'self'; "
        "form-action https://www.payfast.co.za https://sandbox.payfast.co.za; "
        "frame-ancestors 'none'; base-uri 'none'; object-src 'none'"
    )


class RevenueHandler(BaseHTTPRequestHandler):
    server_version = "FAISReadyRevenue/1.0"

    def log_message(self, fmt: str, *args: object) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def common_headers(self, content_type: str, length: int, *, cache: str = "no-store") -> None:
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(length))
        self.send_header("Cache-Control", cache)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Content-Security-Policy", csp())
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

    def send_bytes(self, status: int, body: bytes, content_type: str, *, cache: str = "no-store") -> None:
        self.send_response(status)
        self.common_headers(content_type, len(body), cache=cache)
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, status: int, value: object) -> None:
        body = (json.dumps(value, separators=(",", ":"), ensure_ascii=False) + "\n").encode("utf-8")
        self.send_bytes(status, body, "application/json; charset=utf-8")

    def send_html(self, status: int, value: str, *, cache: str = "no-store") -> None:
        self.send_bytes(status, value.encode("utf-8"), "text/html; charset=utf-8", cache=cache)

    def read_body(self) -> bytes:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            raise ValueError("invalid Content-Length")
        if length < 0 or length > MAX_BODY:
            raise ValueError("request body too large")
        return self.rfile.read(length)

    def route(self) -> tuple[str, dict[str, list[str]]]:
        parsed = urllib.parse.urlsplit(self.path)
        return parsed.path, urllib.parse.parse_qs(parsed.query, keep_blank_values=True)

    def do_GET(self) -> None:  # noqa: N802
        path, query = self.route()
        if path == "/health":
            self.send_json(200, {"ok": True, "service": "faisready-revenue", "storage": "sqlite"})
            return
        if path == "/api/config":
            cfg = payment_settings()
            self.send_json(
                200,
                {
                    "payments_configured": bool(cfg["ready"]),
                    "payfast_sandbox": bool(cfg["sandbox"]),
                    "plans": {k: {"label": v["label"], "amount": v["amount"], "days": v["days"]} for k, v in PLANS.items()},
                },
            )
            return
        if path == "/api/order-status":
            order_id = (query.get("order") or [""])[0]
            row = get_order(order_id)
            if row is None:
                self.send_json(404, {"error": "order not found"})
                return
            response: dict[str, object] = {
                "order": row["order_id"],
                "status": row["status"],
                "plan": row["plan"],
                "amount": row["amount"],
            }
            if row["status"] == "paid" and row["access_token"]:
                response["access_url"] = "/learn?token=" + urllib.parse.quote(row["access_token"])
                response["expires_at"] = row["entitlement_expires_at"]
            self.send_json(200, response)
            return
        if path == "/payment/return":
            order_id = html.escape((query.get("order") or [""])[0])
            self.send_html(
                200,
                f"""<!doctype html><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>
                <title>FAISReady payment confirmation</title><style>body{{font-family:system-ui;background:#071824;color:#eefaff;display:grid;place-items:center;min-height:100vh;margin:0}}main{{max-width:620px;background:#0d2a3d;border:1px solid #315c73;border-radius:22px;padding:28px}}a{{color:#62efd2}}.box{{padding:14px;background:#071e2c;border-radius:12px;margin:14px 0}}</style>
                <main><h1>Payment received by PayFast</h1><p>We are waiting for the signed server confirmation before unlocking your course. This page checks automatically.</p><div class='box' id='state'>Verifying…</div><p><a href='/'>Return to FAISReady</a></p></main>
                <script>const order={json.dumps(order_id)};async function poll(){{try{{const r=await fetch('/api/order-status?order='+encodeURIComponent(order));const d=await r.json();if(d.status==='paid'&&d.access_url){{document.getElementById('state').innerHTML='Payment verified. <a href="'+d.access_url+'">Open your paid FAISReady access</a><br><small>Access expires '+d.expires_at+'</small>';return}}document.getElementById('state').textContent='Verification status: '+(d.status||'pending');}}catch(e){{document.getElementById('state').textContent='Verification is still pending.'}}setTimeout(poll,2500)}}poll();</script>""",
            )
            return
        if path == "/payment/cancel":
            self.send_html(
                200,
                "<!doctype html><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Payment cancelled</title><style>body{font-family:system-ui;background:#071824;color:#eefaff;display:grid;place-items:center;min-height:100vh}main{max-width:600px}</style><main><h1>Payment cancelled</h1><p>No course access was activated. You can return and choose a plan whenever you are ready.</p><p><a style='color:#62efd2' href='/'>Back to FAISReady</a></p></main>",
            )
            return
        if path == "/learn":
            token = (query.get("token") or [""])[0]
            entitlement = active_entitlement(token)
            if entitlement is None:
                self.send_html(403, "<!doctype html><title>Access unavailable</title><h1>Paid access is invalid or expired.</h1><p><a href='/'>Return to FAISReady</a></p>")
                return
            source = (APP_DIR / "index.html").read_text(encoding="utf-8")
            banner = (
                "<div style=\"position:sticky;top:0;z-index:99999;padding:10px 16px;background:#0a6b58;color:white;font:700 13px system-ui;text-align:center\">"
                + "PAID ACCESS ACTIVE • "
                + html.escape(PLANS[entitlement["plan"]]["label"])
                + " • expires "
                + html.escape(entitlement["entitlement_expires_at"])
                + "</div>"
            )
            source = source.replace("<body>", "<body>" + banner, 1)
            self.send_html(200, source, cache="private, no-store")
            return
        if path in {"/", "/store.html", "/index.html"}:
            source = (APP_DIR / "store.html").read_text(encoding="utf-8")
            self.send_html(200, source, cache="no-cache")
            return
        self.send_html(404, "<!doctype html><title>Not found</title><h1>Not found</h1>")

    def do_POST(self) -> None:  # noqa: N802
        path, _ = self.route()
        if path == "/api/checkout":
            try:
                raw = self.read_body()
                if self.headers.get_content_type() != "application/json":
                    raise ValueError("checkout requires application/json")
                payload = json.loads(raw.decode("utf-8"))
                if not isinstance(payload, dict):
                    raise ValueError("invalid checkout request")
                plan = clean_text(payload.get("plan"), "plan", 20).lower()
                first = clean_text(payload.get("first_name"), "first_name", 50)
                last = clean_text(payload.get("last_name"), "last_name", 50)
                email_value = clean_email(payload.get("email"))
                if plan not in PLANS:
                    raise ValueError("unknown plan")
                cfg = payment_settings()
                if not cfg["ready"]:
                    self.send_json(503, {"error": "secure checkout is not configured on this host"})
                    return
                order = create_order(plan, first, last, email_value)
                action, fields = checkout_fields(order)
                self.send_json(
                    201,
                    {
                        "order": order["order_id"],
                        "payment_url": action,
                        "fields": {key: value for key, value in fields},
                        "sandbox": bool(cfg["sandbox"]),
                    },
                )
            except (ValueError, json.JSONDecodeError, UnicodeDecodeError) as exc:
                self.send_json(400, {"error": str(exc)})
            return

        if path == "/api/payfast/itn":
            try:
                raw = self.read_body()
                text = raw.decode("utf-8")
                pairs = urllib.parse.parse_qsl(text, keep_blank_values=True, strict_parsing=False)
                pf_data = {k: v for k, v in pairs}
                received_sig = pf_data.get("signature", "")
                unsigned_pairs = [(k, v) for k, v in pairs if k != "signature"]
                param_string = payfast_param_string(unsigned_pairs)
                cfg = payment_settings()
                expected_sig = payfast_signature(unsigned_pairs, cfg["passphrase"])
                sig_ok = bool(received_sig) and hmac.compare_digest(received_sig.lower(), expected_sig.lower())
                source_ip = request_source_ip(self)
                source_ok = validate_payfast_source(source_ip)
                order_id = pf_data.get("m_payment_id", "")
                order = get_order(order_id)
                merchant_ok = bool(order is not None and pf_data.get("merchant_id", "") == cfg["merchant_id"])
                amount_gross = pf_data.get("amount_gross", "")
                amount_ok = False
                if order is not None:
                    try:
                        amount_ok = abs(float(amount_gross) - float(order["amount"])) <= 0.01
                    except ValueError:
                        amount_ok = False
                server_ok = False
                if sig_ok and source_ok and merchant_ok and amount_ok:
                    server_ok = validate_payfast_server(param_string, bool(cfg["sandbox"]))
                payment_status = pf_data.get("payment_status", "")
                accepted = bool(
                    order is not None
                    and sig_ok
                    and source_ok
                    and merchant_ok
                    and amount_ok
                    and server_ok
                    and payment_status == "COMPLETE"
                )
                pf_payment_id = pf_data.get("pf_payment_id", "")[:100]
                record_payment_event(
                    order_id=order_id if order is not None else None,
                    pf_payment_id=pf_payment_id,
                    payment_status=payment_status[:40],
                    amount_gross=amount_gross[:40],
                    source_ip=source_ip[:80],
                    signature_valid=sig_ok,
                    source_valid=source_ok,
                    merchant_valid=merchant_ok,
                    amount_valid=amount_ok,
                    server_valid=server_ok,
                    accepted=accepted,
                )
                if accepted:
                    grant_entitlement(order_id, pf_payment_id)
                    self.send_bytes(200, b"OK\n", "text/plain; charset=utf-8")
                else:
                    self.send_bytes(400, b"INVALID\n", "text/plain; charset=utf-8")
            except (ValueError, UnicodeDecodeError) as exc:
                self.send_json(400, {"error": str(exc)})
            return

        self.send_json(404, {"error": "not found"})


def self_test() -> int:
    with tempfile.TemporaryDirectory(prefix="faisready-revenue-test-") as tmp:
        path = Path(tmp) / "test.sqlite3"
        init_db(path)
        first = clean_text(" Bevan ", "first_name", 50)
        last = clean_text(" Shelton ", "last_name", 50)
        email_value = clean_email("TEST@example.com")
        row = create_order("re5", first, last, email_value, path)
        assert row["amount"] == "299.00"
        assert row["status"] == "pending"
        sample = [
            ("merchant_id", "10000100"),
            ("merchant_key", "46f0cd694581a"),
            ("amount", "299.00"),
            ("item_name", "RE5 Complete Prep"),
        ]
        sig1 = payfast_signature(sample, "jt7NOE43FZPn")
        sig2 = payfast_signature(sample, "jt7NOE43FZPn")
        assert sig1 == sig2 and re.fullmatch(r"[0-9a-f]{32}", sig1)
        paid = grant_entitlement(row["order_id"], "PF-SELFTEST", path)
        assert paid["status"] == "paid"
        assert active_entitlement(paid["access_token"], path) is not None
        paid2 = grant_entitlement(row["order_id"], "PF-SELFTEST", path)
        assert paid2["access_token"] == paid["access_token"]
    print("FAISReady revenue server self-test: PASS")
    return 0


def run_server() -> int:
    init_db()
    host = os.environ.get("HOST", "127.0.0.1").strip()
    port = int(os.environ.get("PORT", "18091"))
    if host not in {"127.0.0.1", "::1", "localhost"}:
        raise SystemExit("FAISReady revenue server refuses non-loopback HOST")
    if not (1024 <= port <= 65535):
        raise SystemExit("PORT must be between 1024 and 65535")
    server = ThreadingHTTPServer((host, port), RevenueHandler)
    print(f"FAISReady revenue server listening on http://{host}:{port}")
    print(f"payments_configured={payment_settings()['ready']}")
    try:
        server.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="FAISReady bootstrap revenue server")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        return self_test()
    return run_server()


if __name__ == "__main__":
    raise SystemExit(main())
