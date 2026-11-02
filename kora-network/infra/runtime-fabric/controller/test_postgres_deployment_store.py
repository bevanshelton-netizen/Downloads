"""Deterministic tests for the PostgreSQL deployment store boundary."""
from postgres_deployment_store import PostgresDeploymentStore, DeploymentRecord


class Cursor:
    def __init__(self, rows=None):
        self.rows = list(rows or [])
        self.executed = []
        self.closed = False

    def execute(self, sql, params=None):
        self.executed.append((sql, params))

    def fetchone(self):
        return self.rows.pop(0) if self.rows else None

    def fetchall(self):
        return self.rows

    def close(self):
        self.closed = True


class Connection:
    def __init__(self, rows=None):
        self.cursor_obj = Cursor(rows)
        self.commits = 0
        self.rollbacks = 0

    def cursor(self):
        return self.cursor_obj

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


def test_atomic_ready_to_live_update():
    conn = Connection(rows=[("dep-1",)])
    store = PostgresDeploymentStore(conn)
    assert store.promote_if_ready("dep-1", "kora-mail", "node01") is True
    sql, params = conn.cursor_obj.executed[0]
    assert "SET state='LIVE_VERIFIED'" in sql
    assert "state='READY_FOR_PROMOTION'" in sql
    assert params == ("dep-1", "kora-mail", "node01")
    assert conn.commits == 1
    assert conn.rollbacks == 0


def test_compare_and_swap_zero_rows_fails_closed():
    conn = Connection(rows=[])
    store = PostgresDeploymentStore(conn)
    assert store.promote_if_ready("dep-1", "kora-mail", "node01") is False
    assert conn.commits == 1


def test_identity_is_required():
    store = PostgresDeploymentStore(Connection())
    for args in [("", "kora-mail", "node01"), ("dep-1", "", "node01"), ("dep-1", "kora-mail", "")]:
        try:
            store.promote_if_ready(*args)
        except ValueError:
            pass
        else:
            raise AssertionError("missing deployment identity must block")


def test_record_round_trip_mapping():
    row = ("dep-1", "kora-mail", "READY_FOR_PROMOTION", "node01", "cp-1", 2, {"source": "test"})
    record = PostgresDeploymentStore(Connection())._row(row)
    assert record == DeploymentRecord("dep-1", "kora-mail", "READY_FOR_PROMOTION", "node01", "cp-1", 2, {"source": "test"})


if __name__ == "__main__":
    test_atomic_ready_to_live_update()
    test_compare_and_swap_zero_rows_fails_closed()
    test_identity_is_required()
    test_record_round_trip_mapping()
    print("POSTGRES_DEPLOYMENT_STORE: PASS")
