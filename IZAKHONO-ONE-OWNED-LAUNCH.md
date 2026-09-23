# IZAKHONO ONE — One-click owned launch

Canonical owner-machine entry point:

START-IZAKHONO-ONE-OWNED-LAUNCH.cmd

The launcher performs the approved owned-first sequence:

1. Ensures the Windows owner host and Ubuntu 24.04 core exist.
2. Installs or refreshes the allow-listed IZAKHONO Owner Agent.
3. Activates the approved local model path.
4. Configures and deploys IZAKHONO ONE through AI Gateway -> GPU Compute -> Model Worker -> local model engine.
5. Activates or stages the owned DNS/TLS/EDGE path for `one.domains.izakhonoafrica.co.za`.
6. Writes `IZAKHONO-ONE-OWNED-EDGE.json` with the public IP, delegation, TLS, EDGE and required inbound-port evidence.
7. Runs the authoritative IZAKHONO ONE deployment-readiness preflight.
8. Writes `IZAKHONO-ONE-OWNED-LAUNCH-STATUS.txt` to the Windows Desktop.

The launcher reads the current allow-listed activation request ID from `owner-host/control/desired-state.json`; it does not hard-code an obsolete request ID.

If parent delegation or router forwarding is still missing, the launcher records a safe hold and continues to the readiness report. It does not disable the external route.

The external GitHub Pages, Supabase and Vercel resilience routes are not changed by this launcher.

If Windows Subsystem for Linux or Virtual Machine Platform is being installed for the first time, Windows may require a restart. In that case the launcher records WINDOWS RESTART REQUIRED and the same command should be run again after Windows restarts.

Status discipline:

- Local runtime health is not enough for a live claim.
- Public signup remains disabled until SMTP verification and recovery delivery are proven.
- The owned route is not called VERIFIED LIVE until independent public HTTPS verification proves the intended IZAKHONO ONE experience.
- Commercial readiness remains separate from the free/public technical pilot.
