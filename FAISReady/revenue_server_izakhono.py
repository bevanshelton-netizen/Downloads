#!/usr/bin/env python3
"""FAISReady revenue server with an optional IZAKHONO PAY orchestration layer.

The existing local SQLite order and entitlement ledger remains authoritative.
When FAISREADY_PAYMENT_ORCHESTRATOR=izakhono, FAISReady can use the native
IZAKHONO PAY order contract for exact-reference EFT plus automatic bank
reconciliation, while retaining the legacy hosted-intent contract as an
explicit rollback path.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import sqlite3
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

import revenue_server as base

SAFE_EVENT_RE = re.compile(r"^evt_[A-Za-z0-9_-]{8,120}$")
GATEWAY_ORDER_RE = re.compile(r"^izp_[A-Za-z0-9_-]{16,80}$")


def use_izakhono_pay() -> bool:
    return os.environ.get("FAISREADY_PAYMENT_ORCHESTRATOR", "direct").strip().lower() == "izakhono"


def izakhono_contract() -> str:
    value = os.environ.get("IZAKHONO_PAY_CONTRACT", "orders").strip().lower()
    if value not in {"orders", "intent"}:
        raise ValueError("IZAKHONO_PAY_CONTRACT must be orders or intent")
    return value


def izakhono_settings() -> dict[str, str]:
    url = os.environ.get("IZAKHONO_PAY_URL", "").strip().rstrip("/")
    key = os.environ.get("IZAKHONO_PAY_API_KEY", "").strip()
    secret = os.environ.get("IZAKHONO_PAY_WEBHOOK_SECRET", "").strip()
    if not url or not key or not secret:
        raise ValueError("IZAKHONO PAY is not configured")
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("IZAKHONO_PAY_URL must be a clean HTTPS origin")
    return {"url": url, "key": key, "secret": secret, "contract": izakhono_contract()}


def init_izakhono_db(path: Path | None = None) -> None:
    base.init_db(path)
    with base.DB_LOCK, base.connect_db(path) as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS izakhono_payment_events (
                event_id TEXT PRIMARY KEY,
                order_id TEXT NOT NULL,
                intent_id TEXT NOT NULL,
                provider_reference TEXT NOT NULL,
                payload_sha256 TEXT NOT NULL,
                accepted INTEGER NOT NULL DEFAULT 0,
                received_at TEXT NOT NULL,
                FOREIGN KEY(order_id) REFERENCES orders(order_id)
            );
            CREATE INDEX IF NOT EXISTS izakhono_payment_events_order_idx
                ON izakhono_payment_events(order_id, received_at);
            """
        )


def build_izakhono_checkout(order: sqlite3.Row) -> tuple[str, dict[str, str], bool]:
    cfg = izakhono_settings()
    public = base.public_base_url()
    return_url = f"{public}/payment/return?order={urllib.parse.quote(order['order_id'])}"
    cancel_url = f"{public}/payment/cancel?order={urllib.parse.quote(order['order_id'])}"
    payload = {
        "amount_minor": int(round(float(order["amount"]) * 100)),
        "currency": "ZAR",
        "email": order["email"],
        "description": f"FAISReady: {base.PLANS[order['plan']]['label']}",
        # First migration deliberately keeps the proven PayFast settlement rail.
        "provider": "payfast",
        "return_url": return_url,
        "cancel_url": cancel_url,
        "metadata": {
            "kind": "course_access",
            "order_id": order["order_id"],
            "plan": order["plan"],
        },
    }
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    req = urllib.request.Request(
        f"{cfg['url']}/api/v1/intents",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "FAISReady-IZAKHONO-PAY/0.1",
            "x-izakhono-key": cfg["key"],
            "x-izakhono-app": "faisready",
            "idempotency-key": f"faisready:order:{order['order_id']}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            result = json.loads(response.read(base.MAX_BODY).decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise ValueError("IZAKHONO PAY checkout is temporarily unavailable") from exc

    intent = result.get("intent") if isinstance(result, dict) and result.get("ok") else None
    if not isinstance(intent, dict):
        raise ValueError("IZAKHONO PAY returned an invalid checkout response")
    if intent.get("routed_provider") != "payfast" or intent.get("checkout_method") != "form_post":
        raise ValueError("IZAKHONO PAY returned an unsupported FAISReady checkout method")
    checkout_url = str(intent.get("checkout_url") or "")
    fields = intent.get("form_fields")
    parsed = urllib.parse.urlsplit(checkout_url)
    if parsed.scheme != "https" or parsed.hostname not in {"www.payfast.co.za", "sandbox.payfast.co.za"}:
        raise ValueError("IZAKHONO PAY returned an unsafe checkout URL")
    sandbox = parsed.hostname == "sandbox.payfast.co.za"
    if not sandbox and not base.env_bool("FAISREADY_IZAKHONO_PAY_LIVE_APPROVED", False):
        raise ValueError("IZAKHONO PAY live FAISReady payments are not approved")
    if not isinstance(fields, dict) or not all(isinstance(k, str) and isinstance(v, str) for k, v in fields.items()):
        raise ValueError("IZAKHONO PAY checkout form is invalid")
    return checkout_url, fields, sandbox


def build_izakhono_order(order: sqlite3.Row) -> dict:
    cfg = izakhono_settings()
    payload = {
        "product_code": order["plan"],
        "customer_name": f"{order['name_first']} {order['name_last']}".strip(),
        "customer_email": order["email"],
        "customer_reference": order["order_id"],
    }
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    req = urllib.request.Request(
        f"{cfg['url']}/api/v1/orders",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "FAISReady-IZAKHONO-PAY/0.2",
            "x-izakhono-key": cfg["key"],
            "x-izakhono-app": "faisready",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            result = json.loads(response.read(base.MAX_BODY).decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise ValueError("IZAKHONO PAY order service is temporarily unavailable") from exc

    remote = result.get("order") if isinstance(result, dict) and result.get("ok") else None
    if not isinstance(remote, dict):
        raise ValueError("IZAKHONO PAY returned an invalid order response")
    gateway_order_id = str(remote.get("id") or "")
    if not GATEWAY_ORDER_RE.fullmatch(gateway_order_id):
        raise ValueError("IZAKHONO PAY returned an invalid gateway order")
    if remote.get("status") != "pending" or remote.get("payment_method") != "eft":
        raise ValueError("IZAKHONO PAY returned an unsupported payment method")
    if remote.get("product_code") != order["plan"] or remote.get("currency") != "ZAR":
        raise ValueError("IZAKHONO PAY returned the wrong FAISReady product")
    expected_amount = int(round(float(order["amount"]) * 100))
    if remote.get("amount_minor") != expected_amount:
        raise ValueError("IZAKHONO PAY returned a mismatched FAISReady amount")
    reference = str(remote.get("payment_reference") or "").strip()
    bank = remote.get("bank")
    if not reference or not isinstance(bank, dict):
        raise ValueError("IZAKHONO PAY returned incomplete EFT instructions")
    required_bank = ("bank_name", "account_name", "account_number", "account_type", "branch_code")
    if not all(isinstance(bank.get(key), str) and bank.get(key).strip() for key in required_bank):
        raise ValueError("IZAKHONO PAY returned incomplete bank details")
    return remote


def event_already_seen(event_id: str, payload_hash: str, path: Path | None = None) -> bool:
    with base.DB_LOCK, base.connect_db(path) as conn:
        row = conn.execute(
            "SELECT payload_sha256,accepted FROM izakhono_payment_events WHERE event_id=?",
            (event_id,),
        ).fetchone()
    if row is None:
        return False
    if not hmac.compare_digest(str(row["payload_sha256"]), payload_hash):
        raise ValueError("event replay payload mismatch")
    return bool(row["accepted"])


def record_izakhono_event(
    *, event_id: str, order_id: str, intent_id: str, provider_reference: str,
    payload_hash: str, accepted: bool, path: Path | None = None,
) -> None:
    with base.DB_LOCK, base.connect_db(path) as conn:
        conn.execute(
            """
            INSERT INTO izakhono_payment_events(
                event_id,order_id,intent_id,provider_reference,payload_sha256,accepted,received_at
            ) VALUES(?,?,?,?,?,?,?)
            ON CONFLICT(event_id) DO UPDATE SET accepted=MAX(accepted,excluded.accepted)
            """,
            (event_id, order_id, intent_id, provider_reference, payload_hash, int(accepted), base.iso()),
        )


def verify_izakhono_event(handler: base.BaseHTTPRequestHandler, raw: bytes) -> tuple[dict, str]:
    cfg = izakhono_settings()
    timestamp = handler.headers.get("x-izakhono-timestamp", "").strip()
    signature = handler.headers.get("x-izakhono-signature", "").strip().lower()
    event_name = handler.headers.get("x-izakhono-event", "").strip()
    event_header_id = handler.headers.get("x-izakhono-event-id", "").strip()
    try:
        unix = int(timestamp)
    except ValueError as exc:
        raise ValueError("invalid IZAKHONO timestamp") from exc
    if abs(int(time.time()) - unix) > 300:
        raise ValueError("stale IZAKHONO webhook")
    expected = hmac.new(cfg["secret"].encode("utf-8"), timestamp.encode("ascii") + b"." + raw, hashlib.sha256).hexdigest()
    if not signature or not hmac.compare_digest(signature, expected):
        raise ValueError("invalid IZAKHONO webhook signature")
    if event_name != "payment.paid":
        raise ValueError("unsupported IZAKHONO event")
    payload = json.loads(raw.decode("utf-8"))
    if not isinstance(payload, dict) or payload.get("event") != "payment.paid" or payload.get("merchant") != "faisready":
        raise ValueError("invalid IZAKHONO event payload")
    event_id = str(payload.get("event_id") or "")
    if event_id != event_header_id or not SAFE_EVENT_RE.fullmatch(event_id):
        raise ValueError("invalid IZAKHONO event id")
    return payload, hashlib.sha256(raw).hexdigest()


def accept_izakhono_paid_event(payload: dict, payload_hash: str, path: Path | None = None) -> str:
    event_id = str(payload["event_id"])
    native_order = payload.get("order")
    if isinstance(native_order, dict):
        gateway_order_id = str(native_order.get("id") or "")
        order_id = str(native_order.get("customer_reference") or "")
        plan = str(native_order.get("product_code") or "")
        provider_reference = str(native_order.get("bank_reference") or "")[:100]
        if not GATEWAY_ORDER_RE.fullmatch(gateway_order_id):
            raise ValueError("invalid IZAKHONO gateway order")
        if native_order.get("currency") != "ZAR" or not native_order.get("paid_at"):
            raise ValueError("native IZAKHONO order is not paid")
        order = base.get_order(order_id, path)
        if order is None or order["plan"] != plan:
            raise ValueError("unknown FAISReady order")
        amount_minor = native_order.get("amount_minor")
        if not isinstance(amount_minor, int) or amount_minor != int(round(float(order["amount"]) * 100)):
            raise ValueError("FAISReady payment amount mismatch")
        if not provider_reference:
            raise ValueError("incomplete IZAKHONO bank settlement")
        remote_id = gateway_order_id
    else:
        intent = payload.get("intent")
        if not isinstance(intent, dict) or intent.get("status") != "paid":
            raise ValueError("payment is not marked paid")
        if intent.get("currency") != "ZAR" or intent.get("provider") != "payfast":
            raise ValueError("unsupported FAISReady settlement")
        metadata = intent.get("metadata")
        if not isinstance(metadata, dict) or metadata.get("kind") != "course_access":
            raise ValueError("invalid FAISReady payment metadata")
        order_id = str(metadata.get("order_id") or "")
        plan = str(metadata.get("plan") or "")
        order = base.get_order(order_id, path)
        if order is None or order["plan"] != plan:
            raise ValueError("unknown FAISReady order")
        amount_minor = intent.get("amount_minor")
        if not isinstance(amount_minor, int) or amount_minor != int(round(float(order["amount"]) * 100)):
            raise ValueError("FAISReady payment amount mismatch")
        remote_id = str(intent.get("id") or "")
        provider_reference = str(intent.get("provider_reference") or "")[:100]
        if not remote_id or not provider_reference:
            raise ValueError("incomplete IZAKHONO payment event")

    if event_already_seen(event_id, payload_hash, path):
        return order_id
    record_izakhono_event(
        event_id=event_id,
        order_id=order_id,
        intent_id=remote_id,
        provider_reference=provider_reference,
        payload_hash=payload_hash,
        accepted=False,
        path=path,
    )
    base.grant_entitlement(order_id, provider_reference, path)
    record_izakhono_event(
        event_id=event_id,
        order_id=order_id,
        intent_id=remote_id,
        provider_reference=provider_reference,
        payload_hash=payload_hash,
        accepted=True,
        path=path,
    )
    return order_id


class IzakhonoRevenueHandler(base.RevenueHandler):
    server_version = "FAISReadyRevenue/1.2"

    def do_GET(self) -> None:  # noqa: N802
        path, _ = self.route()
        if path == "/api/config" and use_izakhono_pay():
            ready = True
            contract = "orders"
            try:
                cfg = izakhono_settings()
                contract = cfg["contract"]
            except ValueError:
                ready = False
            self.send_json(
                200,
                {
                    "payments_configured": ready,
                    "payment_orchestrator": "izakhono",
                    "payment_contract": contract,
                    "payment_method": "eft" if contract == "orders" else "form_post",
                    "payfast_sandbox": False,
                    "plans": {
                        k: {"label": v["label"], "amount": v["amount"], "days": v["days"]}
                        for k, v in base.PLANS.items()
                    },
                },
            )
            return
        super().do_GET()

    def do_POST(self) -> None:  # noqa: N802
        path, _ = self.route()
        if path == "/api/izakhono-pay/webhook":
            if not use_izakhono_pay():
                self.send_json(404, {"error": "not found"})
                return
            try:
                raw = self.read_body()
                payload, payload_hash = verify_izakhono_event(self, raw)
                accept_izakhono_paid_event(payload, payload_hash)
                self.send_bytes(200, b"OK\n", "text/plain; charset=utf-8")
            except (ValueError, json.JSONDecodeError, UnicodeDecodeError) as exc:
                self.send_json(400, {"error": str(exc)})
            return

        if path == "/api/checkout" and use_izakhono_pay():
            try:
                raw = self.read_body()
                if self.headers.get_content_type() != "application/json":
                    raise ValueError("checkout requires application/json")
                payload = json.loads(raw.decode("utf-8"))
                if not isinstance(payload, dict):
                    raise ValueError("invalid checkout request")
                plan = base.clean_text(payload.get("plan"), "plan", 20).lower()
                first = base.clean_text(payload.get("first_name"), "first_name", 50)
                last = base.clean_text(payload.get("last_name"), "last_name", 50)
                email_value = base.clean_email(payload.get("email"))
                if plan not in base.PLANS:
                    raise ValueError("unknown plan")
                cfg = izakhono_settings()
                order = base.create_order(plan, first, last, email_value)
                if cfg["contract"] == "orders":
                    remote = build_izakhono_order(order)
                    self.send_json(
                        201,
                        {
                            "order": order["order_id"],
                            "gateway_order": remote["id"],
                            "payment_method": "eft",
                            "payment_reference": remote["payment_reference"],
                            "amount_minor": remote["amount_minor"],
                            "currency": remote["currency"],
                            "bank": remote["bank"],
                            "instructions": remote.get("instructions") or "Pay the exact amount using the unique reference. Access activates automatically after bank settlement is reconciled.",
                        },
                    )
                else:
                    action, fields, sandbox = build_izakhono_checkout(order)
                    self.send_json(
                        201,
                        {
                            "order": order["order_id"],
                            "payment_method": "form_post",
                            "payment_url": action,
                            "fields": fields,
                            "sandbox": sandbox,
                        },
                    )
            except (ValueError, json.JSONDecodeError, UnicodeDecodeError) as exc:
                self.send_json(400, {"error": str(exc)})
            return

        super().do_POST()


def self_test() -> int:
    with base.tempfile.TemporaryDirectory(prefix="faisready-izakhono-test-") as tmp:
        path = Path(tmp) / "test.sqlite3"
        init_izakhono_db(path)
        order = base.create_order("re5", "Test", "Learner", "test@example.com", path)
        assert order["status"] == "pending"
        payload = {
            "event": "payment.paid",
            "event_id": "evt_payment_paid_selftest",
            "merchant": "faisready",
            "order": {
                "id": "izp_0123456789abcdef",
                "product_code": "re5",
                "customer_reference": order["order_id"],
                "payment_reference": "FAISREAD-ABCDEF12",
                "bank_reference": "BANK-SELFTEST",
                "amount_minor": 29900,
                "currency": "ZAR",
                "paid_at": "2026-09-12T19:00:00Z",
                "entitlement": {"days": 90},
            },
        }
        raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
        payload_hash = hashlib.sha256(raw).hexdigest()
        accepted = accept_izakhono_paid_event(payload, payload_hash, path)
        assert accepted == order["order_id"]
        paid = base.get_order(order["order_id"], path)
        assert paid is not None and paid["status"] == "paid" and paid["access_token"]
        assert event_already_seen("evt_payment_paid_selftest", payload_hash, path)
        replay = accept_izakhono_paid_event(payload, payload_hash, path)
        assert replay == order["order_id"]
    print("FAISReady IZAKHONO PAY wrapper self-test: PASS")
    return 0


def run_server() -> int:
    init_izakhono_db()
    host = os.environ.get("HOST", "127.0.0.1").strip()
    port = int(os.environ.get("PORT", "18091"))
    container_runtime = os.environ.get("IZAKHONO_CONTAINER_RUNTIME", "").strip().lower() in {"1", "true", "yes", "on"}
    allowed_hosts = {"127.0.0.1", "::1", "localhost"}
    if container_runtime:
        allowed_hosts.add("0.0.0.0")
    if host not in allowed_hosts:
        raise SystemExit("FAISReady revenue server refuses this HOST outside explicit IZAKHONO container runtime")
    if not (1024 <= port <= 65535):
        raise SystemExit("PORT must be between 1024 and 65535")
    server = ThreadingHTTPServer((host, port), IzakhonoRevenueHandler)
    print(f"FAISReady revenue server listening on http://{host}:{port}")
    print(f"payment_orchestrator={'izakhono' if use_izakhono_pay() else 'direct'}")
    try:
        server.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


def main() -> int:
    import argparse
    parser = argparse.ArgumentParser(description="FAISReady IZAKHONO PAY revenue server")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        return self_test()
    return run_server()


if __name__ == "__main__":
    raise SystemExit(main())
