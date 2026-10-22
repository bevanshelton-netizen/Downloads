# KORA CONNECT™

## One signal. Every available network.

KORA CONNECT is the connectivity-orchestration layer for KORA LIVE, KORA TV, KORA Radio, KORA NAV, emergency broadcasting, education and field operations.

### Mission
Combine available network paths—5G, 4G/LTE, Wi-Fi, Ethernet and satellite/IP—into a resilient transport strategy without locking KORA to one carrier or vendor.

### Architecture

```text
DEVICE / KORA EDGE
  ├─ 5G
  ├─ 4G/LTE
  ├─ Wi-Fi
  ├─ Ethernet
  └─ Satellite/IP
          ↓
KORA CONNECT ORCHESTRATOR
  ├─ link discovery
  ├─ health scoring
  ├─ path selection
  ├─ failover
  ├─ bonding/aggregation adapter
  ├─ bandwidth policy
  └─ telemetry
          ↓
KORA EDGE GATEWAY
          ↓
KORA MEDIA / DATA SERVICES
  ├─ KORA LIVE
  ├─ KORA TV
  ├─ KORA RADIO
  ├─ KORA NAV
  └─ KORA EMERGENCY
```

### Design principles
- Owned-first orchestration: KORA owns the control plane and user experience.
- Vendor-neutral: adapters can integrate approved hardware and transport providers.
- Graceful degradation: losing one link should not automatically end a session.
- Offline/low-connectivity resilience is a first-class requirement.
- Security: device identity, encrypted transport and FORTRESS integration are required before production use.
- No false live claims: production readiness requires verified end-to-end testing.

### Initial link states
`available` → `probing` → `healthy` → `degraded` → `failed` → `recovering`

### Initial scoring inputs
- latency
- packet loss
- jitter
- throughput
- signal quality
- cost policy
- reliability history
- application priority

### Product progression
1. Connectivity monitor
2. Automatic failover
3. Multi-link policy engine
4. Bonding/aggregation adapters
5. KORA Edge hardware profile
6. Broadcast and emergency-grade deployments

KORA CONNECT is an orchestration layer, not a claim that KORA itself owns cellular or satellite networks.
