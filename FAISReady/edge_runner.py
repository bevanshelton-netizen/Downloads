#!/usr/bin/env python3
"""FAISReady edge runner for the IZAKHONO CLOUD launch bridge.

Modes:
- quick-sandbox: creates a temporary TryCloudflare URL for a real public
  PayFast sandbox proof. This is development/testing only and never production.
- named: runs an already configured remotely-managed Cloudflare Tunnel using
  TUNNEL_TOKEN or TUNNEL_TOKEN_FILE from the environment. The token is never
  placed on the command line.

The application itself is started through the v1.17 Launch Bridge module and
remains loopback-only. Public HTTPS health is independently checked before a
proof receipt is written. A successful edge proof is still not a commercial-
readiness claim; a real payment and recovery drill remain separate gates.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
import queue
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent
REPO_ROOT = APP_DIR.parent
BRIDGE_PATH = REPO_ROOT / "izakhono-cloud" / "launch-bridge.py"
QUICK_URL_RE = re.compile(r"https://[a-z0-9-]+\.trycloudflare\.com", re.I)
PUBLIC_SANDBOX = {
    "PAYFAST_MERCHANT_ID": "10000100",
    "PAYFAST_MERCHANT_KEY": "46f0cd694581a",
    "PAYFAST_PASSPHRASE": "jt7NOE43FZPn",
    "PAYFAST_SANDBOX": "true",
}


def load_bridge():
    spec = importlib.util.spec_from_file_location("izakhono_launch_bridge", BRIDGE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("unable to load IZAKHONO launch bridge")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def manifest_path() -> Path:
    name = ".izakhono-launch-windows.json" if os.name == "nt" else ".izakhono-launch-linux.json"
    return APP_DIR / name


def cloudflared_command(mode: str) -> list[str]:
    exe = shutil.which("cloudflared") or shutil.which("cloudflared.exe")
    if not exe:
        raise RuntimeError("cloudflared is not installed or not on PATH")
    if mode == "quick-sandbox":
        return [exe, "tunnel", "--url", "http://127.0.0.1:18091"]
    if mode == "named":
        return [exe, "tunnel", "run"]
    raise RuntimeError("unknown edge mode")


def token_configured() -> bool:
    return bool(os.environ.get("TUNNEL_TOKEN", "").strip() or os.environ.get("TUNNEL_TOKEN_FILE", "").strip())


def start_cloudflared(mode: str) -> subprocess.Popen[str]:
    if mode == "named" and not token_configured():
        raise RuntimeError("named mode requires TUNNEL_TOKEN or TUNNEL_TOKEN_FILE in the environment")
    env = os.environ.copy()
    return subprocess.Popen(
        cloudflared_command(mode),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        stdin=subprocess.DEVNULL,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=env,
        creationflags=(getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0) if os.name == "nt" else 0),
        start_new_session=(os.name != "nt"),
    )


def stop_process(process: subprocess.Popen) -> None:
    if process.poll() is not None:
        return
    try:
        if os.name == "nt":
            process.send_signal(getattr(signal, "CTRL_BREAK_EVENT", signal.SIGTERM))
        else:
            os.killpg(process.pid, signal.SIGTERM)
        process.wait(timeout=5)
    except Exception:
        try:
            process.kill()
            process.wait(timeout=3)
        except Exception:
            pass


def stream_lines(process: subprocess.Popen[str], out: queue.Queue[str]) -> None:
    if process.stdout is None:
        return
    for line in process.stdout:
        out.put(line.rstrip("\r\n"))


def wait_quick_url(process: subprocess.Popen[str], lines: queue.Queue[str], timeout: int) -> str:
    deadline = time.monotonic() + timeout
    seen: list[str] = []
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError("cloudflared exited before publishing a Quick Tunnel")
        try:
            line = lines.get(timeout=0.25)
        except queue.Empty:
            continue
        seen.append(line)
        match = QUICK_URL_RE.search(line)
        if match:
            return match.group(0).rstrip("/")
    tail = " | ".join(seen[-4:])
    raise RuntimeError("timed out waiting for TryCloudflare URL" + (f": {tail}" if tail else ""))


def verify_https(base_url: str, timeout: int) -> dict:
    url = base_url.rstrip("/") + "/health"
    deadline = time.monotonic() + timeout
    last = "not attempted"
    while time.monotonic() < deadline:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "IZAKHONO-External-Proof/1.0"})
            with urllib.request.urlopen(req, timeout=6) as response:
                body = response.read(4096)
                if 200 <= response.status < 300:
                    parsed = json.loads(body.decode("utf-8"))
                    if parsed.get("ok") is True and parsed.get("service") == "faisready-revenue":
                        return {"url": url, "status": response.status, "body": parsed}
                last = f"unexpected response status={response.status}"
        except (urllib.error.URLError, TimeoutError, OSError, ValueError, json.JSONDecodeError) as exc:
            last = str(exc)
        time.sleep(1)
    raise RuntimeError(f"public HTTPS health verification failed: {last}")


def read_local_config() -> dict:
    with urllib.request.urlopen("http://127.0.0.1:18091/api/config", timeout=4) as response:
        return json.loads(response.read(16384).decode("utf-8"))


def make_plan(bridge) -> dict:
    raw = bridge.load_json(manifest_path())
    return bridge.build_plan(raw, manifest_path())


def write_receipt(path: Path, bridge, plan: dict, mode: str, base_url: str, https_proof: dict, app_pid: int, config: dict) -> dict:
    receipt = {
        "schema": "izakhono.edge-proof/v1",
        "project": "faisready",
        "mode": mode,
        "bridge_plan_sha256": plan["plan_sha256"],
        "origin": "http://127.0.0.1:18091",
        "public_base_url": base_url,
        "public_https_health_verified": True,
        "https_health": {"url": https_proof["url"], "status": https_proof["status"]},
        "payments_configured": bool(config.get("payments_configured")),
        "payfast_sandbox": bool(config.get("payfast_sandbox")),
        "docker_used": False,
        "public_origin_ip_required": False,
        "app_pid_recorded": app_pid,
        "quick_tunnel_production_allowed": False,
        "real_payment_verified": False,
        "backup_restore_verified": False,
        "commercial_ready": False,
    }
    receipt["receipt_sha256"] = bridge.digest(receipt)
    path.write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return receipt


def temporarily_set(values: dict[str, str]):
    previous = {key: os.environ.get(key) for key in values}
    os.environ.update(values)
    return previous


def restore_env(previous: dict[str, str | None]) -> None:
    for key, value in previous.items():
        if value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = value


def run(args: argparse.Namespace) -> int:
    bridge = load_bridge()
    plan = make_plan(bridge)
    bridge.validate_plan(plan)
    edge: subprocess.Popen[str] | None = None
    app: subprocess.Popen | None = None
    previous: dict[str, str | None] = {}
    lines: queue.Queue[str] = queue.Queue()
    try:
        if args.mode == "quick-sandbox":
            edge = start_cloudflared(args.mode)
            threading.Thread(target=stream_lines, args=(edge, lines), daemon=True).start()
            base_url = wait_quick_url(edge, lines, args.edge_timeout)
            settings = {
                "PUBLIC_BASE_URL": base_url,
                "FAISREADY_TRUST_CLOUDFLARE": "true",
                "PAYFAST_SANDBOX": "true",
            }
            if args.public_payfast_sandbox:
                settings.update(PUBLIC_SANDBOX)
            previous = temporarily_set(settings)
        else:
            base_url = os.environ.get("PUBLIC_BASE_URL", "").strip().rstrip("/")
            if not base_url:
                raise RuntimeError("named mode requires PUBLIC_BASE_URL")
            if not base_url.startswith("https://"):
                raise RuntimeError("named mode requires an HTTPS PUBLIC_BASE_URL")
            previous = temporarily_set({"FAISREADY_TRUST_CLOUDFLARE": "true"})

        app = bridge.start_process(plan, REPO_ROOT)
        bridge.wait_health(plan, app)

        if args.mode == "named":
            edge = start_cloudflared(args.mode)
            threading.Thread(target=stream_lines, args=(edge, lines), daemon=True).start()

        proof = verify_https(base_url, args.https_timeout)
        config = read_local_config()
        receipt_path = Path(args.receipt) if args.receipt else (Path(tempfile.gettempdir()) / "faisready-edge-proof.json")
        receipt = write_receipt(receipt_path, bridge, plan, args.mode, base_url, proof, app.pid, config)
        print(json.dumps(receipt, indent=2, sort_keys=True))
        print(f"proof_receipt={receipt_path}")
        if args.mode == "quick-sandbox":
            print("Quick Tunnel is development/testing only; do not use this URL as the production storefront.")
        if args.proof_only:
            return 0

        while True:
            if app.poll() is not None:
                raise RuntimeError(f"FAISReady application exited with code {app.returncode}")
            if edge is not None and edge.poll() is not None:
                raise RuntimeError(f"cloudflared exited with code {edge.returncode}")
            time.sleep(1)
    except KeyboardInterrupt:
        return 0
    finally:
        if app is not None:
            bridge.stop_process(app)
        if edge is not None:
            stop_process(edge)
        restore_env(previous)


def self_test() -> int:
    bridge = load_bridge()
    plan = make_plan(bridge)
    bridge.validate_plan(plan)
    assert plan["project"] == "faisready"
    assert plan["runtime"]["listen_host"] == "127.0.0.1"
    assert plan["runtime"]["docker_required"] is False
    assert plan["runtime"]["public_ip_required"] is False
    sample = "2026-09-01T00:00:00Z INF +https://bright-example.trycloudflare.com ready"
    assert QUICK_URL_RE.search(sample).group(0) == "https://bright-example.trycloudflare.com"
    assert PUBLIC_SANDBOX["PAYFAST_SANDBOX"] == "true"
    # Named mode must never require putting the tunnel token in argv.
    fake = "/usr/bin/cloudflared"
    original_which = shutil.which
    try:
        shutil.which = lambda name: fake if name in {"cloudflared", "cloudflared.exe"} else None
        assert cloudflared_command("named") == [fake, "tunnel", "run"]
        assert "token" not in " ".join(cloudflared_command("named")).lower()
        assert cloudflared_command("quick-sandbox")[-1] == "http://127.0.0.1:18091"
    finally:
        shutil.which = original_which
    print("FAISReady edge runner self-test: PASS")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="FAISReady IZAKHONO edge runner")
    parser.add_argument("--mode", choices=["quick-sandbox", "named"], default="quick-sandbox")
    parser.add_argument("--public-payfast-sandbox", action="store_true", help="use PayFast's public sandbox merchant credentials for a test transaction")
    parser.add_argument("--proof-only", action="store_true", help="verify public HTTPS then clean up both processes")
    parser.add_argument("--edge-timeout", type=int, default=45)
    parser.add_argument("--https-timeout", type=int, default=60)
    parser.add_argument("--receipt")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        return self_test()
    if args.public_payfast_sandbox and args.mode != "quick-sandbox":
        parser.error("--public-payfast-sandbox is only valid with --mode quick-sandbox")
    try:
        return run(args)
    except (RuntimeError, ValueError, OSError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
