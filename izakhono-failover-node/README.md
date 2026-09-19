# IZAKHONO FAILOVER NODE

Owned availability controller for IZAKHONO primary/standby services.

## V1 capabilities

- active and standby health monitoring;
- consecutive-failure thresholding;
- failover-candidate creation only when active is unhealthy and standby is healthy;
- proposal invalidation when the active node recovers;
- explicit fencing requirement before promotion approval;
- monotonic service epochs;
- manual route-switch confirmation;
- audit ledger;
- SQLite WAL persistence;
- loopback control API;
- zero runtime npm dependencies.

## Split-brain policy

V1 **does not automatically promote a standby** and does not automatically modify DNS.

A promotion can be approved only when:
1. the active endpoint has failed the configured number of probes;
2. the standby endpoint is healthy;
3. an operator explicitly submits `confirm=PROMOTE`;
4. the operator confirms the old active node has been fenced and records fencing evidence.

After approval, FAILOVER NODE returns the standby target and route name. The external route/DNS switch remains explicit. Completion requires `confirm=ROUTE_SWITCHED` plus route evidence.

This is intentional. A two-node system without an independent quorum/witness cannot always distinguish a dead primary from a network partition. Silent automatic promotion would risk two writable primaries.

## Port

Control API: `127.0.0.1:8920`.

## Physical HA boundary

CI can prove the state machine and fencing gate. Actual high availability is not proven until at least two physically separate IZAKHONO hosts, independent network paths where practical, replicated application state, and a real route/DNS cutover have been tested.
