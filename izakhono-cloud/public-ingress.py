#!/usr/bin/env python3
"""IZAKHONO CLOUD v1.16 public ingress planner + verifier.

The planner is deterministic and makes no host/network changes. The verifier is
read-only and can independently prove that a hostname serves HTTPS and the
expected health path. Public promotion remains an explicit owner-node action.
"""
from __future__ import annotations

import argparse
import hashlib
import ipaddress
import json
import re
import socket
import ssl
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

HOST_RE = re.compile(r"^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$")
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")


def canon(v: object) -> bytes:
    return json.dumps(v, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def digest(v: object) -> str:
    return hashlib.sha256(canon(v)).hexdigest()


def fail(msg: str) -> None:
    raise ValueError(msg)


def valid_hostname(host: str) -> str:
    h = host.strip().lower().rstrip(".")
    if h.startswith("*.") or not HOST_RE.fullmatch(h):
        fail("hostname must be a concrete public DNS name, not a wildcard/IP/localhost")
    if h.endswith((".local", ".localhost", ".internal")):
        fail("private-only hostname is not eligible for public ingress")
    return h


def valid_health(path: str) -> str:
    if not path.startswith("/") or "\n" in path or "\r" in path or " " in path:
        fail("health path must be a simple absolute HTTP path")
    return path


def valid_sha(value: str, label: str) -> str:
    v = value.lower().strip()
    if not SHA256_RE.fullmatch(v):
        fail(f"{label} must be a lowercase SHA-256 hex digest")
    return v


def valid_target_ip(value: str | None) -> str | None:
    if value is None:
        return None
    ip = ipaddress.ip_address(value)
    if not ip.is_global:
        fail("target IP must be globally routable")
    return str(ip)


def caddy_block(host: str, upstream_port: int, health_path: str) -> str:
    return f"""{host} {{
    encode zstd gzip
    header {{
        Strict-Transport-Security \"max-age=31536000; includeSubDomains\"
        X-Content-Type-Options \"nosniff\"
        Referrer-Policy \"strict-origin-when-cross-origin\"
    }}
    reverse_proxy 127.0.0.1:{upstream_port} {{
        health_uri {health_path}
        health_interval 10s
        health_timeout 3s
    }}
}}
"""


def make_plan(args: argparse.Namespace) -> dict:
    host = valid_hostname(args.hostname)
    health = valid_health(args.health_path)
    receipt = valid_sha(args.deployment_receipt_sha256, "deployment receipt")
    if not (1024 <= args.upstream_port <= 65535):
        fail("upstream port must be between 1024 and 65535")
    target_ip = valid_target_ip(args.target_ip)
    cfg = caddy_block(host, args.upstream_port, health)
    plan = {
        "schema": "izakhono.public-ingress/v1",
        "project": args.project,
        "hostname": host,
        "deployment_receipt_sha256": receipt,
        "upstream": {"host": "127.0.0.1", "port": args.upstream_port, "health_path": health},
        "dns": {
            "expected_target_ip": target_ip,
            "must_resolve_before_apply": True,
            "automatic_dns_mutation": False,
        },
        "tls": {
            "provider": "caddy_acme",
            "minimum_version": "TLSv1.2",
            "automatic_certificate_request_after_apply": True,
        },
        "route_config": cfg,
        "promotion": {
            "requires_owner_ready_marker": True,
            "requires_explicit_public_ingress_activation": True,
            "requires_local_health_pass": True,
            "requires_external_https_verification": True,
            "rollback_on_https_failure": True,
        },
        "truth_boundary": {
            "planned_only": True,
            "dns_changed": False,
            "tls_issued": False,
            "public_traffic_promoted": False,
            "public_ready": False,
            "commercial_ready": False,
        },
    }
    plan["route_config_sha256"] = hashlib.sha256(cfg.encode()).hexdigest()
    plan["plan_sha256"] = digest(plan)
    return plan


def resolve(host: str) -> list[str]:
    ips = sorted({x[4][0] for x in socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)})
    return ips


def verify_https(host: str, health: str, expected_ip: str | None, timeout: float) -> dict:
    resolved = resolve(host)
    if expected_ip and expected_ip not in resolved:
        fail(f"DNS mismatch: expected {expected_ip}, got {resolved}")
    ctx = ssl.create_default_context()
    with socket.create_connection((host, 443), timeout=timeout) as raw:
        with ctx.wrap_socket(raw, server_hostname=host) as tls:
            cert = tls.getpeercert()
            tls_version = tls.version()
            cipher = tls.cipher()[0] if tls.cipher() else None
    req = urllib.request.Request(f"https://{host}{health}", headers={"User-Agent": "IZAKHONO-CLOUD-verifier/1.16"})
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
            status = r.status
            body = r.read(4096)
    except urllib.error.HTTPError as e:
        status = e.code
        body = e.read(4096)
    if not (200 <= status < 400):
        fail(f"HTTPS health verification failed with status {status}")
    proof = {
        "schema": "izakhono.public-https-proof/v1",
        "hostname": host,
        "verified_at": datetime.now(timezone.utc).isoformat(),
        "resolved_ips": resolved,
        "expected_ip": expected_ip,
        "tls_version": tls_version,
        "cipher": cipher,
        "certificate_subject": cert.get("subject"),
        "certificate_issuer": cert.get("issuer"),
        "certificate_not_after": cert.get("notAfter"),
        "health_path": health,
        "health_status": status,
        "health_body_sha256": hashlib.sha256(body).hexdigest(),
        "public_https_verified": True,
        "commercial_ready": False,
    }
    proof["proof_sha256"] = digest(proof)
    return proof


def write(v: dict, out: Path | None) -> None:
    text = json.dumps(v, indent=2, sort_keys=True) + "\n"
    if out:
        out.write_text(text, encoding="utf-8")
    else:
        sys.stdout.write(text)


def main() -> int:
    p = argparse.ArgumentParser()
    sp = p.add_subparsers(dest="cmd", required=True)
    plan = sp.add_parser("plan")
    plan.add_argument("--project", required=True)
    plan.add_argument("--hostname", required=True)
    plan.add_argument("--upstream-port", required=True, type=int)
    plan.add_argument("--health-path", default="/health")
    plan.add_argument("--deployment-receipt-sha256", required=True)
    plan.add_argument("--target-ip")
    plan.add_argument("--out", type=Path)
    ver = sp.add_parser("verify")
    ver.add_argument("--hostname", required=True)
    ver.add_argument("--health-path", default="/health")
    ver.add_argument("--expected-ip")
    ver.add_argument("--timeout", type=float, default=8.0)
    ver.add_argument("--out", type=Path)
    args = p.parse_args()
    try:
        if args.cmd == "plan":
            write(make_plan(args), args.out)
        else:
            host = valid_hostname(args.hostname)
            health = valid_health(args.health_path)
            ip = valid_target_ip(args.expected_ip)
            write(verify_https(host, health, ip, args.timeout), args.out)
    except (ValueError, OSError, ssl.SSLError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
