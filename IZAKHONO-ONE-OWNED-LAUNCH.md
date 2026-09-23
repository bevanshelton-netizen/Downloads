# IZAKHONO ONE — One-click owned launch

Canonical owner-machine entry point:

START-IZAKHONO-ONE-OWNED-LAUNCH.cmd

The launcher performs the approved owned-first sequence:

1. Ensures the Windows owner host and Ubuntu 24.04 core exist.
2. Installs or refreshes the allow-listed IZAKHONO Owner Agent.
3. Activates the approved local model path.
4. Configures and deploys IZAKHONO ONE through AI Gateway -> GPU Compute -> Model Worker -> local model engine.
5. Runs the authoritative IZAKHONO ONE deployment-readiness preflight.
6. Writes IZAKHONO-ONE-OWNED-LAUNCH-STATUS.txt to the Windows Desktop.

The external GitHub Pages and Vercel resilience routes are not changed by this launcher.

If Windows Subsystem for Linux or Virtual Machine Platform is being installed for the first time, Windows may require a restart. In that case the launcher records WINDOWS RESTART REQUIRED and the same command should be run again after Windows restarts.

Status discipline:

- Local runtime health is not enough for a live claim.
- Public signup remains disabled until SMTP verification and recovery delivery are proven.
- The owned route is not called VERIFIED LIVE until independent public HTTPS verification proves the intended IZAKHONO ONE experience.
- Commercial readiness remains separate from the free/public technical pilot.
