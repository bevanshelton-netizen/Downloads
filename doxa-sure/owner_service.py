#!/usr/bin/env python3
"""Owner-controlled DOXA-SURE site and payment-entitlement store."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import sqlite3
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

MAX_BODY = 256 * 1024
MAX_SKEW_SECONDS = 300
EVENT_RE = re.compile(r"evt_[a-f0-9]{40}")
ORDER_RE = re.compile(r"ord_[A-Za-z0-9_-]{12,}")
PAYMENT_RE = re.compile(r"DOXASURE-[0-9A-F]{8}")


def data_path() -> Path:
    root = Path(os.environ.get("DOXA_DATA_DIR", "/var/lib/doxa-sure"))
    root.mkdir(parents=True, exist_ok=True)
    return root / "doxa.sqlite3"


def connect(path: Path | None = None) -> sqlite3.Connection:
    db = sqlite3.connect(path or data_path(), timeout=15)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    db.execute("PRAGMA journal_mode=WAL")
    return db


def init_db(path: Path | None = None) -> None:
    with connect(path) as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS payment_events(
          event_id TEXT PRIMARY KEY, order_id TEXT NOT NULL UNIQUE,
          customer_reference TEXT NOT NULL, payment_reference TEXT NOT NULL UNIQUE,
          bank_reference TEXT NOT NULL, amount_minor INTEGER NOT NULL,
          currency TEXT NOT NULL, paid_at TEXT NOT NULL, payload TEXT NOT NULL,
          received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CHECK(amount_minor=19900), CHECK(currency='ZAR')
        );
        CREATE TABLE IF NOT EXISTS service_entitlements(
          order_id TEXT PRIMARY KEY REFERENCES payment_events(order_id),
          customer_reference TEXT NOT NULL,
          service TEXT NOT NULL CHECK(service='rescue-readiness-pack'),
          status TEXT NOT NULL DEFAULT 'paid_pending_fulfilment'
            CHECK(status IN ('paid_pending_fulfilment','in_fulfilment','fulfilled','refunded','cancelled')),
          activated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          fulfilled_at TEXT
        );
        """)


def verify_signature(raw: bytes, timestamp: str, signature: str, secret: str, now: int | None = None) -> None:
    if not timestamp.isdigit() or len(timestamp) != 10:
        raise PermissionError("invalid timestamp")
    current = int(time.time()) if now is None else now
    if abs(current - int(timestamp)) > MAX_SKEW_SECONDS:
        raise PermissionError("stale timestamp")
    expected = hmac.new(secret.encode(), timestamp.encode("ascii") + b"." + raw, hashlib.sha256).hexdigest()
    if len(secret) < 32 or not hmac.compare_digest(signature.lower(), expected):
        raise PermissionError("invalid signature")


def validate(value: object) -> dict:
    if not isinstance(value, dict) or value.get("event") != "payment.paid" or value.get("merchant") != "doxa-sure":
        raise ValueError("invalid event")
    event_id = str(value.get("event_id", ""))
    order = value.get("order")
    if not EVENT_RE.fullmatch(event_id) or not isinstance(order, dict) or not ORDER_RE.fullmatch(str(order.get("id", ""))):
        raise ValueError("invalid identity")
    if order.get("product_code") != "rescue-readiness-pack" or order.get("amount_minor") != 19900 or order.get("currency") != "ZAR":
        raise ValueError("invalid settlement")
    if not PAYMENT_RE.fullmatch(str(order.get("payment_reference", ""))):
        raise ValueError("invalid payment reference")
    entitlement = order.get("entitlement")
    if entitlement != {"kind": "service", "service": "rescue-readiness-pack"}:
        raise ValueError("invalid entitlement")
    for key in ("customer_reference", "bank_reference", "paid_at"):
        if not str(order.get(key, "")).strip():
            raise ValueError("incomplete order")
    return value


def record(value: dict, path: Path | None = None) -> dict:
    raw = json.dumps(value, separators=(",", ":"), sort_keys=True)
    order = value["order"]
    with connect(path) as db:
        db.execute("BEGIN IMMEDIATE")
        existing = db.execute("SELECT payload FROM payment_events WHERE event_id=?", (value["event_id"],)).fetchone()
        if existing:
            if existing["payload"] != raw:
                raise ValueError("event replay payload mismatch")
            db.commit()
            return {"outcome": "duplicate", "event_id": value["event_id"]}
        db.execute("""INSERT INTO payment_events
          (event_id,order_id,customer_reference,payment_reference,bank_reference,amount_minor,currency,paid_at,payload)
          VALUES(?,?,?,?,?,?,?,?,?)""", (
            value["event_id"], order["id"], order["customer_reference"], order["payment_reference"],
            order["bank_reference"], order["amount_minor"], order["currency"], order["paid_at"], raw))
        db.execute("""INSERT INTO service_entitlements(order_id,customer_reference,service)
          VALUES(?,?,'rescue-readiness-pack')""", (order["id"], order["customer_reference"]))
        db.commit()
    return {"outcome": "created", "event_id": value["event_id"], "order_id": order["id"]}


class Handler(SimpleHTTPRequestHandler):
    server_version = "DOXASURE/1.0"

    def json_response(self, status: int, value: dict) -> None:
        raw = json.dumps(value, separators=(",", ":")).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):  # noqa: N802
        if self.path == "/api/health":
            self.json_response(200, {"ok": True, "service": "doxa-sure", "payments_enabled": False})
            return
        super().do_GET()

    def do_POST(self):  # noqa: N802
        if self.path != "/api/v1/izakhono-pay/callback":
            self.json_response(404, {"error": "not found"}); return
        if os.environ.get("DOXA_PAYMENT_CALLBACK_ENABLED") != "true":
            self.json_response(503, {"error": "payment callback disabled"}); return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 1 or length > MAX_BODY:
                raise ValueError("invalid body")
            raw = self.rfile.read(length)
            secret = os.environ.get("DOXA_IZAKHONO_PAY_CALLBACK_SECRET", "")
            verify_signature(raw, self.headers.get("x-izakhono-timestamp", ""), self.headers.get("x-izakhono-signature", ""), secret)
            result = record(validate(json.loads(raw)))
            self.json_response(200, {"ok": True, "result": result})
        except PermissionError as exc:
            self.json_response(401, {"error": str(exc)})
        except (ValueError, json.JSONDecodeError, sqlite3.Error) as exc:
            self.json_response(400, {"error": str(exc)})

    def log_message(self, fmt, *args):
        return


def main() -> int:
    host = os.environ.get("DOXA_HOST", "127.0.0.1")
    port = int(os.environ.get("DOXA_PORT", "8080"))
    if not (1024 <= port <= 65535):
        raise SystemExit("invalid port")
    init_db()
    ThreadingHTTPServer((host, port), Handler).serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
