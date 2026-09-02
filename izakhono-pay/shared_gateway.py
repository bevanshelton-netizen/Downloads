#!/usr/bin/env python3
"""IZAKHONO PAY shared group payment service.

Purpose:
- one payment/product API for all Izakhono platforms;
- keep bank and API secrets out of source control;
- create unique EFT references and pending orders;
- confirm received EFTs only from an owner-side CLI command;
- emit a signed platform callback after confirmed receipt.

This service is non-custodial orchestration. Money settles directly into the
configured merchant bank account. Card/acquirer rails can be added behind the
same order contract later without changing platform integrations.
"""
from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent
REGISTRY_PATH = APP_DIR / "products.json"
DEFAULT_DATA_DIR = Path.home() / ".izakhono-cloud" / "izakhono-pay"
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,62}$")
CODE_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")
ORDER_RE = re.compile(r"^izp_[A-Za-z0-9_-]{16,80}$")
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
MAX_BODY = 128 * 1024


def iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def data_dir() -> Path:
    raw = os.environ.get("IZAKHONO_PAY_DATA_DIR", "").strip()
    p = Path(raw).expanduser() if raw else DEFAULT_DATA_DIR
    p.mkdir(parents=True, exist_ok=True)
    return p


def db_path() -> Path:
    return data_dir() / "izakhono-pay.sqlite3"


def connect(path: Path | None = None) -> sqlite3.Connection:
    c = sqlite3.connect(path or db_path(), timeout=10, isolation_level=None)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA journal_mode=WAL")
    c.execute("PRAGMA foreign_keys=ON")
    c.execute("PRAGMA busy_timeout=10000")
    return c


def init_db(path: Path | None = None) -> None:
    with connect(path) as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS orders(
          order_id TEXT PRIMARY KEY,
          platform TEXT NOT NULL,
          product_code TEXT NOT NULL,
          amount_minor INTEGER NOT NULL,
          currency TEXT NOT NULL,
          customer_email TEXT NOT NULL,
          customer_name TEXT NOT NULL,
          customer_reference TEXT,
          payment_reference TEXT NOT NULL UNIQUE,
          status TEXT NOT NULL CHECK(status IN ('pending','paid','cancelled','failed')),
          created_at TEXT NOT NULL,
          paid_at TEXT,
          bank_reference TEXT,
          callback_delivered_at TEXT
        );
        CREATE INDEX IF NOT EXISTS orders_platform_idx ON orders(platform,created_at);
        CREATE INDEX IF NOT EXISTS orders_reference_idx ON orders(payment_reference,status);
        """)


def load_registry() -> dict:
    value = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    if value.get("schema") != "izakhono.pay.products/v1" or not isinstance(value.get("platforms"), dict):
        raise ValueError("invalid product registry")
    return value["platforms"]


def app_keys() -> dict[str, str]:
    raw = os.environ.get("IZAKHONO_PAY_APPS_JSON", "").strip()
    if not raw:
        return {}
    value = json.loads(raw)
    if not isinstance(value, dict) or not all(isinstance(k,str) and isinstance(v,str) and v for k,v in value.items()):
        raise ValueError("IZAKHONO_PAY_APPS_JSON must map platform slugs to API keys")
    return value


def callback_secrets() -> dict[str, str]:
    raw = os.environ.get("IZAKHONO_PAY_CALLBACK_SECRETS_JSON", "").strip()
    if not raw:
        return {}
    value = json.loads(raw)
    if not isinstance(value, dict):
        raise ValueError("IZAKHONO_PAY_CALLBACK_SECRETS_JSON must be an object")
    return {str(k): str(v) for k,v in value.items() if str(v)}


def callback_urls() -> dict[str, str]:
    raw = os.environ.get("IZAKHONO_PAY_CALLBACK_URLS_JSON", "").strip()
    if not raw:
        return {}
    value = json.loads(raw)
    if not isinstance(value, dict):
        raise ValueError("IZAKHONO_PAY_CALLBACK_URLS_JSON must be an object")
    return {str(k): str(v).strip() for k,v in value.items() if str(v).strip()}


def callback_url_for(platform: str) -> str:
    platform_cfg = load_registry().get(platform)
    if not isinstance(platform_cfg, dict):
        raise ValueError("unknown platform")
    url = callback_urls().get(platform) or str(platform_cfg.get("callback_url") or "").strip()
    if not url:
        return ""
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password:
        raise ValueError("callback URL must be HTTPS")
    return url


def bank_details() -> dict[str, str]:
    fields = {
        "bank_name": os.environ.get("IZAKHONO_PAY_BANK_NAME", "").strip(),
        "account_name": os.environ.get("IZAKHONO_PAY_ACCOUNT_NAME", "").strip(),
        "account_number": os.environ.get("IZAKHONO_PAY_ACCOUNT_NUMBER", "").strip(),
        "account_type": os.environ.get("IZAKHONO_PAY_ACCOUNT_TYPE", "").strip(),
        "branch_code": os.environ.get("IZAKHONO_PAY_BRANCH_CODE", "").strip(),
    }
    if not all(fields.values()):
        raise ValueError("merchant EFT bank details are not configured")
    return fields


def clean_text(value: object, name: str, max_len: int) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{name} must be text")
    out = " ".join(value.strip().split())
    if not out or len(out) > max_len or any(ord(c) < 32 for c in out):
        raise ValueError(f"invalid {name}")
    return out


def clean_email(value: object) -> str:
    out = clean_text(value, "email", 120).lower()
    if not EMAIL_RE.fullmatch(out):
        raise ValueError("invalid email")
    return out


def product_for(platform: str, product_code: str) -> dict:
    registry = load_registry()
    p = registry.get(platform)
    if not isinstance(p, dict):
        raise ValueError("unknown platform")
    product = (p.get("products") or {}).get(product_code)
    if not isinstance(product, dict):
        raise ValueError("unknown product")
    amount = product.get("amount_minor")
    currency = product.get("currency")
    if not isinstance(amount, int) or amount <= 0 or currency != "ZAR":
        raise ValueError("invalid registered product")
    return product


def payment_reference(platform: str) -> str:
    compact = platform.upper().replace("-", "")[:8]
    return f"{compact}-{secrets.token_hex(4).upper()}"


def create_order(platform: str, product_code: str, name: str, email: str, customer_reference: str = "", path: Path | None = None) -> sqlite3.Row:
    if not SLUG_RE.fullmatch(platform) or not CODE_RE.fullmatch(product_code):
        raise ValueError("invalid platform or product code")
    product = product_for(platform, product_code)
    order_id = "izp_" + secrets.token_urlsafe(18)
    reference = payment_reference(platform)
    with connect(path) as c:
        c.execute("INSERT INTO orders(order_id,platform,product_code,amount_minor,currency,customer_email,customer_name,customer_reference,payment_reference,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,'pending',?)",
                  (order_id,platform,product_code,product["amount_minor"],product["currency"],email,name,customer_reference[:100],reference,iso()))
        row = c.execute("SELECT * FROM orders WHERE order_id=?",(order_id,)).fetchone()
    assert row is not None
    return row


def get_order(order_id: str, path: Path | None = None) -> sqlite3.Row | None:
    if not ORDER_RE.fullmatch(order_id):
        return None
    with connect(path) as c:
        return c.execute("SELECT * FROM orders WHERE order_id=?",(order_id,)).fetchone()


def confirm_order(order_id: str, bank_reference: str, path: Path | None = None) -> sqlite3.Row:
    if not ORDER_RE.fullmatch(order_id):
        raise ValueError("invalid order id")
    bank_reference = clean_text(bank_reference, "bank_reference", 120)
    with connect(path) as c:
        c.execute("BEGIN IMMEDIATE")
        try:
            row = c.execute("SELECT * FROM orders WHERE order_id=?",(order_id,)).fetchone()
            if row is None:
                raise ValueError("order not found")
            if row["status"] != "paid":
                c.execute("UPDATE orders SET status='paid',paid_at=?,bank_reference=? WHERE order_id=?",(iso(),bank_reference,order_id))
            row = c.execute("SELECT * FROM orders WHERE order_id=?",(order_id,)).fetchone()
            c.execute("COMMIT")
        except Exception:
            c.execute("ROLLBACK")
            raise
    assert row is not None
    return row


def callback_event_id(order_id: str) -> str:
    digest = hashlib.sha256(f"payment.paid:{order_id}".encode("utf-8")).hexdigest()
    return "evt_" + digest[:40]


def callback_payload(row: sqlite3.Row) -> bytes:
    product = product_for(row["platform"], row["product_code"])
    payload = {
        "event": "payment.paid",
        "event_id": callback_event_id(row["order_id"]),
        "merchant": row["platform"],
        "order": {
            "id": row["order_id"],
            "product_code": row["product_code"],
            "customer_reference": row["customer_reference"],
            "payment_reference": row["payment_reference"],
            "bank_reference": row["bank_reference"],
            "amount_minor": row["amount_minor"],
            "currency": row["currency"],
            "paid_at": row["paid_at"],
            "entitlement": product.get("entitlement") or {},
        }
    }
    return json.dumps(payload,separators=(",",":"),sort_keys=True).encode("utf-8")


def deliver_callback(row: sqlite3.Row, path: Path | None = None) -> bool:
    url = callback_url_for(row["platform"])
    if not url:
        return False
    secret = callback_secrets().get(row["platform"], "")
    if not secret:
        raise ValueError("callback secret is not configured")
    raw = callback_payload(row)
    timestamp = str(int(time.time()))
    signature = hmac.new(secret.encode(), timestamp.encode("ascii") + b"." + raw, hashlib.sha256).hexdigest()
    req = urllib.request.Request(url,data=raw,method="POST",headers={
        "Content-Type":"application/json",
        "User-Agent":"IZAKHONO-PAY/1.0",
        "x-izakhono-timestamp":timestamp,
        "x-izakhono-signature":signature,
        "x-izakhono-event":"payment.paid",
    })
    try:
        with urllib.request.urlopen(req,timeout=12) as response:
            ok = 200 <= response.status < 300
    except (urllib.error.URLError,TimeoutError,OSError):
        ok = False
    if ok:
        with connect(path) as c:
            c.execute("UPDATE orders SET callback_delivered_at=? WHERE order_id=?",(iso(),row["order_id"]))
    return ok


class Handler(BaseHTTPRequestHandler):
    server_version = "IZAKHONOPAY/1.0"

    def send_json(self,status:int,payload:dict) -> None:
        raw=json.dumps(payload,separators=(",",":")).encode()
        self.send_response(status)
        self.send_header("Content-Type","application/json")
        self.send_header("Content-Length",str(len(raw)))
        self.send_header("Cache-Control","no-store")
        self.send_header("X-Content-Type-Options","nosniff")
        self.end_headers(); self.wfile.write(raw)

    def read_json(self) -> dict:
        n=int(self.headers.get("Content-Length","0") or "0")
        if n<=0 or n>MAX_BODY: raise ValueError("invalid request body")
        value=json.loads(self.rfile.read(n).decode())
        if not isinstance(value,dict): raise ValueError("JSON object required")
        return value

    def authenticate(self) -> str:
        platform=self.headers.get("x-izakhono-app","").strip().lower()
        key=self.headers.get("x-izakhono-key","").strip()
        expected=app_keys().get(platform,"")
        if not platform or not expected or not hmac.compare_digest(key,expected):
            raise PermissionError("invalid application credentials")
        return platform

    def do_GET(self):  # noqa: N802
        parsed=urllib.parse.urlsplit(self.path)
        if parsed.path=="/health":
            self.send_json(200,{"ok":True,"service":"izakhono-pay","mode":"shared-group-gateway"}); return
        if parsed.path=="/api/v1/products":
            try:
                platform=self.authenticate(); cfg=load_registry()[platform]
                self.send_json(200,{"ok":True,"platform":platform,"display_name":cfg.get("display_name"),"products":cfg.get("products",{})})
            except PermissionError as exc: self.send_json(401,{"error":str(exc)})
            except (ValueError,KeyError) as exc: self.send_json(400,{"error":str(exc)})
            return
        if parsed.path=="/api/v1/orders/status":
            try:
                platform=self.authenticate(); q=urllib.parse.parse_qs(parsed.query); order_id=(q.get("order") or [""])[0]
                row=get_order(order_id)
                if row is None or row["platform"]!=platform: raise ValueError("order not found")
                self.send_json(200,{"ok":True,"order":{"id":row["order_id"],"status":row["status"],"product_code":row["product_code"],"amount_minor":row["amount_minor"],"currency":row["currency"],"payment_reference":row["payment_reference"]}})
            except PermissionError as exc: self.send_json(401,{"error":str(exc)})
            except ValueError as exc: self.send_json(404,{"error":str(exc)})
            return
        self.send_json(404,{"error":"not found"})

    def do_POST(self):  # noqa: N802
        if urllib.parse.urlsplit(self.path).path!="/api/v1/orders":
            self.send_json(404,{"error":"not found"}); return
        try:
            platform=self.authenticate(); body=self.read_json()
            product_code=clean_text(body.get("product_code"),"product_code",64).lower()
            name=clean_text(body.get("customer_name"),"customer_name",120)
            email=clean_email(body.get("customer_email"))
            ref=str(body.get("customer_reference") or "").strip()[:100]
            row=create_order(platform,product_code,name,email,ref)
            bank=bank_details()
            self.send_json(201,{"ok":True,"order":{"id":row["order_id"],"status":"pending","product_code":row["product_code"],"amount_minor":row["amount_minor"],"currency":row["currency"],"payment_method":"eft","payment_reference":row["payment_reference"],"bank":bank,"instructions":"Pay the exact amount using the unique payment reference. Access/service activation occurs only after bank receipt verification."}})
        except PermissionError as exc: self.send_json(401,{"error":str(exc)})
        except (ValueError,json.JSONDecodeError) as exc: self.send_json(400,{"error":str(exc)})

    def log_message(self,fmt,*args):
        return


def self_test() -> int:
    import tempfile
    with tempfile.TemporaryDirectory(prefix="izakhono-pay-test-") as td:
        path=Path(td)/"test.sqlite3"; init_db(path)
        row=create_order("faisready","re5","Test User","test@example.com","candidate-1",path)
        assert row["amount_minor"]==29900 and row["status"]=="pending"
        paid=confirm_order(row["order_id"],"BANK-SELFTEST",path)
        assert paid["status"]=="paid" and paid["bank_reference"]=="BANK-SELFTEST"
        raw1=callback_payload(paid); raw2=callback_payload(paid); event=json.loads(raw1)
        assert raw1==raw2
        assert event["merchant"]=="faisready" and event["order"]["entitlement"]["days"]==90
        doxa=create_order("doxa-sure","rescue-readiness-pack","Pilot User","pilot@example.com","case-1",path)
        assert doxa["amount_minor"]==19900 and doxa["currency"]=="ZAR"
        assert doxa["payment_reference"].startswith("DOXASURE-")
    print("IZAKHONO PAY shared gateway self-test: PASS")
    return 0


def main() -> int:
    parser=argparse.ArgumentParser(description="IZAKHONO PAY shared group gateway")
    sub=parser.add_subparsers(dest="cmd",required=True)
    serve=sub.add_parser("serve"); serve.add_argument("--host",default="127.0.0.1"); serve.add_argument("--port",type=int,default=18100)
    confirm=sub.add_parser("confirm"); confirm.add_argument("order_id"); confirm.add_argument("--bank-reference",required=True); confirm.add_argument("--no-callback",action="store_true")
    sub.add_parser("self-test")
    args=parser.parse_args()
    if args.cmd=="self-test": return self_test()
    init_db()
    if args.cmd=="confirm":
        row=confirm_order(args.order_id,args.bank_reference)
        delivered=False if args.no_callback else deliver_callback(row)
        print(json.dumps({"ok":True,"order_id":row["order_id"],"status":row["status"],"callback_delivered":delivered},indent=2)); return 0
    if args.host not in {"127.0.0.1","::1","localhost"}: raise SystemExit("shared gateway refuses non-loopback host")
    if not (1024<=args.port<=65535): raise SystemExit("invalid port")
    ThreadingHTTPServer((args.host,args.port),Handler).serve_forever(); return 0

if __name__=="__main__": raise SystemExit(main())