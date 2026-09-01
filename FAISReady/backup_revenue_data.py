#!/usr/bin/env python3
"""Create and verify a private FAISReady bootstrap database backup.

Uses SQLite's online backup API so it is safe to run while the revenue server is
active. Every backup is integrity-checked and restored into a temporary database
before a SHA-256 receipt is written. Customer/payment records are private data;
backup files stay outside Git and should be copied to encrypted storage.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sqlite3
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import revenue_server as revenue


def now_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def backup_dir() -> Path:
    configured = os.environ.get("FAISREADY_BACKUP_DIR", "").strip()
    target = Path(configured).expanduser() if configured else revenue.data_dir() / "backups"
    target.mkdir(parents=True, exist_ok=True)
    return target


def database_counts(conn: sqlite3.Connection) -> dict[str, int]:
    result = {}
    for table in ("orders", "payment_events"):
        result[table] = int(conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0])
    return result


def integrity(conn: sqlite3.Connection) -> bool:
    row = conn.execute("PRAGMA integrity_check").fetchone()
    return bool(row and row[0] == "ok")


def create_backup(source: Path, destination: Path) -> dict:
    if not source.exists():
        raise RuntimeError(f"source database not found: {source}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(source, timeout=10) as src, sqlite3.connect(destination) as dst:
        src.execute("PRAGMA busy_timeout=10000")
        src.backup(dst)
    try:
        os.chmod(destination, 0o600)
    except OSError:
        pass

    with sqlite3.connect(destination) as check:
        if not integrity(check):
            raise RuntimeError("backup integrity check failed")
        backup_counts = database_counts(check)

    with tempfile.TemporaryDirectory(prefix="faisready-restore-check-") as tmp:
        restored = Path(tmp) / "restored.sqlite3"
        with sqlite3.connect(destination) as src, sqlite3.connect(restored) as dst:
            src.backup(dst)
        with sqlite3.connect(restored) as check:
            if not integrity(check):
                raise RuntimeError("restore verification integrity check failed")
            restore_counts = database_counts(check)
        if restore_counts != backup_counts:
            raise RuntimeError("restore verification row counts do not match backup")

    receipt = {
        "schema": "faisready.backup-receipt/v1",
        "created_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "backup_filename": destination.name,
        "backup_sha256": sha256_file(destination),
        "backup_bytes": destination.stat().st_size,
        "sqlite_integrity_check": True,
        "restore_check_passed": True,
        "row_counts": backup_counts,
        "contains_private_customer_data": True,
        "git_commit_allowed": False,
    }
    receipt["receipt_sha256"] = hashlib.sha256(
        json.dumps(receipt, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    return receipt


def prune(directory: Path, keep: int) -> None:
    if keep < 1:
        return
    backups = sorted(directory.glob("faisready-*.sqlite3"), key=lambda p: p.stat().st_mtime, reverse=True)
    for old in backups[keep:]:
        old.unlink(missing_ok=True)
        receipt = old.with_suffix(".receipt.json")
        receipt.unlink(missing_ok=True)


def run(keep: int) -> int:
    source = revenue.db_path()
    directory = backup_dir()
    destination = directory / f"faisready-{now_stamp()}.sqlite3"
    receipt = create_backup(source, destination)
    receipt_path = destination.with_suffix(".receipt.json")
    receipt_path.write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    try:
        os.chmod(receipt_path, 0o600)
    except OSError:
        pass
    prune(directory, keep)
    print(json.dumps(receipt, indent=2, sort_keys=True))
    print(f"backup={destination}")
    print(f"receipt={receipt_path}")
    return 0


def self_test() -> int:
    with tempfile.TemporaryDirectory(prefix="faisready-backup-selftest-") as tmp:
        root = Path(tmp)
        source = root / "source.sqlite3"
        revenue.init_db(source)
        revenue.create_order("re5", "Backup", "Test", "backup@example.com", source)
        destination = root / "backup.sqlite3"
        receipt = create_backup(source, destination)
        assert receipt["sqlite_integrity_check"] is True
        assert receipt["restore_check_passed"] is True
        assert receipt["row_counts"]["orders"] == 1
        assert len(receipt["backup_sha256"]) == 64
    print("FAISReady backup/restore self-test: PASS")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Backup and verify FAISReady bootstrap revenue data")
    parser.add_argument("--keep", type=int, default=14, help="number of local backup generations to retain")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        return self_test()
    try:
        return run(args.keep)
    except (RuntimeError, OSError, sqlite3.Error) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    import sys
    raise SystemExit(main())
