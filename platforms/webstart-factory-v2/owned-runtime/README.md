# IZAKHONO WebStart — Owned Runtime

This is the owned-first delivery route for WebStart.

## Endpoints
- Builder: `/` or `/builder`
- Published customer site: `/<slug>`
- Health: `/health`

## Environment
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Only the publishable key is used by the delivery runtime. No service-role secret belongs in this container.

## Start
```bash
docker compose up -d --build
curl -fsS http://127.0.0.1:8288/health
```

## Public cutover
1. Replace `webstart.example.com` in the Caddyfile with the owned hostname.
2. Point DNS to the owned public endpoint.
3. Add the Caddyfile to the owned EDGE/TLS service.
4. Verify HTTPS returns 200 for `/health`, `/`, and one published `/<slug>`.
5. Only after successful verification make the owned route primary.
6. Keep the external Vercel renderer as a reversible fallback.

Generated sites do not need to be rebuilt when switching renderer routes.
