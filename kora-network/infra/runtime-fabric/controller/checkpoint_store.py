"""Durable checkpoint persistence and independent verification.

Checkpoints are integrity evidence only. They never authorize LIVE_VERIFIED.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional, Protocol

from integrity_checkpoint import IntegrityCheckpoint, verify_checkpoint


class Connection(Protocol):
    def cursor(self) -> Any: ...
    def commit(self) -> None: ...
    def rollback(self) -> None: ...


@dataclass(frozen=True)
class StoredCheckpoint:
    sequence_no: int
    checkpoint: IntegrityCheckpoint


CREATE_CHECKPOINTS_TABLE = """
CREATE TABLE IF NOT EXISTS izakhono_runtime_checkpoints (
    sequence_no BIGSERIAL PRIMARY KEY,
    checkpoint_id TEXT NOT NULL UNIQUE,
    workload TEXT NOT NULL,
    chain_head_hash CHAR(64) NOT NULL,
    event_count BIGINT NOT NULL CHECK (event_count >= 0),
    observed_at TIMESTAMPTZ NOT NULL,
    attestation_hash CHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_runtime_checkpoints_workload
    ON izakhono_runtime_checkpoints (workload, sequence_no);

CREATE OR REPLACE FUNCTION izakhono_runtime_checkpoints_immutable()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'izakhono_runtime_checkpoints is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS runtime_checkpoints_immutable ON izakhono_runtime_checkpoints;
CREATE TRIGGER runtime_checkpoints_immutable
BEFORE UPDATE OR DELETE ON izakhono_runtime_checkpoints
FOR EACH ROW EXECUTE FUNCTION izakhono_runtime_checkpoints_immutable();
"""


class PostgresCheckpointStore:
    """Persist and independently verify immutable integrity checkpoints."""

    def __init__(self, connection: Connection):
        self.connection = connection

    def initialize(self) -> None:
        cursor = self.connection.cursor()
        try:
            cursor.execute(CREATE_CHECKPOINTS_TABLE)
            self.connection.commit()
        except Exception:
            self.connection.rollback()
            raise
        finally:
            cursor.close()

    def append(self, checkpoint: IntegrityCheckpoint) -> StoredCheckpoint:
        if not verify_checkpoint(checkpoint):
            raise ValueError("invalid integrity checkpoint")
        cursor = self.connection.cursor()
        try:
            cursor.execute(
                "SELECT pg_advisory_xact_lock(hashtext(%s))",
                ("izakhono-runtime-checkpoints",),
            )
            cursor.execute(
                "INSERT INTO izakhono_runtime_checkpoints "
                "(checkpoint_id,workload,chain_head_hash,event_count,observed_at,attestation_hash) "
                "VALUES (%s,%s,%s,%s,%s,%s) RETURNING sequence_no",
                (
                    checkpoint.checkpoint_id,
                    checkpoint.workload,
                    checkpoint.chain_head_hash,
                    checkpoint.event_count,
                    checkpoint.observed_at,
                    checkpoint.attestation_hash,
                ),
            )
            sequence_no = cursor.fetchone()[0]
            self.connection.commit()
            return StoredCheckpoint(sequence_no, checkpoint)
        except Exception:
            self.connection.rollback()
            raise
        finally:
            cursor.close()

    def list_checkpoints(self, workload: Optional[str] = None) -> list[StoredCheckpoint]:
        cursor = self.connection.cursor()
        try:
            if workload:
                cursor.execute(
                    "SELECT sequence_no,checkpoint_id,workload,chain_head_hash,event_count,observed_at,attestation_hash "
                    "FROM izakhono_runtime_checkpoints WHERE workload=%s ORDER BY sequence_no",
                    (workload,),
                )
            else:
                cursor.execute(
                    "SELECT sequence_no,checkpoint_id,workload,chain_head_hash,event_count,observed_at,attestation_hash "
                    "FROM izakhono_runtime_checkpoints ORDER BY sequence_no"
                )
            return [self._row(row) for row in cursor.fetchall()]
        finally:
            cursor.close()

    def verify(self, workload: Optional[str] = None) -> bool:
        return all(verify_checkpoint(item.checkpoint) for item in self.list_checkpoints(workload))

    @staticmethod
    def _row(row: tuple[Any, ...]) -> StoredCheckpoint:
        sequence_no, checkpoint_id, workload, chain_head_hash, event_count, observed_at, attestation_hash = row
        checkpoint = IntegrityCheckpoint(
            checkpoint_id=checkpoint_id,
            workload=workload,
            chain_head_hash=chain_head_hash,
            event_count=event_count,
            observed_at=observed_at.isoformat() if hasattr(observed_at, "isoformat") else str(observed_at),
            attestation_hash=attestation_hash,
        )
        return StoredCheckpoint(sequence_no, checkpoint)
