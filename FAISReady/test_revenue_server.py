#!/usr/bin/env python3
import hashlib
import os
import tempfile
import urllib.parse
from pathlib import Path

import revenue_server as r


def independent_signature(pairs, passphrase):
    parts = []
    for key, value in pairs:
        value = str(value).strip()
        if value:
            parts.append(f"{key}={urllib.parse.quote_plus(value, safe='')}")
    parts.append("passphrase=" + urllib.parse.quote_plus(passphrase, safe=""))
    return hashlib.md5("&".join(parts).encode("utf-8"), usedforsecurity=False).hexdigest()


def main():
    saved = {k: os.environ.get(k) for k in [
        "PAYFAST_MERCHANT_ID", "PAYFAST_MERCHANT_KEY", "PAYFAST_PASSPHRASE",
        "PAYFAST_SANDBOX", "PUBLIC_BASE_URL", "FAISREADY_ALLOW_HTTP_BASE"
    ]}
    try:
        os.environ.update({
            "PAYFAST_MERCHANT_ID": "10000100",
            "PAYFAST_MERCHANT_KEY": "46f0cd694581a",
            "PAYFAST_PASSPHRASE": "jt7NOE43FZPn",
            "PAYFAST_SANDBOX": "true",
            "PUBLIC_BASE_URL": "https://faisready.example.com",
            "FAISREADY_ALLOW_HTTP_BASE": "false",
        })
        with tempfile.TemporaryDirectory(prefix="faisready-payment-contract-") as tmp:
            db = Path(tmp) / "contract.sqlite3"
            r.init_db(db)
            order = r.create_order("combo", "Test", "Buyer", "buyer@example.com", db)
            assert order["amount"] == "549.00"
            action, fields = r.checkout_fields(order)
            assert action == "https://sandbox.payfast.co.za/eng/process"
            assert fields[-1][0] == "signature"
            submitted = dict(fields)
            assert submitted["amount"] == "549.00"
            assert submitted["m_payment_id"] == order["order_id"]
            assert submitted["notify_url"] == "https://faisready.example.com/api/payfast/itn"
            assert submitted["return_url"].startswith("https://faisready.example.com/payment/return?order=")
            assert "PAYFAST_PASSPHRASE" not in submitted
            assert "passphrase" not in submitted
            expected = independent_signature(fields[:-1], "jt7NOE43FZPn")
            assert submitted["signature"] == expected
            assert len(submitted["signature"]) == 32

            paid = r.grant_entitlement(order["order_id"], "PF-CONTRACT-TEST", db)
            assert paid["status"] == "paid"
            assert paid["entitlement_expires_at"]
            assert r.active_entitlement(paid["access_token"], db) is not None

        os.environ["PUBLIC_BASE_URL"] = "http://127.0.0.1:18091"
        try:
            r.public_base_url()
        except ValueError:
            pass
        else:
            raise AssertionError("production base URL accepted insecure localhost")
    finally:
        for key, value in saved.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value

    print("FAISReady PayFast/entitlement contract test: PASS")


if __name__ == "__main__":
    main()
