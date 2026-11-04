# ALLEGRO VIBEZ Broadcast Node

This directory defines the continuous broadcast service intended for an IZAKHONO-owned Linux node.

## Runtime

- **Engine:** Liquidsoap 2.4.x
- **Audio transport:** Liquidsoap Harbor HTTP output (Icecast/Shoutcast-style listener endpoint)
- **Mount:** `/allegro-vibez.mp3`
- **Listener port:** TCP 8000
- **Media:** approved audio files mounted read-only from `./media`
- **Public player:** `../radio.html`
- **Control plane:** Supabase remains responsible for identity, rights, catalogue, programming and moderation.

The listener output is served directly by Liquidsoap. This avoids an unnecessary second streaming daemon for the initial single-station deployment. A dedicated Icecast server can be introduced later if relay, mount-level administration or larger multi-station routing requires it.

## Start on the broadcast host

1. Install Docker Engine and the Docker Compose plugin.
2. Create the `media/` directory beside this file and place only audio cleared for broadcast inside it.
3. Start the service from this directory:

   ```sh
   docker compose pull
   docker compose up -d
   docker compose logs -f broadcaster
   ```

4. From a machine that can reach the host, verify the stream responds:

   ```sh
   curl -I http://HOSTNAME-OR-IP:8000/allegro-vibez.mp3
   ```

5. Configure DNS and HTTPS at the network edge/reverse proxy, then test playback from an external network before connecting the public player.

## Production rules

- Do not publish a fake or third-party stream URL.
- Do not place copyrighted or unlicensed music in the media directory.
- Keep the host firewall closed except for the required listener port and secured administration access.
- Do not expose Docker control sockets or the host's SSH service to the public internet.
- Keep secrets and private operator credentials out of this repository.
- The public player remains in pending state until a real stream endpoint is externally verified.

## Required production inputs

- A verified IZAKHONO-owned Linux host with adequate upload bandwidth.
- Persistent disk for approved broadcast media.
- A DNS name for the stream endpoint.
- A public listener route, preferably HTTPS through a reverse proxy.
- An operational monitoring target for process health and external stream availability.

## Current limitation

The repository contains the deployment definition and Liquidsoap playlist script. They have not yet been run on an IZAKHONO-owned host. No live stream URL is claimed until deployment and external playback checks pass.
