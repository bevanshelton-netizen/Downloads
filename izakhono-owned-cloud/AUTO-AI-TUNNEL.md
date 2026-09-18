# AUTO AI public ingress on IZAKHONO-owned hosting

AUTO AI application compute stays on IZAKHONO RUNTIME NODE and all application requests pass through IZAKHONO EDGE NODE.

For a node behind home/office NAT, the recommended public ingress is a **Cloudflare Tunnel**. Cloudflare is only the external tunnel/DNS front door; AUTO AI is not hosted on Vercel.

## Cloudflare route

Create a remotely managed tunnel and add this Published Application:

- Hostname: `autoai.izakhonoafrica.co.za`
- Service URL: `http://localhost:8780`

Copy the tunnel token into a local text file on the owner machine. Do **not** paste it into GitHub, source code, chat, or an advert.

Then use:

```bash
sudo bash izakhono-owned-cloud/configure-auto-ai-tunnel.sh /path/to/token-file
```

The script stores the token in `/etc/izakhono/tunnel/auto-ai.token` with restricted permissions and runs `cloudflared` with `--token-file`. It switches IZAKHONO EDGE to tunnel mode, verifies the local origin, and only declares public readiness if the branded HTTPS hostname returns AUTO AI health through the `x-izakhono-edge: 1` path.

If the public hostname is not ready, it exits without changing customer links.
