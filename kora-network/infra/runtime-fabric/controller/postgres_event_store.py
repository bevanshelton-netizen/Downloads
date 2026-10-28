"""Durable PostgreSQL append-only store for Runtime Fabric audit events.

The database persists the tamper-evident event chain but is never a deployment
promotion authority. Promotion remains governed by the deployment acceptance
and LIVE_VERIFIED gates.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, Optional, Protocol

from event_hash_chain import ChainedEvent, GENESIS_HASH, chain_event, verify_chain


class Connection(Protocol):
    def cursor(self) -> Any: ...
    def commit(self) -> None: ...
    def rollback(self) -> None: ...


@dataclass(frozen=True)
class StoredEvent:
    sequence_no: int
    event: ChainedEvent


CREATE_EVENTS_TABLE = """
CREATE TABLE IF NOT EXISTS izakhono_runtime_events (
    sequence_no BIGSERIAL PRIMARY KEY,
    event_id TEXT NOT NULL UNIQUE,
    deployment_id TEXT NOT NULL,
    workload TEXT NOT NULL,
    event_type TEXT NOT NULL,
    state TEXT NOT NULL,
    node TEXT,
    detail TEXT NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL,
    evidence BOOLEAN NOT NULL DEFAULT FALSE,
    previous_hash CHAR(64) NOT NULL,
    event_hash CHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_runtime_events_deployment
    ON izakhono_runtime_events (deployment_id, sequence_no);

CREATE OR REPLACE FUNCTION izakhono_runtime_events_immutable()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'izakhono_runtime_events is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS runtime_events_immutable ON izakhono_runtime_events;
CREATE TRIGGER runtime_events_immutable
BEFORE UPDATE OR DELETE ON izakhono_runtime_events
FOR EACH ROW EXECUTE FUNCTION izakhono_runtime_events_immutable();
"""


class PostgresEventStore:
    """Append-only durable event store using a caller-owned DB connection."""

    def __init__(self, connection: Connection):
        self.connection = connection

    def initialize(self) -> None:
        cursor = self.connection.cursor()
        try:
            cursor.execute(CREATE_EVENTS_TABLE)
            self.connection.commit()
        except Exception:
            self.connection.rollback()
            raise
        finally:
            cursor.close()

    def append(self, event: ChainedEvent) -> StoredEvent:
        """Append one event while atomically extending the global hash chain."""
        cursor = self.connection.cursor()
        try:
            # Serialize chain extension across concurrent writers.
            cursor.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", ("izakhono-runtime-events",))
            cursor.execute(
                "SELECT sequence_no, event_hash FROM izakhono_runtime_events "
                "ORDER BY sequence_no DESC LIMIT 1 FOR UPDATE"
            )
            previous = cursor.fetchone()
            expected_previous = previous[1] if previous else GENESIS_HASH
            if event.previous_hash != expected_previous:
                raise ValueError("event does not extend the current audit hash chain")
            if not event.event_hash:
                raise ValueError("event_hash is required")
            cursor.execute(
                "INSERT INTO izakhono_runtime_events "
                "(event_id, deployment_id, workload, event_type, state, node, detail, observed_at, evidence, previous_hash, event_hash) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING sequence_no",
                (
                    event.event_id, event.deployment_id, event.workload, event.event_type,
                    event.state, event.node, event.detail, event.observed_at, event.evidence,
                    event.previous_hash, event.event_hash,
                ),
            )
            sequence_no = cursor.fetchone()[0]
            self.connection.commit()
            return StoredEvent(sequence_no=sequence_no, event=event)
        except Exception:
            self.connection.rollback()
            raise
        finally:
            cursor.close()

    def list_events(self, deployment_id: Optional[str] = None) -> list[StoredEvent]:
        cursor = self.connection.cursor()
        try:
            if deployment_id:
                cursor.execute(
                    "SELECT sequence_no,event_id,deployment_id,workload,event_type,state,node,detail,observed_at,evidence,previous_hash,event_hash "
                    "FROM izakhono_runtime_events WHERE deployment_id=%s ORDER BY sequence_no",
                    (deployment_id,),
                )
            else:
                cursor.execute(
                    "SELECT sequence_no,event_id,deployment_id,workload,event_type,state,node,detail,observed_at,evidence,previous_hash,event_hash "
                    "FROM izakhono_runtime_events ORDER BY sequence_no"
                )
            return [self._row(row) for row in cursor.fetchall()]
        finally:
            cursor.close()

    def verify_integrity(self, deployment_id: Optional[str] = None) -> bool:
        return verify_chain(item.event for item in self.list_events(deployment_id))

    @staticmethod
    def _row(row: tuple[Any, ...]) -> StoredEvent:
        (
            sequence_no, event_id, deployment_id, workload, event_type, state,
            node, detail, observed_at, evidence, previous_hash, event_hash,
        ) = row
        event = ChainedEvent(
            event_id=event_id,
            deployment_id=deployment_id,
            workload=workload,
            event_type=event_type,
            state=state,
            node=node,
            detail=detail,
            observed_at=observed_at.isoformat() if hasattr(observed_at, "isoformat") else str(observed_at),
            evidence=evidence,
            previous_hash=previous_hash,
            event_hash=event_hash,
        )
        return StoredEvent(sequence_no=sequence_no, event=event)
