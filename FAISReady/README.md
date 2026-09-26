# FAISReady revenue-first launch package

FAISReady is a South African RE5/RE1 regulatory-exam preparation platform for individuals and companies.

## Commercial offer

- RE5 Complete Prep: R299 / 90 days
- RE1 Complete Prep: R399 / 90 days
- RE5 + RE1: R549 / 120 days
- Companies: volume candidate licensing

## Bootstrap architecture

The first-sales path no longer requires Vercel, Netlify, Docker, a public IPv4 address or Supabase.

```text
customer
  -> public HTTPS edge / outbound tunnel
  -> IZAKHONO CLOUD Launch Bridge
  -> FAISReady native Python revenue server on 127.0.0.1
  -> SQLite orders + entitlements
  -> PayFast hosted checkout
```

The public storefront exposes only a short free sample. Full preparation content is served through `/learn` only when a paid entitlement token is active.

## Local proof

Linux/macOS:

```bash
python3 izakhono-cloud/launch-bridge.py plan FAISReady/.izakhono-launch-linux.json --out /tmp/faisready-plan.json
python3 izakhono-cloud/launch-bridge.py run /tmp/faisready-plan.json --repo-root . --proof-only
```

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\izakhono-cloud\launch-bridge-windows.ps1 -Manifest .\FAISReady\.izakhono-launch-windows.json -RepoRoot . -ProofOnly
```

## Free public sandbox proof

Install `cloudflared`, then run:

```bash
python3 FAISReady/edge_runner.py --mode quick-sandbox --public-payfast-sandbox
```

This creates a temporary `trycloudflare.com` URL, starts FAISReady through the IZAKHONO native runtime, verifies the public HTTPS health endpoint, and enables PayFast's public sandbox merchant configuration for a test transaction.

A Quick Tunnel is for testing only. It is not the production storefront.

## Stable named tunnel

Configure a remotely-managed tunnel so the chosen custom hostname maps to `http://127.0.0.1:18091`. Keep the tunnel token outside Git and provide it through `TUNNEL_TOKEN` or `TUNNEL_TOKEN_FILE`.

Set the real public hostname and PayFast server-only values in the owner machine's environment, then run:

```bash
python3 FAISReady/edge_runner.py --mode named
```

Start with `PAYFAST_SANDBOX=true`. Switch to live PayFast only after the named-host sandbox payment and entitlement flow has passed end to end.

## Payment integrity

The server creates signed PayFast checkout fields and grants access only after the ITN path validates the payment signature, PayFast source, merchant, amount, server confirmation and `COMPLETE` status. Card details are entered on PayFast's hosted payment page, not FAISReady.

## Backup

While the revenue server is running:

```bash
python3 FAISReady/backup_revenue_data.py
```

The backup uses SQLite's online backup API, runs an integrity check, restores into a temporary database, compares row counts and writes a SHA-256 receipt. Backup files contain private customer/payment records and must never be committed to Git.

## Truth boundary

CI proves the software path. It does not prove a real owner machine, real custom hostname, real merchant account, real payment or real recovery operation. `commercial_ready=false` remains correct until those external proofs pass.

See `DEPLOYMENT_HANDOFF.md`, `LAUNCH_CHECKLIST.md` and `REGULATORY_CONTENT_MANIFEST.md`.


## Production payment rail

FAISReady now has a provider-neutral application layer with selectable payment rails:

- `ikhokha` — intended production rail through the iK Pay API.
- `payfast` — proven sandbox/fallback rail.
- `izakhono` — optional IZAKHONO PAY orchestration route.

The native launch manifests start `revenue_server_gateway.py`, which selects the rail from `FAISREADY_PAYMENT_PROVIDER` without changing the course-entitlement ledger.

For iKhokha, FAISReady creates a payment link with a signed iK Pay API request. The public callback is treated only as a trigger. Before any course entitlement is granted, FAISReady performs a signed server-to-server iKhokha payment-status lookup and requires:

- the known FAISReady order to match the stored paylink;
- iKhokha status `PAID`;
- the returned paylink ID to match;
- the returned amount in cents to equal the server-side order amount.

### Revenue activation sequence

1. Run `START-FAISREADY-SANDBOX.cmd` and prove the native owner-host + public sandbox path.
2. Configure the named tunnel and `PUBLIC_BASE_URL=https://faisready.co.za`.
3. Run `START-FAISREADY-LIVE.cmd` with `IKHOKHA_LIVE_APPROVED=false`. This proves the stable public hostname while checkout stays locked.
4. Add the authorised iKhokha App ID and App Key to `FAISReady/.env.local`.
5. Set `IKHOKHA_LIVE_APPROVED=true` only for one controlled transaction.
6. Verify the paid entitlement and run the backup/restore receipt.
7. Only after those proofs pass should broader promotion begin.

No API key, tunnel token, payment credential or live SQLite database belongs in Git.
