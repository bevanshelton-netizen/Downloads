# AUTO AI on IZAKHONO OWNED CLOUD

AUTO AI is deployed through **IZAKHONO RUNTIME NODE** and exposed through **IZAKHONO EDGE NODE**.

Production hostname:

`autoai.izakhonoafrica.co.za`

## Deploy

On the owned Linux cloud node:

```bash
cd /path/to/Downloads
sudo bash izakhono-owned-cloud/deploy-auto-ai.sh main
```

The deployment script:

- verifies RUNTIME NODE health;
- resolves the requested source revision;
- stages an immutable release below `/var/lib/izakhono-runtime/releases/auto-ai/`;
- registers the hostname with RUNTIME NODE;
- starts `node server.mjs`;
- requires `/api/health` to pass before activation;
- atomically switches the active route;
- tests the hostname through the runtime proxy;
- tests EDGE locally when EDGE is installed;
- never changes public DNS and never provisions paid infrastructure.

Optional AUTO AI AI-gateway settings remain in:

`/etc/izakhono/apps/auto-ai.env`

Secrets are never committed.

## Public cutover gate

Customer traffic should move from the temporary Vercel fallback only after all three are proven:

1. RUNTIME health passes for AUTO AI;
2. EDGE serves the AUTO AI hostname with valid TLS;
3. public DNS for `autoai.izakhonoafrica.co.za` points to the owned edge IP and resolves externally.

Until then, Vercel remains fallback only.
