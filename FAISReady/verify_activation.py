#!/usr/bin/env python3
"""FAISReady production activation verifier.

Modes:
- preflight: prove the stable public HTTPS hostname is healthy and iKhokha
  checkout is still intentionally locked.
- first-sale: prove the stable public hostname, one local paid entitlement and
  a fresh SQLite backup/restore receipt, without emitting customer PII or
  access tokens.

This verifier does not claim broad commercial readiness. It proves the revenue
path and preserves remaining governance/backup gates explicitly.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sqlite3
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import backup_revenue_data as backup
import revenue_server as base
import revenue_server_ikhokha as ikh


def canon(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def digest(value: object) -> str:
    return hashlib.sha256(canon(value)).hexdigest()


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def approved_public_url(value: str | None = None) -> str:
    raw = (value or os.environ.get("PUBLIC_BASE_URL", "")).strip().rstrip("/")
    if not raw:
        raise ValueError("PUBLIC_BASE_URL is required")
    parsed = urllib.parse.urlsplit(raw)
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("PUBLIC_BASE_URL must be a clean HTTPS origin")
    if host != "faisready.co.za" and not host.endswith(".faisready.co.za"):
        raise ValueError("PUBLIC_BASE_URL must use faisready.co.za")
    return raw


def get_json(url: str, timeout: int = 12) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "FAISReady-Activation-Proof/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            if not (200 <= response.status < 300):
                raise ValueError(f"HTTP {response.status} from {url}")
            raw = response.read(base.MAX_BODY)
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise ValueError(f"public verification failed for {url}: {exc}") from exc
    try:
        value = json.loads(raw.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise ValueError(f"invalid JSON from {url}") from exc
    if not isinstance(value, dict):
        raise ValueError(f"unexpected response from {url}")
    return value


def verify_public(base_url: str, *, expect_locked: bool | None) -> dict:
    health = get_json(base_url + "/health")
    if health.get("ok") is not True or health.get("service") != "faisready-revenue":
        raise ValueError("public /health response does not identify FAISReady revenue service")
    config = get_json(base_url + "/api/config")
    if str(config.get("payment_provider") or "").lower() != "ikhokha":
        raise ValueError("public FAISReady is not using the iKhokha payment provider")
    if expect_locked is True:
        if config.get("payments_configured") is not False or config.get("live_approved") is not False:
            raise ValueError("preflight expected iKhokha checkout to remain locked")
    if expect_locked is False:
        if config.get("payments_configured") is not True or config.get("live_approved") is not True:
            raise ValueError("first-sale proof requires iKhokha live approval to be active")
    return {
        "public_base_url": base_url,
        "public_https_health_verified": True,
        "service": health.get("service"),
        "storage": health.get("storage"),
        "payment_provider": "ikhokha",
        "payments_configured": bool(config.get("payments_configured")),
        "live_approved": bool(config.get("live_approved")),
        "plan_amounts": {
            key: str(value.get("amount"))
            for key, value in (config.get("plans") or {}).items()
            if isinstance(value, dict)
        },
    }


def latest_paid_order(path: Path, requested: str | None = None) -> sqlite3.Row:
    with base.DB_LOCK, base.connect_db(path) as conn:
        if requested:
            row = conn.execute(
                "SELECT * FROM orders WHERE order_id=? AND status='paid'",
                (requested,),
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT * FROM orders WHERE status='paid' ORDER BY paid_at DESC, created_at DESC LIMIT 1"
            ).fetchone()
    if row is None:
        raise ValueError("no paid FAISReady order found for first-sale proof")
    return row


def verify_paid_order(path: Path, requested: str | None = None) -> dict:
    order = latest_paid_order(path, requested)
    token = str(order["access_token"] or "")
    entitlement = base.active_entitlement(token, path)
    if entitlement is None:
        raise ValueError("paid order does not have an active entitlement")

    with base.DB_LOCK, base.connect_db(path) as conn:
        link = conn.execute(
            "SELECT * FROM ikhokha_payment_links WHERE order_id=?",
            (order["order_id"],),
        ).fetchone()
    if link is None:
        raise ValueError("paid order has no iKhokha payment-link record")
    if str(link["status"]).upper() != "PAID":
        raise ValueError("iKhokha payment-link record is not marked PAID")
    provider_ref = str(order["payfast_payment_id"] or "")
    expected_ref = "IKH:" + str(link["paylink_id"])
    if provider_ref != expected_ref:
        raise ValueError("paid entitlement provider reference does not match iKhokha paylink")

    return {
        "order_reference_sha256": hashlib.sha256(str(order["order_id"]).encode("utf-8")).hexdigest(),
        "plan": str(order["plan"]),
        "amount": str(order["amount"]),
        "paid_at": str(order["paid_at"]),
        "entitlement_expires_at": str(order["entitlement_expires_at"]),
        "entitlement_active": True,
        "provider_reference_sha256": hashlib.sha256(provider_ref.encode("utf-8")).hexdigest(),
        "provider": "ikhokha",
    }


def create_verified_backup(path: Path) -> dict:
    directory = backup.backup_dir()
    destination = directory / f"faisready-{backup.now_stamp()}.sqlite3"
    receipt = backup.create_backup(path, destination)
    receipt_path = destination.with_suffix(".receipt.json")
    receipt_path.write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    try:
        os.chmod(receipt_path, 0o600)
    except OSError:
        pass
    return {
        "backup_filename": destination.name,
        "backup_sha256": receipt["backup_sha256"],
        "backup_receipt_sha256": receipt["receipt_sha256"],
        "sqlite_integrity_check": bool(receipt["sqlite_integrity_check"]),
        "restore_check_passed": bool(receipt["restore_check_passed"]),
        "backup_receipt_path": str(receipt_path),
    }


def write_receipt(value: dict, path: Path) -> None:
    value["receipt_sha256"] = digest(value)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass


def preflight(args: argparse.Namespace) -> int:
    public = verify_public(approved_public_url(args.url), expect_locked=True)
    receipt = {
        "schema": "faisready.activation-proof/v1",
        "mode": "stable-host-preflight",
        "created_at": utc_now(),
        **public,
        "checkout_locked": True,
        "real_customer_money_taken": False,
        "revenue_path_verified": False,
        "infrastructure_pilot_ready": False,
        "commercial_ready": False,
    }
    out = Path(args.receipt or (Path(tempfile.gettempdir()) / "faisready-preflight-proof.json"))
    write_receipt(receipt, out)
    print(json.dumps(receipt, indent=2, sort_keys=True))
    print(f"receipt={out}")
    return 0


def first_sale(args: argparse.Namespace) -> int:
    public = verify_public(approved_public_url(args.url), expect_locked=False)
    path = Path(args.db).expanduser() if args.db else base.db_path()
    if not path.exists():
        raise ValueError(f"FAISReady revenue database not found: {path}")
    paid = verify_paid_order(path, args.order)
    backup_proof = create_verified_backup(path)
    receipt = {
        "schema": "faisready.activation-proof/v1",
        "mode": "controlled-first-sale",
        "created_at": utc_now(),
        **public,
        **paid,
        **{k: v for k, v in backup_proof.items() if k != "backup_receipt_path"},
        "controlled_live_payment_verified": True,
        "entitlement_verified": True,
        "backup_restore_verified": True,
        "off_machine_encrypted_backup_verified": False,
        "revenue_path_verified": True,
        "infrastructure_pilot_ready": True,
        "broad_promotion_ready": False,
        "commercial_ready": False,
    }
    out = Path(args.receipt or (Path(tempfile.gettempdir()) / "faisready-first-sale-proof.json"))
    write_receipt(receipt, out)
    print(json.dumps(receipt, indent=2, sort_keys=True))
    print(f"backup_receipt={backup_proof['backup_receipt_path']}")
    print(f"activation_receipt={out}")
    return 0


def self_test() -> int:
    with tempfile.TemporaryDirectory(prefix="faisready-activation-selftest-") as tmp:
        root = Path(tmp)
        db = root / "test.sqlite3"
        os.environ["FAISREADY_BACKUP_DIR"] = str(root / "backups")
        ikh.init_ikhokha_db(db)
        order = base.create_order("re5", "Proof", "Test", "proof@example.com", db)
        result = {
            "responseCode": "00",
            "paylinkUrl": "https://securepay.ikhokha.red/proof",
            "paylinkID": "proof-link-1234",
            "externalTransactionID": order["order_id"],
        }
        _, paylink = ikh.record_payment_link(order, result, db)
        base.grant_entitlement(order["order_id"], "IKH:" + paylink, db)
        with base.DB_LOCK, base.connect_db(db) as conn:
            conn.execute(
                "UPDATE ikhokha_payment_links SET status='PAID',updated_at=? WHERE order_id=?",
                (base.iso(), order["order_id"]),
            )
        proof = verify_paid_order(db)
        assert proof["entitlement_active"] is True
        assert proof["provider"] == "ikhokha"
        b = create_verified_backup(db)
        assert b["sqlite_integrity_check"] is True
        assert b["restore_check_passed"] is True
        assert len(b["backup_sha256"]) == 64
    print("FAISReady activation verifier self-test: PASS")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify FAISReady production activation")
    parser.add_argument("--self-test", action="store_true")
    sub = parser.add_subparsers(dest="mode")

    p = sub.add_parser("preflight")
    p.add_argument("--url")
    p.add_argument("--receipt")
    p.set_defaults(func=preflight)

    s = sub.add_parser("first-sale")
    s.add_argument("--url")
    s.add_argument("--order")
    s.add_argument("--db")
    s.add_argument("--receipt")
    s.set_defaults(func=first_sale)

    args = parser.parse_args()
    if args.self_test:
        return self_test()
    if not hasattr(args, "func"):
        parser.error("choose preflight or first-sale")
    try:
        return args.func(args)
    except (ValueError, OSError, sqlite3.Error) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    import sys
    raise SystemExit(main())
