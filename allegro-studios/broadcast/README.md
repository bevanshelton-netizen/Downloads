# ALLEGRO VIBEZ Broadcast Node

This directory defines the production broadcast layer for an IZAKHONO-owned node.

## Architecture

- **Audio transport:** Icecast-compatible HTTP stream
- **Source/encoder:** Liquidsoap or equivalent long-running broadcaster
- **Catalogue/control plane:** Supabase
- **Public player:** `../radio.html`
- **Metadata:** broadcaster publishes current artist/title to the stream
- **Health:** node process + stream endpoint monitored independently

## Production rule

Do not publish a fake or third-party stream URL. The public player remains silent until a verified ALLEGRO VIBEZ stream endpoint is configured.

## Required node inputs

- A verified IZAKHONO-owned Linux host
- Persistent storage for approved broadcast media
- A DNS name for the stream endpoint
- Stream password/credentials stored as server secrets
- A verified public TCP endpoint for listeners

Once the node is available, deploy the broadcaster and expose an Icecast-compatible mount such as `/allegro-vibez.mp3`, then connect that verified URL to the public player.
