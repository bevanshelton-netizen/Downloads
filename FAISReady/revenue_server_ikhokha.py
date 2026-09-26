#!/usr/bin/env python3
"""FAISReady direct iKhokha payment adapter.

This keeps FAISReady's existing SQLite order/entitlement ledger authoritative
while using iKhokha iK Pay API for live payment-link creation and signed
webhook confirmation.

Security properties:
- API credentials live only in the owner-host environment.
- outbound iKhokha requests are HMAC-SHA256 signed.
- checkout links are accepted only from approved iKhokha HTTPS hosts.
- the callback is treated only as a trigger, never as proof of payment.
- every successful trigger is confirmed against iKhokha's signed status API.
- entitlement is granted only when the independently queried status is PAID
  and the amount matches the server-side order.
"""
from __future__ import annotations

import argparse
import hashlib
import hmac
import html
import json
import os
import re
import sqlite3
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from http.server import ThreadingHTTPServer
from pathlib import Path

import revenue_server as base

API_ORIGIN = "https://api.ikhokha.com"
CREATE_PATH = "/public-api/v1/api/payment"
STATUS_PREFIX = "/public-api/v1/api/getStatus/"
PAYLINK_RE = re.compile(r"^[A-Za-z0-9_-]{4,160}$")
APPID_RE = re.compile(r"^[A-Za-z0-9_-]{4,200}$")
ALLOWED_PAYLINK_SUFFIXES = (".ikhokha.red", ".ikhokha.com")


def amount_cents(value: str) -> int:
    try:
        dec = Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except InvalidOperation as exc:
        raise ValueError("invalid payment amount") from exc
    return int(dec * 100)


def payment_provider() -> str:
    return "ikhokha"


def ikhokha_settings(*, require_approval: bool = False) -> dict[str, object]:
    app_id = os.environ.get("IKHOKHA_APP_ID", "").strip()
    secret = (os.environ.get("IKHOKHA_APP_KEY", "").strip() or os.environ.get("IKHOKHA_APP_SECRET", "").strip())
    approved = base.env_bool("IKHOKHA_LIVE_APPROVED", False)
    if app_id and not APPID_RE.fullmatch(app_id):
        raise ValueError("IKHOKHA_APP_ID contains unsupported characters")
    try:
        public = base.public_base_url()
    except ValueError:
        public = None
    configured = bool(app_id and secret and public)
    ready = bool(configured and approved)
    if require_approval and not ready:
        raise ValueError("iKhokha live checkout is not approved on this host")
    return {
        "app_id": app_id,
        "secret": secret,
        "public_base_url": public,
        "configured": configured,
        "live_approved": approved,
        "ready": ready,
        "mode": "live",
    }


def js_string_escape(value: str) -> str:
    # Matches the escaping used by iKhokha's official JavaScript examples.
    out: list[str] = []
    for char in value:
        if char in {'\\', '"', "'"}:
            out.append("\\" + char)
        elif char == "\x00":
            out.append("\\0")
        else:
            out.append(char)
    return "".join(out)


def sign_payload(path: str, body: str, secret: str) -> str:
    payload = js_string_escape(path + body)
    return hmac.new(secret.strip().encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()


def api_headers(path: str, body: str, cfg: dict[str, object]) -> dict[str, str]:
    app_id = str(cfg["app_id"])
    secret = str(cfg["secret"])
    return {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "IK-APPID": app_id,
        "IK-SIGN": sign_payload(path, body, secret),
        "User-Agent": "FAISReady-IZAKHONO-iKhokha/1.0",
    }


def safe_paylink_url(value: object) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError("iKhokha did not return a payment URL")
    value = value.strip()
    parsed = urllib.parse.urlsplit(value)
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or not host or parsed.username or parsed.password:
        raise ValueError("iKhokha returned an unsafe payment URL")
    if not any(host == suffix[1:] or host.endswith(suffix) for suffix in ALLOWED_PAYLINK_SUFFIXES):
        raise ValueError("iKhokha returned an unapproved payment host")
    return value


def init_ikhokha_db(path: Path | None = None) -> None:
    base.init_db(path)
    with base.DB_LOCK, base.connect_db(path) as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS ikhokha_payment_links (
                order_id TEXT PRIMARY KEY,
                paylink_id TEXT NOT NULL UNIQUE,
                external_transaction_id TEXT NOT NULL UNIQUE,
                amount_cents INTEGER NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(order_id) REFERENCES orders(order_id)
            );

            CREATE TABLE IF NOT EXISTS ikhokha_payment_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id TEXT,
                paylink_id TEXT,
                webhook_status TEXT,
                response_code TEXT,
                app_id_valid INTEGER NOT NULL,
                signature_valid INTEGER NOT NULL,
                mapping_valid INTEGER NOT NULL,
                remote_status_valid INTEGER NOT NULL,
                amount_valid INTEGER NOT NULL,
                accepted INTEGER NOT NULL,
                payload_sha256 TEXT NOT NULL,
                received_at TEXT NOT NULL,
                FOREIGN KEY(order_id) REFERENCES orders(order_id)
            );

            CREATE INDEX IF NOT EXISTS ikhokha_events_order_idx
                ON ikhokha_payment_events(order_id, received_at);
            """
        )


def create_payment_payload(order: sqlite3.Row, cfg: dict[str, object]) -> dict[str, object]:
    public = str(cfg["public_base_url"])
    order_id = str(order["order_id"])
    quoted = urllib.parse.quote(order_id)
    return {
        "entityID": str(cfg["app_id"]),
        "externalEntityID": "faisready",
        "amount": amount_cents(str(order["amount"])),
        "currency": "ZAR",
        "requesterUrl": public + "/",
        "mode": "live",
        "description": f"FAISReady: {base.PLANS[order['plan']]['label']}",
        "paymentReference": order_id,
        "externalTransactionID": order_id,
        "urls": {
            "callbackUrl": public + "/api/ikhokha/webhook",
            "successPageUrl": public + f"/payment/return?order={quoted}",
            "failurePageUrl": public + f"/payment/failed?order={quoted}",
            "cancelUrl": public + f"/payment/cancel?order={quoted}",
        },
    }


def record_payment_link(order: sqlite3.Row, result: dict[str, object], path: Path | None = None) -> tuple[str, str]:
    paylink_id = str(result.get("paylinkID") or "").strip()
    external = str(result.get("externalTransactionID") or "").strip()
    if not PAYLINK_RE.fullmatch(paylink_id):
        raise ValueError("iKhokha returned an invalid payment-link identifier")
    if external != order["order_id"]:
        raise ValueError("iKhokha transaction reference does not match the FAISReady order")
    pay_url = safe_paylink_url(result.get("paylinkUrl"))
    cents = amount_cents(str(order["amount"]))
    now = base.iso()
    with base.DB_LOCK, base.connect_db(path) as conn:
        conn.execute(
            """
            INSERT INTO ikhokha_payment_links(
                order_id,paylink_id,external_transaction_id,amount_cents,status,created_at,updated_at
            ) VALUES(?,?,?,?,?,?,?)
            ON CONFLICT(order_id) DO UPDATE SET
                paylink_id=excluded.paylink_id,
                external_transaction_id=excluded.external_transaction_id,
                amount_cents=excluded.amount_cents,
                status=excluded.status,
                updated_at=excluded.updated_at
            """,
            (order["order_id"], paylink_id, external, cents, "CREATED", now, now),
        )
    return pay_url, paylink_id


def create_paylink(order: sqlite3.Row) -> tuple[str, str]:
    cfg = ikhokha_settings(require_approval=True)
    payload = create_payment_payload(order, cfg)
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    req = urllib.request.Request(
        API_ORIGIN + CREATE_PATH,
        data=body.encode("utf-8"),
        headers=api_headers(CREATE_PATH, body, cfg),
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            raw = response.read(base.MAX_BODY)
    except urllib.error.HTTPError as exc:
        raise ValueError(f"iKhokha checkout request was rejected ({exc.code})") from exc
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise ValueError("iKhokha checkout is temporarily unavailable") from exc
    try:
        result = json.loads(raw.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise ValueError("iKhokha returned an invalid checkout response") from exc
    if not isinstance(result, dict) or str(result.get("responseCode") or "") != "00":
        raise ValueError("iKhokha did not approve creation of the payment link")
    return record_payment_link(order, result)


def find_payment_link(
    *,
    order_id: str | None = None,
    paylink_id: str | None = None,
    path: Path | None = None,
) -> sqlite3.Row | None:
    if not order_id and not paylink_id:
        return None
    with base.DB_LOCK, base.connect_db(path) as conn:
        if order_id:
            return conn.execute(
                "SELECT * FROM ikhokha_payment_links WHERE order_id=?",
                (order_id,),
            ).fetchone()
        return conn.execute(
            "SELECT * FROM ikhokha_payment_links WHERE paylink_id=?",
            (paylink_id,),
        ).fetchone()


def get_remote_status(paylink_id: str) -> dict[str, object]:
    if not PAYLINK_RE.fullmatch(paylink_id):
        raise ValueError("invalid iKhokha paylink id")
    cfg = ikhokha_settings(require_approval=True)
    path = STATUS_PREFIX + urllib.parse.quote(paylink_id, safe="")
    req = urllib.request.Request(
        API_ORIGIN + path,
        headers=api_headers(path, "", cfg),
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            raw = response.read(base.MAX_BODY)
    except urllib.error.HTTPError as exc:
        raise ValueError(f"iKhokha status verification was rejected ({exc.code})") from exc
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise ValueError("iKhokha status verification is unavailable") from exc
    try:
        result = json.loads(raw.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise ValueError("iKhokha returned an invalid status response") from exc
    if not isinstance(result, dict):
        raise ValueError("iKhokha returned an invalid status response")
    return result


def parse_webhook_trigger(handler: base.BaseHTTPRequestHandler, raw: bytes) -> tuple[dict[str, object], bool, bool]:
    """Parse a callback as a trigger only.

    The public callback is not trusted to grant access. We record whether the
    expected iKhokha headers were present/matched for audit, but the signed
    server-to-server status lookup remains the payment authority.
    """
    cfg = ikhokha_settings(require_approval=True)
    app_id = handler.headers.get("ik-appid", "").strip()
    signature = handler.headers.get("ik-sign", "").strip()
    app_ok = bool(app_id) and hmac.compare_digest(app_id, str(cfg["app_id"]))
    signature_present = bool(signature)
    try:
        payload = json.loads(raw.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise ValueError("invalid iKhokha webhook JSON") from exc
    if not isinstance(payload, dict):
        raise ValueError("invalid iKhokha webhook payload")
    return payload, app_ok, signature_present


def validate_remote_paid(
    order: sqlite3.Row,
    link: sqlite3.Row,
    remote: dict[str, object],
) -> tuple[bool, bool]:
    status_ok = (
        str(remote.get("status") or "").upper() == "PAID"
        and str(remote.get("paylinkID") or "") == str(link["paylink_id"])
    )
    try:
        remote_amount = int(remote.get("amount"))
    except (TypeError, ValueError):
        remote_amount = -1
    amount_ok = remote_amount == int(link["amount_cents"]) == amount_cents(str(order["amount"]))
    return status_ok, amount_ok


def record_event(
    *,
    order_id: str | None,
    paylink_id: str,
    webhook_status: str,
    response_code: str,
    app_ok: bool,
    sig_ok: bool,
    mapping_ok: bool,
    remote_ok: bool,
    amount_ok: bool,
    accepted: bool,
    payload_hash: str,
    path: Path | None = None,
) -> None:
    with base.DB_LOCK, base.connect_db(path) as conn:
        conn.execute(
            """
            INSERT INTO ikhokha_payment_events(
                order_id,paylink_id,webhook_status,response_code,
                app_id_valid,signature_valid,mapping_valid,remote_status_valid,
                amount_valid,accepted,payload_sha256,received_at
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                order_id,
                paylink_id[:160],
                webhook_status[:40],
                response_code[:40],
                int(app_ok),
                int(sig_ok),
                int(mapping_ok),
                int(remote_ok),
                int(amount_ok),
                int(accepted),
                payload_hash,
                base.iso(),
            ),
        )


def mark_link_paid(order_id: str, paylink_id: str) -> None:
    with base.DB_LOCK, base.connect_db() as conn:
        conn.execute(
            "UPDATE ikhokha_payment_links SET status='PAID',updated_at=? WHERE order_id=? AND paylink_id=?",
            (base.iso(), order_id, paylink_id),
        )


def accept_webhook(handler: base.BaseHTTPRequestHandler, raw: bytes) -> str:
    payload, app_ok, sig_present = parse_webhook_trigger(handler, raw)
    paylink_id = str(payload.get("paylinkID") or "").strip()
    webhook_status = str(payload.get("status") or "").strip().upper()
    external = str(payload.get("externalTransactionID") or "").strip()
    response_code = str(payload.get("responseCode") or "").strip()
    order = base.get_order(external)
    link = find_payment_link(order_id=external) if order is not None else None
    mapping_ok = bool(
        order is not None
        and link is not None
        and PAYLINK_RE.fullmatch(paylink_id)
        and str(link["paylink_id"]) == paylink_id
        and str(link["external_transaction_id"]) == external
    )

    remote_ok = False
    amount_ok = False
    if mapping_ok:
        remote = get_remote_status(paylink_id)
        assert order is not None and link is not None
        remote_ok, amount_ok = validate_remote_paid(order, link, remote)

    # The callback itself is only a wake-up signal. Access depends solely on a
    # known server-side order/paylink mapping plus iKhokha's signed GET status
    # returning PAID for the exact amount.
    accepted = bool(mapping_ok and remote_ok and amount_ok)
    record_event(
        order_id=external if order is not None else None,
        paylink_id=paylink_id,
        webhook_status=webhook_status,
        response_code=response_code,
        app_ok=app_ok,
        sig_ok=sig_present,
        mapping_ok=mapping_ok,
        remote_ok=remote_ok,
        amount_ok=amount_ok,
        accepted=accepted,
        payload_hash=hashlib.sha256(raw).hexdigest(),
    )
    if not accepted:
        raise ValueError("iKhokha payment verification failed")
    # base.grant_entitlement is idempotent. During bootstrap the legacy column
    # stores the provider reference; the access-control semantics are provider-neutral.
    base.grant_entitlement(external, "IKH:" + paylink_id)
    mark_link_paid(external, paylink_id)
    return external


def generic_payment_page(title: str, message: str) -> str:
    return f"""<!doctype html><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>
    <title>{html.escape(title)}</title>
    <style>body{{font-family:system-ui;background:#071824;color:#eefaff;display:grid;place-items:center;min-height:100vh;margin:0}}main{{max-width:650px;background:#0d2a3d;border:1px solid #315c73;border-radius:22px;padding:28px}}a{{color:#62efd2}}.box{{padding:14px;background:#071e2c;border-radius:12px;margin:14px 0}}</style>
    <main><h1>{html.escape(title)}</h1><p>{html.escape(message)}</p><p><a href='/'>Return to FAISReady</a></p></main>"""


class IkhokhaRevenueHandler(base.RevenueHandler):
    server_version = "FAISReadyRevenue-iKhokha/1.0"

    def do_GET(self) -> None:  # noqa: N802
        path, query = self.route()
        if path == "/api/config":
            cfg = ikhokha_settings()
            self.send_json(
                200,
                {
                    "payments_configured": bool(cfg["ready"]),
                    "payment_provider": "ikhokha",
                    "payment_mode": "live",
                    "live_approved": bool(cfg["live_approved"]),
                    "plans": {
                        k: {"label": v["label"], "amount": v["amount"], "days": v["days"]}
                        for k, v in base.PLANS.items()
                    },
                },
            )
            return
        if path == "/payment/return":
            order_id = html.escape((query.get("order") or [""])[0])
            self.send_html(
                200,
                f"""<!doctype html><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>
                <title>FAISReady payment confirmation</title><style>body{{font-family:system-ui;background:#071824;color:#eefaff;display:grid;place-items:center;min-height:100vh;margin:0}}main{{max-width:620px;background:#0d2a3d;border:1px solid #315c73;border-radius:22px;padding:28px}}a{{color:#62efd2}}.box{{padding:14px;background:#071e2c;border-radius:12px;margin:14px 0}}</style>
                <main><h1>Payment confirmation</h1><p>We are waiting for iKhokha's signed server confirmation before unlocking your course.</p><div class='box' id='state'>Verifying…</div><p><a href='/'>Return to FAISReady</a></p></main>
                <script>const order={json.dumps(order_id)};async function poll(){{try{{const r=await fetch('/api/order-status?order='+encodeURIComponent(order));const d=await r.json();if(d.status==='paid'&&d.access_url){{document.getElementById('state').innerHTML='Payment verified. <a href="'+d.access_url+'">Open your paid FAISReady access</a><br><small>Access expires '+d.expires_at+'</small>';return}}document.getElementById('state').textContent='Verification status: '+(d.status||'pending');}}catch(e){{document.getElementById('state').textContent='Verification is still pending.'}}setTimeout(poll,2500)}}poll();</script>""",
            )
            return
        if path == "/payment/failed":
            self.send_html(200, generic_payment_page("Payment not completed", "iKhokha reported that the payment was not completed. No course access was activated."))
            return
        if path == "/payment/cancel":
            self.send_html(200, generic_payment_page("Payment cancelled", "No course access was activated. You can return and choose a plan whenever you are ready."))
            return
        super().do_GET()

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
                plan = base.clean_text(payload.get("plan"), "plan", 20).lower()
                first = base.clean_text(payload.get("first_name"), "first_name", 50)
                last = base.clean_text(payload.get("last_name"), "last_name", 50)
                email_value = base.clean_email(payload.get("email"))
                if plan not in base.PLANS:
                    raise ValueError("unknown plan")
                ikhokha_settings(require_approval=True)
                order = base.create_order(plan, first, last, email_value)
                payment_url, paylink_id = create_paylink(order)
                self.send_json(
                    201,
                    {
                        "order": order["order_id"],
                        "payment_url": payment_url,
                        "fields": {},
                        "redirect_only": True,
                        "provider": "ikhokha",
                        "provider_reference": paylink_id,
                        "sandbox": False,
                    },
                )
            except (ValueError, json.JSONDecodeError, UnicodeDecodeError) as exc:
                self.send_json(400, {"error": str(exc)})
            return

        if path == "/api/ikhokha/webhook":
            try:
                raw = self.read_body()
                accept_webhook(self, raw)
                self.send_bytes(200, b"OK\n", "text/plain; charset=utf-8")
            except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
                self.send_bytes(400, b"INVALID\n", "text/plain; charset=utf-8")
            return

        super().do_POST()


def self_test() -> int:
    with tempfile.TemporaryDirectory(prefix="faisready-ikhokha-test-") as tmp:
        path = Path(tmp) / "test.sqlite3"
        init_ikhokha_db(path)
        order = base.create_order("re5", "Test", "Learner", "test@example.com", path)
        cfg = {
            "app_id": "APPID1234",
            "secret": "test-secret",
            "public_base_url": "https://faisready.example.com",
        }
        payload = create_payment_payload(order, cfg)
        assert payload["amount"] == 29900
        assert payload["externalTransactionID"] == order["order_id"]
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        sig1 = sign_payload(CREATE_PATH, body, "test-secret")
        sig2 = sign_payload(CREATE_PATH, body, "test-secret")
        assert sig1 == sig2 and re.fullmatch(r"[0-9a-f]{64}", sig1)
        vector_body = '{"entityID":"APPID1234","description":"FAISReady: RE5 Complete Prep"}'
        assert sign_payload(CREATE_PATH, vector_body, "test-secret") == "8087f1ac988c5e26e0e7d5e20c0c411defc117091fca88dfaebe9eac29538fec"
        result = {
            "responseCode": "00",
            "paylinkUrl": "https://securepay.ikhokha.red/test-link",
            "paylinkID": "test-link-1234",
            "externalTransactionID": order["order_id"],
        }
        url, paylink = record_payment_link(order, result, path)
        assert url.startswith("https://securepay.ikhokha.red/")
        link = find_payment_link(order_id=order["order_id"], path=path)
        assert link is not None and link["paylink_id"] == paylink
        remote_ok, amount_ok = validate_remote_paid(
            order,
            link,
            {"status": "PAID", "paylinkID": paylink, "amount": 29900},
        )
        assert remote_ok and amount_ok
        remote_ok2, amount_ok2 = validate_remote_paid(
            order,
            link,
            {"status": "PAID", "paylinkID": paylink, "amount": 1},
        )
        assert remote_ok2 and not amount_ok2
    print("FAISReady iKhokha adapter self-test: PASS")
    return 0


def run_server() -> int:
    init_ikhokha_db()
    host = os.environ.get("HOST", "127.0.0.1").strip()
    port = int(os.environ.get("PORT", "18091"))
    if host not in {"127.0.0.1", "::1", "localhost"}:
        raise SystemExit("FAISReady revenue server refuses non-loopback HOST")
    if not (1024 <= port <= 65535):
        raise SystemExit("PORT must be between 1024 and 65535")
    server = ThreadingHTTPServer((host, port), IkhokhaRevenueHandler)
    cfg = ikhokha_settings()
    print(f"FAISReady iKhokha revenue server listening on http://{host}:{port}")
    print(f"ikhokha_configured={cfg['configured']}")
    print(f"ikhokha_live_approved={cfg['live_approved']}")
    try:
        server.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="FAISReady iKhokha revenue server")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        return self_test()
    return run_server()


if __name__ == "__main__":
    raise SystemExit(main())
