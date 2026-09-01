# FAISReady launch checklist

## Software gates completed
- Financial-services storefront and responsive public experience
- Limited free public sample instead of exposing the full paid question bank
- Existing RE5 and RE1 paid preparation engine
- 540 original launch-bank questions (300 RE5 / 240 RE1)
- Quick drills, deep drills, diagnostics and full mocks
- Topic mastery and weak-area coaching
- R299 / R399 / R549 server-side plan definitions
- Native Windows and Linux IZAKHONO Launch Bridge manifests
- Docker-free, public-IP-free local runtime proof
- SQLite bootstrap order/payment-event/entitlement storage
- Server-side PayFast signed checkout
- PayFast ITN checks for signature, source, merchant, amount, server validation and COMPLETE status
- Entitlement created only after accepted ITN
- Quick-Tunnel sandbox runner
- Named-tunnel runner using environment/token-file secrets rather than command-line token disclosure
- Public HTTPS health proof receipt format
- Online SQLite backup, integrity check and restore-check receipt
- CI checks for all software contracts above

## Real-world gates before taking live customer money
1. Real owner-controlled machine passes the FAISReady Launch Bridge proof.
2. `cloudflared` installed on that machine.
3. Temporary Quick Tunnel used only for sandbox proof if needed.
4. Stable named tunnel + custom HTTPS hostname configured to `http://127.0.0.1:18091`.
5. Real PayFast Merchant ID, Merchant Key and passphrase stored only in the protected owner-machine environment.
6. Authorised PayFast payout configuration confirmed.
7. PayFast Sandbox transaction completed end to end through the public hostname.
8. ITN validation confirmed and the correct 90-day/120-day entitlement observed.
9. SQLite backup created and restore-check receipt passes against real pilot data.
10. Sandbox disabled only after all prior gates pass.
11. One controlled low-value live transaction verified before broad promotion.

## Scale-after-revenue gates
- Move SQLite data into the later IZAKHONO distributed data layer when concurrency/HA requires it.
- Add automated off-machine encrypted backup replication.
- Add multiple owner-controlled nodes and failover.
- Expand company multi-seat entitlements and authenticated learner accounts.
- Add monitoring/alerting and payment reconciliation dashboard.

## Content governance
- Original preparation questions only; no confidential/leaked-paper claims.
- Maintain mapping to the current FSCA RE1/RE5 preparation guide and legislation.
- Obtain qualified FAIS compliance/training review before claiming complete coverage.

## Truth boundary
Passing CI does not mean a public merchant deployment exists. Keep `commercial_ready=false` until the real-world gates above have been evidenced.
