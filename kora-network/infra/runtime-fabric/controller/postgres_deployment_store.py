"""Durable PostgreSQL deployment state and atomic promotion boundary."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional, Protocol


class Connection(Protocol):
    def cursor(self) -> Any: ...
    def commit(self) -> None: ...
    def rollback(self) -> None: ...


@dataclass(frozen=True)
class DeploymentRecord:
    deployment_id: str
    workload: str
    state: str
    node: Optional[str]
    checkpoint: Optional[str]
    attempts: int
    metadata: dict[str, Any]


CREATE_DEPLOYMENTS_TABLE = """
CREATE TABLE IF NOT EXISTS izakhono_runtime_deployments (
    deployment_id TEXT PRIMARY KEY,
    workload TEXT NOT NULL,
    state TEXT NOT NULL,
    node TEXT,
    checkpoint TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_runtime_deployments_active
    ON izakhono_runtime_deployments (state, updated_at);
CREATE TABLE IF NOT EXISTS izakhono_runtime_deployment_leases (
    deployment_id TEXT PRIMARY KEY REFERENCES izakhono_runtime_deployments(deployment_id) ON DELETE CASCADE,
    owner_id TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""


class PostgresDeploymentStore:
    """Caller-owned PostgreSQL connection; no credentials are stored here."""

    def __init__(self, connection: Connection):
        self.connection = connection

    def initialize(self) -> None:
        cursor = self.connection.cursor()
        try:
            cursor.execute(CREATE_DEPLOYMENTS_TABLE)
            self.connection.commit()
        except Exception:
            self.connection.rollback()
            raise
        finally:
            cursor.close()

    def get(self, deployment_id: str) -> Optional[DeploymentRecord]:
        cursor = self.connection.cursor()
        try:
            cursor.execute(
                "SELECT deployment_id,workload,state,node,checkpoint,attempts,metadata "
                "FROM izakhono_runtime_deployments WHERE deployment_id=%s",
                (deployment_id,),
            )
            row = cursor.fetchone()
            return self._row(row) if row else None
        finally:
            cursor.close()

    def list_active(self) -> list[DeploymentRecord]:
        cursor = self.connection.cursor()
        try:
            cursor.execute(
                "SELECT deployment_id,workload,state,node,checkpoint,attempts,metadata "
                "FROM izakhono_runtime_deployments WHERE state NOT IN "
                "('LIVE_VERIFIED','ROLLED_BACK','FAILED') ORDER BY updated_at"
            )
            return [self._row(row) for row in cursor.fetchall()]
        finally:
            cursor.close()

    def put(self, record: DeploymentRecord) -> None:
        cursor = self.connection.cursor()
        try:
            cursor.execute(
                "INSERT INTO izakhono_runtime_deployments "
                "(deployment_id,workload,state,node,checkpoint,attempts,metadata) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s::jsonb) "
                "ON CONFLICT (deployment_id) DO UPDATE SET workload=EXCLUDED.workload, "
                "state=EXCLUDED.state,node=EXCLUDED.node,checkpoint=EXCLUDED.checkpoint, "
                "attempts=EXCLUDED.attempts,metadata=EXCLUDED.metadata,updated_at=NOW()",
                (record.deployment_id, record.workload, record.state, record.node,
                 record.checkpoint, record.attempts, _json(record.metadata)),
            )
            self.connection.commit()
        except Exception:
            self.connection.rollback()
            raise
        finally:
            cursor.close()

    def transition_if_current(
        self, deployment_id: str, expected_state: str, next_state: str,
        workload: str | None = None, node: str | None = None,
    ) -> bool:
        """Atomically transition one deployment only if its identity/state match."""
        if not deployment_id or not expected_state or not next_state:
            raise ValueError("deployment transition identity is required")
        if next_state == "LIVE_VERIFIED" and (not workload or not node):
            raise ValueError("LIVE_VERIFIED transition requires workload and node")
        cursor = self.connection.cursor()
        try:
            clauses = ["deployment_id=%s", "state=%s"]
            params: list[Any] = [deployment_id, expected_state]
            if workload is not None:
                clauses.append("workload=%s")
                params.append(workload)
            if node is not None:
                clauses.append("node=%s")
                params.append(node)
            cursor.execute(
                "UPDATE izakhono_runtime_deployments SET state=%s, updated_at=NOW() "
                "WHERE " + " AND ".join(clauses) + " RETURNING deployment_id",
                [next_state, *params],
            )
            changed = cursor.fetchone() is not None
            self.connection.commit()
            return changed
        except Exception:
            self.connection.rollback()
            raise
        finally:
            cursor.close()

    def promote_if_ready(self, deployment_id: str, workload: str, node: str) -> bool:
        """Atomically perform only READY_FOR_PROMOTION -> LIVE_VERIFIED."""
        return self.transition_if_current(
            deployment_id,
            "READY_FOR_PROMOTION",
            "LIVE_VERIFIED",
            workload=workload,
            node=node,
        )

    @staticmethod
    def _row(row: tuple[Any, ...]) -> DeploymentRecord:
        deployment_id, workload, state, node, checkpoint, attempts, metadata = row
        return DeploymentRecord(
            deployment_id=deployment_id, workload=workload, state=state,
            node=node, checkpoint=checkpoint, attempts=attempts, metadata=metadata or {},
        )


def _json(value: dict[str, Any]) -> str:
    import json
    return json.dumps(value, sort_keys=True, separators=(",", ":"))
