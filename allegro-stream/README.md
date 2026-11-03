# ALLEGRO VIBEZ — Independent Broadcast Server

This is the Vercel-independent broadcast layer for ALLEGRO VIBEZ.

## Architecture

`ALLEGRO STUDIOS / Supabase control plane → Liquidsoap → Icecast → Caddy TLS → radio.allegrovibez.com`

The repository contains no passwords, API keys, or stream credentials. Production secrets belong in the server environment.

## Server requirements

- Linux VPS or IZAKHONO-owned server
- Docker + Docker Compose plugin
- Public DNS record: `radio.allegrovibez.com` → server IP
- TCP 80/443 exposed for Caddy
- TCP 8000 kept private behind Caddy where possible
- Persistent storage for `/srv/media`

## First deployment

1. Copy `.env.example` to `.env` and set strong values.
2. Put licensed broadcast audio in `/srv/media` on the server.
3. Start with `docker compose up -d`.
4. Verify Icecast locally before publishing the public URL.
5. Point `radio.allegrovibez.com` to the server.
6. Confirm Caddy obtains TLS.
7. Connect the verified stream URL to `allegro-studios/radio.html`.

## Stream endpoint

The intended public endpoint is:

`https://radio.allegrovibez.com/live.mp3`

It must not be advertised as live until the server, DNS, TLS and audio stream have all been verified.

## Content rights

Only broadcast music and programmes for which ALLEGRO has the necessary rebroadcast/public-performance rights. A track being free to listen to does not automatically make it legal to rebroadcast commercially.
