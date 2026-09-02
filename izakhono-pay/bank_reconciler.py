#!/usr/bin/env python3
"""Automatic bank-credit reconciliation for IZAKHONO PAY.

Consumes a normalized feed produced by an authorised bank/open-banking adapter.
It never trusts customer-uploaded proof of payment. A credit is eligible only
when the adapter marks it settled and supplies an immutable provider event ID.

Normalized transaction schema:
{
  "event_id": "provider-unique-id",
  "status": "settled",
  "direction": "credit",
  "currency": "ZAR",
  "amount_minor": 29900,
  "reference": "FAISREAD-AB12CD34",
  "bank_reference": "bank-transaction-id",
  "settled_at": "2026-09-02T12:00:00Z"
}
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import time
from pathlib import Path

import shared_gateway as gateway


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


def event_seen(event_id: str, path: Path | None = None) -> bool:
    with gateway.connect(path) as c:
        return c.execute("SELECT 1 FROM bank_feed_events WHERE event_id=?", (event_id,)).fetchone() is not None


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


def reconcile_event(value: object, path: Path | None = None, *, deliver: bool = True) -> dict:
    event = normalize_event(value)
    if event_seen(event["event_id"], path):
        return {"event_id": event["event_id"], "outcome": "duplicate", "activated": False}
    order = find_matching_order(event["reference"], event["amount_minor"], path)
    if order is None:
        record_event(event, order_id=None, outcome="unmatched", path=path)
        return {"event_id": event["event_id"], "outcome": "unmatched", "activated": False}
    paid = gateway.confirm_order(order["order_id"], event["bank_reference"], path)
    record_event(event, order_id=paid["order_id"], outcome="matched", path=path)
    callback = False
    if deliver:
        callback = gateway.deliver_callback(paid, path)
    return {
        "event_id": event["event_id"],
        "outcome": "matched",
        "activated": True,
        "order_id": paid["order_id"],
        "platform": paid["platform"],
        "product_code": paid["product_code"],
        "callback_delivered": callback,
    }


def load_feed(path: Path) -> list[dict]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(value, dict):
        value = value.get("transactions")
    if not isinstance(value, list):
        raise ValueError("normalized bank feed must be an array or {transactions:[...]}")
    return value


def process_feed(path_in: Path, db: Path | None = None, *, deliver: bool = True) -> list[dict]:
    init_reconciliation_db(db)
    return [reconcile_event(v, db, deliver=deliver) for v in load_feed(path_in)]


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
    sub.add_parser("self-test")
    args = parser.parse_args()
    if args.cmd == "self-test":
        return self_test()
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
