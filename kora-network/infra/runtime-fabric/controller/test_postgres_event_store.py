from datetime import datetime, timezone

from event_hash_chain import GENESIS_HASH, chain_event
from postgres_event_store import PostgresEventStore


class Cursor:
    def __init__(self, connection):
        self.connection = connection
        self.rows = []

    def execute(self, sql, params=None):
        if sql.startswith("SELECT pg_advisory_xact_lock"):
            return
        if sql.startswith("SELECT sequence_no, event_hash"):
            self.rows = self.connection.previous_rows
            return
        if sql.startswith("INSERT INTO izakhono_runtime_events"):
            self.rows = [(self.connection.next_sequence,)]
            self.connection.inserted += 1
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
        self.previous_rows = []
        self.next_sequence = 1
        self.inserted = 0
        self.commits = 0
        self.rollbacks = 0

    def cursor(self):
        return Cursor(self)

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


def make_event(previous_hash=GENESIS_HASH):
    return chain_event(
        event_id="event-1",
        deployment_id="dep-1",
        workload="kora-mail",
        event_type="state_transition",
        state="PLANNED",
        node="node01",
        detail="planned",
        observed_at=datetime.now(timezone.utc).isoformat(),
        evidence=False,
        previous_hash=previous_hash,
    )


def test_append_extends_genesis_chain():
    connection = Connection()
    store = PostgresEventStore(connection)
    stored = store.append(make_event())
    assert stored.sequence_no == 1
    assert connection.inserted == 1
    assert connection.commits == 1


def test_append_rejects_wrong_previous_hash():
    connection = Connection()
    connection.previous_rows = [(1, "a" * 64)]
    store = PostgresEventStore(connection)
    try:
        store.append(make_event())
    except ValueError as exc:
        assert "current audit hash chain" in str(exc)
    else:
        raise AssertionError("expected chain-extension failure")
    assert connection.rollbacks == 1


def test_store_is_append_only_and_never_live_authority():
    assert "BEFORE UPDATE OR DELETE" in __import__("postgres_event_store").CREATE_EVENTS_TABLE
    assert "LIVE_VERIFIED" not in __import__("postgres_event_store").CREATE_EVENTS_TABLE


if __name__ == "__main__":
    test_append_extends_genesis_chain()
    test_append_rejects_wrong_previous_hash()
    test_store_is_append_only_and_never_live_authority()
    print("POSTGRES_EVENT_STORE: PASS")
