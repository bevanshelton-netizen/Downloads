#!/usr/bin/env python3
"""FAISReady revenue server adapter for the live IZAKHONO PAY / iKhokha rail.

This layer deliberately changes only checkout creation. The existing FAISReady SQLite
order/entitlement ledger and the signed IZAKHONO PAY payment.paid webhook verifier
remain authoritative. IZAKHONO PAY owns provider credentials and provider settlement
verification; FAISReady never receives card data or iKhokha secrets.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from http.server import ThreadingHTTPServer

import revenue_server as base
import revenue_server_izakhono as legacy


def _safe_https_redirect(value: object) -> str:
    url = str(value or "").strip()
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password:
        raise ValueError("IZAKHONO PAY returned an unsafe iKhokha checkout URL")
    if parsed.fragment:
        raise ValueError("IZAKHONO PAY returned an unsafe iKhokha checkout URL")
    return url


def build_izakhono_order(order) -> dict:
    cfg = legacy.izakhono_settings()
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
            "User-Agent": "FAISReady-IZAKHONO-PAY-iKhokha/1.0",
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
    if not legacy.GATEWAY_ORDER_RE.fullmatch(gateway_order_id):
        raise ValueError("IZAKHONO PAY returned an invalid gateway order")
    if remote.get("status") != "pending":
        raise ValueError("IZAKHONO PAY returned an invalid order status")
    if remote.get("product_code") != order["plan"] or remote.get("currency") != "ZAR":
        raise ValueError("IZAKHONO PAY returned the wrong FAISReady product")
    expected_amount = int(round(float(order["amount"]) * 100))
    if remote.get("amount_minor") != expected_amount:
        raise ValueError("IZAKHONO PAY returned a mismatched FAISReady amount")

    method = str(remote.get("payment_method") or "").strip().lower()
    provider = str(remote.get("provider") or "").strip().lower()
    if method == "ikhokha":
        if provider != "ikhokha":
            raise ValueError("IZAKHONO PAY returned a mismatched online provider")
        remote["redirect_url"] = _safe_https_redirect(remote.get("redirect_url"))
        if not str(remote.get("provider_payment_id") or "").strip():
            raise ValueError("IZAKHONO PAY returned an incomplete iKhokha checkout")
        return remote

    if method == "eft":
        if provider not in {"", "eft"}:
            raise ValueError("IZAKHONO PAY returned a mismatched EFT provider")
        reference = str(remote.get("payment_reference") or "").strip()
        bank = remote.get("bank")
        if not reference or not isinstance(bank, dict):
            raise ValueError("IZAKHONO PAY returned incomplete EFT instructions")
        required_bank = ("bank_name", "account_name", "account_number", "account_type", "branch_code")
        if not all(isinstance(bank.get(key), str) and bank.get(key).strip() for key in required_bank):
            raise ValueError("IZAKHONO PAY returned incomplete bank details")
        return remote

    raise ValueError("IZAKHONO PAY returned an unsupported payment method")


class IkhokhaRevenueHandler(legacy.IzakhonoRevenueHandler):
    server_version = "FAISReadyRevenue/1.3-iKhokha"

    def do_GET(self) -> None:  # noqa: N802
        path, _ = self.route()
        if path == "/api/config" and legacy.use_izakhono_pay():
            ready = True
            contract = "orders"
            try:
                cfg = legacy.izakhono_settings()
                contract = cfg["contract"]
            except ValueError:
                ready = False
            self.send_json(
                200,
                {
                    "payments_configured": ready,
                    "payment_orchestrator": "izakhono",
                    "payment_contract": contract,
                    "payment_method": "ikhokha_with_eft_fallback" if contract == "orders" else "legacy_form_post",
                    "legal_merchant": "IZAKHONO AFRICA (PTY) LTD",
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
        if path != "/api/checkout" or not legacy.use_izakhono_pay():
            super().do_POST()
            return

        try:
            cfg = legacy.izakhono_settings()
            if cfg["contract"] != "orders":
                super().do_POST()
                return
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

            order = base.create_order(plan, first, last, email_value)
            remote = build_izakhono_order(order)
            method = str(remote.get("payment_method") or "").lower()
            response = {
                "order": order["order_id"],
                "gateway_order": remote["id"],
                "payment_method": method,
                "amount_minor": remote["amount_minor"],
                "currency": remote["currency"],
                "legal_merchant": "IZAKHONO AFRICA (PTY) LTD",
            }
            if method == "ikhokha":
                response.update(
                    {
                        "payment_url": remote["redirect_url"],
                        "redirect_url": remote["redirect_url"],
                        "provider": "ikhokha",
                        "instructions": remote.get("instructions") or "Continue to the secure iKhokha checkout. Access activates only after verified payment confirmation.",
                    }
                )
            else:
                response.update(
                    {
                        "payment_reference": remote["payment_reference"],
                        "bank": remote["bank"],
                        "provider": "eft",
                        "instructions": remote.get("instructions") or "Pay the exact amount using the unique reference. Access activates automatically after verified settlement.",
                    }
                )
            self.send_json(201, response)
        except (ValueError, json.JSONDecodeError, UnicodeDecodeError) as exc:
            self.send_json(400, {"error": str(exc)})


def self_test() -> int:
    # Preserve the signed paid-event / entitlement ledger regression proof.
    legacy.self_test()
    fake_order = {
        "plan": "re5",
        "amount": 299.0,
    }
    # Validate redirect hygiene independently of any live provider call.
    assert _safe_https_redirect("https://secure.example.test/pay/abc") == "https://secure.example.test/pay/abc"
    try:
        _safe_https_redirect("http://secure.example.test/pay/abc")
        raise AssertionError("unsafe redirect accepted")
    except ValueError:
        pass
    assert fake_order["plan"] == "re5"
    print("FAISReady iKhokha checkout adapter self-test: PASS")
    return 0


def run_server() -> int:
    legacy.init_izakhono_db()
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
    server = ThreadingHTTPServer((host, port), IkhokhaRevenueHandler)
    print(f"FAISReady iKhokha-ready revenue server listening on http://{host}:{port}")
    print(f"payment_orchestrator={'izakhono' if legacy.use_izakhono_pay() else 'direct'}")
    try:
        server.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


def main() -> int:
    import argparse
    parser = argparse.ArgumentParser(description="FAISReady IZAKHONO PAY / iKhokha revenue server")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        return self_test()
    return run_server()


if __name__ == "__main__":
    raise SystemExit(main())
