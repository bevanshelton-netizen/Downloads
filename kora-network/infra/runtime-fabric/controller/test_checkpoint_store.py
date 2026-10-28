from datetime import datetime, timezone

from integrity_checkpoint import create_checkpoint
from checkpoint_store import PostgresCheckpointStore


class Cursor:
    def __init__(self, connection):
        self.connection = connection
        self.rows = []

    def execute(self, sql, params=None):
        if sql.startswith("SELECT pg_advisory_xact_lock"):
            return
        if sql.startswith("INSERT INTO izakhono_runtime_checkpoints"):
            self.rows = [(self.connection.next_sequence,)]
            return
        raise AssertionError(f"unexpected SQL: {sql[:80]}")

    def fetchone(self):
        return self.rows.pop(0)

    def fetchall(self):
        return []

    def close(self):
        pass


class Connection:
    def __init__(self):
        self.next_sequence = 1
        self.commits = 0
        self.rollbacks = 0

    def cursor(self):
        return Cursor(self)

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


def make_checkpoint():
    return create_checkpoint(
        checkpoint_id="cp-1",
        workload="kora-mail",
        chain_head_hash="a" * 64,
        event_count=3,
        observed_at=datetime.now(timezone.utc).isoformat(),
    )


def test_checkpoint_persists_only_valid_attestation():
    connection = Connection()
    store = PostgresCheckpointStore(connection)
    stored = store.append(make_checkpoint())
    assert stored.sequence_no == 1
    assert connection.commits == 1


def test_checkpoint_store_is_append_only_and_not_promotion_authority():
    ddl = __import__("checkpoint_store").CREATE_CHECKPOINTS_TABLE
    assert "BEFORE UPDATE OR DELETE" in ddl
    assert "LIVE_VERIFIED" not in ddl


if __name__ == "__main__":
    test_checkpoint_persists_only_valid_attestation()
    test_checkpoint_store_is_append_only_and_not_promotion_authority()
    print("CHECKPOINT_STORE: PASS")
