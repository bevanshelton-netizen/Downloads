#!/usr/bin/env python3
"""Automatic bank-credit reconciliation for IZAKHONO PAY.

Consumes normalized settlement events produced by an authorised bank/open-banking
adapter. Customer-uploaded proof of payment is never trusted. A credit is eligible
only when the adapter marks it settled, supplies an immutable provider event ID,
and the event exactly matches a pending IZAKHONO PAY amount + payment reference.

The live-oriented push mode is loopback-only and expects a trusted reverse proxy or
owner-side adapter to POST an HMAC-signed payload to /api/v1/bank-events.
"""
from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
import sqlite3
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import shared_gateway as gateway

MAX_BODY = 256 * 1024
MAX_SIGNATURE_SKEW_SECONDS = 300


def init_reconciliation_db(path: Path | None = None) -> None:
    gateway.init_db(path)
    with gateway.connect(path) as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS bank_feed_events(
          event_id TEXT PRIMARY KEY,
          bank_reference TEXT NOT NULL,
          payment_reference TEXT NOT NULL,
          amount_minor INTEGER NOT NULL,
          currency TEXT NOT NULL,
          settled_at TEXT NOT NULL,
          order_id TEXT,
          outcome TEXT NOT NULL,
          received_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS bank_feed_events_reference_idx
          ON bank_feed_events(payment_reference,received_at);
        """)


def normalize_event(value: object) -> dict:
    if not isinstance(value, dict):
        raise ValueError("bank feed event must be an object")
    event_id = gateway.clean_text(value.get("event_id"), "event_id", 160)
    bank_reference = gateway.clean_text(value.get("bank_reference"), "bank_reference", 160)
    reference = gateway.clean_text(value.get("reference"), "reference", 100).upper()
    settled_at = gateway.clean_text(value.get("settled_at"), "settled_at", 40)
    if value.get("status") != "settled":
        raise ValueError("bank event is not settled")
    if value.get("direction") != "credit":
        raise ValueError("bank event is not an incoming credit")
    if value.get("currency") != "ZAR":
        raise ValueError("bank event currency is not ZAR")
    amount = value.get("amount_minor")
    if not isinstance(amount, int) or amount <= 0:
        raise ValueError("invalid bank event amount")
    return {
        "event_id": event_id,
        "bank_reference": bank_reference,
        "reference": reference,
        "settled_at": settled_at,
        "amount_minor": amount,
        "currency": "ZAR",
    }


def recorded_event(event_id: str, path: Path | None = None) -> sqlite3.Row | None:
    with gateway.connect(path) as c:
        return c.execute("SELECT * FROM bank_feed_events WHERE event_id=?", (event_id,)).fetchone()


def find_matching_order(reference: str, amount_minor: int, path: Path | None = None) -> sqlite3.Row | None:
    with gateway.connect(path) as c:
        rows = c.execute(
            "SELECT * FROM orders WHERE payment_reference=? AND amount_minor=? AND currency='ZAR' AND status='pending'",
            (reference, amount_minor),
        ).fetchall()
    if len(rows) > 1:
        raise ValueError("ambiguous payment reference")
    return rows[0] if rows else None


def record_event(event: dict, *, order_id: str | None, outcome: str, path: Path | None = None) -> None:
    with gateway.connect(path) as c:
        c.execute(
            "INSERT INTO bank_feed_events(event_id,bank_reference,payment_reference,amount_minor,currency,settled_at,order_id,outcome,received_at) VALUES(?,?,?,?,?,?,?,?,?)",
            (event["event_id"], event["bank_reference"], event["reference"], event["amount_minor"], event["currency"], event["settled_at"], order_id, outcome, gateway.iso()),
        )


def try_callback(row: sqlite3.Row | None, path: Path | None = None) -> bool:
    if row is None or row["status"] != "paid" or row["callback_delivered_at"]:
        return bool(row is not None and row["callback_delivered_at"])
    try:
        return gateway.deliver_callback(row, path)
    except ValueError:
        return False


def reconcile_event(value: object, path: Path | None = None, *, deliver: bool = True) -> dict:
    event = normalize_event(value)
    previous = recorded_event(event["event_id"], path)
    if previous is not None:
        callback = False
        if deliver and previous["order_id"]:
            callback = try_callback(gateway.get_order(previous["order_id"], path), path)
        return {
            "event_id": event["event_id"],
            "outcome": "duplicate",
            "activated": False,
            "callback_delivered": callback,
        }
    order = find_matching_order(event["reference"], event["amount_minor"], path)
    if order is None:
        record_event(event, order_id=None, outcome="unmatched", path=path)
        return {"event_id": event["event_id"], "outcome": "unmatched", "activated": False}
    paid = gateway.confirm_order(order["order_id"], event["bank_reference"], path)
    record_event(event, order_id=paid["order_id"], outcome="matched", path=path)
    callback = try_callback(paid, path) if deliver else False
    return {
        "event_id": event["event_id"],
        "outcome": "matched",
        "activated": True,
        "order_id": paid["order_id"],
        "platform": paid["platform"],
        "product_code": paid["product_code"],
        "callback_delivered": callback,
    }


def retry_pending_callbacks(path: Path | None = None, *, limit: int = 100) -> dict:
    with gateway.connect(path) as c:
        rows = c.execute(
            "SELECT * FROM orders WHERE status='paid' AND callback_delivered_at IS NULL ORDER BY paid_at LIMIT ?",
            (max(1, min(limit, 500)),),
        ).fetchall()
    attempted = 0
    delivered = 0
    for row in rows:
        try:
            if not gateway.callback_url_for(row["platform"]):
                continue
            attempted += 1
            if try_callback(row, path):
                delivered += 1
        except ValueError:
            continue
    return {"attempted": attempted, "delivered": delivered}


def load_feed(path: Path) -> list[dict]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(value, dict):
        value = value.get("transactions")
    if not isinstance(value, list):
        raise ValueError("normalized bank feed must be an array or {transactions:[...]}")
    return value


def events_from_payload(value: object) -> list[dict]:
    if isinstance(value, dict) and isinstance(value.get("transactions"), list):
        values = value["transactions"]
    elif isinstance(value, dict):
        values = [value]
    elif isinstance(value, list):
        values = value
    else:
        raise ValueError("bank payload must be an event, array, or {transactions:[...]}")
    if not values or len(values) > 500:
        raise ValueError("bank payload event count is invalid")
    return values


def process_feed(path_in: Path, db: Path | None = None, *, deliver: bool = True) -> list[dict]:
    init_reconciliation_db(db)
    return [reconcile_event(v, db, deliver=deliver) for v in load_feed(path_in)]


def signing_secret() -> str:
    value = os.environ.get("IZAKHONO_PAY_BANK_FEED_SIGNING_SECRET", "").strip()
    if len(value) < 32:
        raise ValueError("bank feed signing secret must be configured with at least 32 characters")
    return value


def verify_push_signature(raw: bytes, timestamp: str, signature: str, secret: str, *, now: int | None = None) -> None:
    try:
        sent = int(timestamp)
    except (TypeError, ValueError) as exc:
        raise PermissionError("invalid bank feed timestamp") from exc
    current = int(time.time()) if now is None else int(now)
    if abs(current - sent) > MAX_SIGNATURE_SKEW_SECONDS:
        raise PermissionError("stale bank feed timestamp")
    expected = hmac.new(secret.encode("utf-8"), timestamp.encode("ascii") + b"." + raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature.strip().lower(), expected):
        raise PermissionError("invalid bank feed signature")


class BankFeedHandler(BaseHTTPRequestHandler):
    server_version = "IZAKHONOPAYBANK/1.0"

    def send_json(self, status: int, payload: dict) -> None:
        raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(raw)

    def read_raw(self) -> bytes:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0 or length > MAX_BODY:
            raise ValueError("invalid request body")
        return self.rfile.read(length)

    def do_GET(self):  # noqa: N802
        if self.path == "/health":
            self.send_json(200, {"ok": True, "service": "izakhono-pay-bank-reconciler", "mode": "signed-push"})
            return
        self.send_json(404, {"error": "not found"})

    def do_POST(self):  # noqa: N802
        if self.path != "/api/v1/bank-events":
            self.send_json(404, {"error": "not found"})
            return
        try:
            raw = self.read_raw()
            verify_push_signature(
                raw,
                self.headers.get("x-izakhono-bank-timestamp", ""),
                self.headers.get("x-izakhono-bank-signature", ""),
                self.server.signing_secret,
            )
            value = json.loads(raw.decode("utf-8"))
            results = [
                reconcile_event(v, self.server.db_path, deliver=self.server.deliver_callbacks)
                for v in events_from_payload(value)
            ]
            self.send_json(200, {"ok": True, "results": results})
        except PermissionError as exc:
            self.send_json(401, {"error": str(exc)})
        except (ValueError, json.JSONDecodeError, UnicodeDecodeError) as exc:
            self.send_json(400, {"error": str(exc)})

    def log_message(self, fmt, *args):
        return


def callback_retry_loop(path: Path | None, interval: int) -> None:
    while True:
        time.sleep(interval)
        try:
            retry_pending_callbacks(path)
        except (OSError, sqlite3.Error, ValueError):
            pass


def serve(host: str, port: int, *, deliver: bool, retry_interval: int) -> int:
    if host not in {"127.0.0.1", "::1", "localhost"}:
        raise SystemExit("bank reconciler refuses non-loopback host")
    if not (1024 <= port <= 65535):
        raise SystemExit("invalid port")
    if retry_interval < 5:
        raise SystemExit("callback retry interval must be at least 5 seconds")
    secret = signing_secret()
    db = gateway.db_path()
    init_reconciliation_db(db)
    server = ThreadingHTTPServer((host, port), BankFeedHandler)
    server.signing_secret = secret
    server.db_path = db
    server.deliver_callbacks = deliver
    if deliver:
        threading.Thread(target=callback_retry_loop, args=(db, retry_interval), daemon=True).start()
    server.serve_forever()
    return 0


def self_test() -> int:
    import tempfile

    with tempfile.TemporaryDirectory(prefix="izp-reconcile-test-") as td:
        db = Path(td) / "test.sqlite3"
        init_reconciliation_db(db)
        order = gateway.create_order("faisready", "re5", "Test User", "test@example.com", "candidate-1", db)
        event = {
            "event_id": "bank_evt_001",
            "status": "settled",
            "direction": "credit",
            "currency": "ZAR",
            "amount_minor": 29900,
            "reference": order["payment_reference"],
            "bank_reference": "FNB-TXN-001",
            "settled_at": "2026-09-02T12:00:00Z",
        }
        result = reconcile_event(event, db, deliver=False)
        assert result["outcome"] == "matched" and result["activated"] is True
        paid = gateway.get_order(order["order_id"], db)
        assert paid is not None and paid["status"] == "paid"
        duplicate = reconcile_event(event, db, deliver=False)
        assert duplicate["outcome"] == "duplicate" and duplicate["activated"] is False
        wrong = dict(event, event_id="bank_evt_002", bank_reference="FNB-TXN-002", amount_minor=30000)
        unmatched = reconcile_event(wrong, db, deliver=False)
        assert unmatched["outcome"] == "unmatched"

        secret = "ci-bank-feed-signing-secret-0123456789"
        raw = json.dumps(event, separators=(",", ":"), sort_keys=True).encode("utf-8")
        ts = "1788331200"
        sig = hmac.new(secret.encode(), ts.encode("ascii") + b"." + raw, hashlib.sha256).hexdigest()
        verify_push_signature(raw, ts, sig, secret, now=1788331200)
        try:
            verify_push_signature(raw, ts, "0" * 64, secret, now=1788331200)
            raise AssertionError("invalid signature was accepted")
        except PermissionError:
            pass
        try:
            verify_push_signature(raw, ts, sig, secret, now=1788331801)
            raise AssertionError("stale timestamp was accepted")
        except PermissionError:
            pass
    print("IZAKHONO PAY bank reconciliation self-test: PASS")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="IZAKHONO PAY normalized bank reconciler")
    sub = parser.add_subparsers(dest="cmd", required=True)
    once = sub.add_parser("feed-file")
    once.add_argument("path")
    once.add_argument("--no-callback", action="store_true")
    watch = sub.add_parser("watch-file")
    watch.add_argument("path")
    watch.add_argument("--interval", type=int, default=60)
    watch.add_argument("--no-callback", action="store_true")
    push = sub.add_parser("serve")
    push.add_argument("--host", default="127.0.0.1")
    push.add_argument("--port", type=int, default=18101)
    push.add_argument("--no-callback", action="store_true")
    push.add_argument("--callback-retry-interval", type=int, default=30)
    sub.add_parser("self-test")
    args = parser.parse_args()
    if args.cmd == "self-test":
        return self_test()
    if args.cmd == "serve":
        return serve(args.host, args.port, deliver=not args.no_callback, retry_interval=args.callback_retry_interval)
    if args.cmd == "feed-file":
        print(json.dumps(process_feed(Path(args.path), deliver=not args.no_callback), indent=2))
        return 0
    if args.interval < 5:
        raise SystemExit("poll interval must be at least 5 seconds")
    while True:
        try:
            results = process_feed(Path(args.path), deliver=not args.no_callback)
            if results:
                print(json.dumps(results, separators=(",", ":")), flush=True)
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            print(json.dumps({"error": str(exc)}), flush=True)
        time.sleep(args.interval)


if __name__ == "__main__":
    raise SystemExit(main())
