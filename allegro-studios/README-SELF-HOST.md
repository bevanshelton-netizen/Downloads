# ALLEGRO STUDIOS — Self-Hosted Deployment

ALLEGRO STUDIOS is designed to run independently of Vercel.

## Static site

The `allegro-studios/` directory is a static website. It can be served by Nginx, Apache, Caddy, Cloudflare Pages, GitHub Pages, or any ordinary web server.

Recommended production layout:

- `/` → `index.html`
- `/radio.html` → ALLEGRO VIBEZ radio experience
- HTTPS termination at the reverse proxy
- DNS for `studio.allegrovibez.com` pointed at the chosen server

## Existing backend

The booking and creator enquiry forms currently call the existing Supabase Edge Functions. The site therefore does not require Vercel Functions.

## Radio

`radio.html` deliberately does not contain an unverified stream URL. Connect the official ALLEGRO VIBEZ Icecast/Shoutcast-compatible stream endpoint when the station stream is provisioned.

## Deployment principle

Build once from Git, then deploy the same static artifact to IZAKHONO-owned infrastructure. Vercel is not required for runtime hosting.
