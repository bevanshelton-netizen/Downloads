#!/usr/bin/env python3
"""IZAKHONO CLOUD v1.15 deployment-plane planner.

This module validates a project manifest and produces a deterministic deployment
proposal. It deliberately does not start containers, expose ports, modify DNS,
or promote public traffic. Runtime execution remains behind the existing
owner-node READY and execution-permit controls.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,62}$")
ALLOWED_HEALTH_PREFIXES = ("/",)
MAX_PORT = 65535


def canonical_json(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def fail(message: str) -> None:
    raise ValueError(message)


def load_manifest(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        fail(f"manifest not found: {path}")
    except json.JSONDecodeError as exc:
        fail(f"invalid JSON: {exc}")
    if not isinstance(data, dict):
        fail("manifest must be a JSON object")
    return data


def validate_manifest(m: dict) -> dict:
    required = ["name", "slug", "build_context", "dockerfile_path", "container_port", "health_path", "branch"]
    missing = [k for k in required if k not in m]
    if missing:
        fail("missing required fields: " + ", ".join(missing))

    if not isinstance(m["name"], str) or not m["name"].strip():
        fail("name must be a non-empty string")
    if not isinstance(m["slug"], str) or not SLUG_RE.fullmatch(m["slug"]):
        fail("slug must be lowercase letters, digits, and hyphens only")
    if not isinstance(m["build_context"], str) or m["build_context"].startswith("/") or ".." in Path(m["build_context"]).parts:
        fail("build_context must be a safe repository-relative path")
    if not isinstance(m["dockerfile_path"], str) or m["dockerfile_path"].startswith("/") or ".." in Path(m["dockerfile_path"]).parts:
        fail("dockerfile_path must be a safe repository-relative path")
    if not isinstance(m["container_port"], int) or not (1 <= m["container_port"] <= MAX_PORT):
        fail("container_port must be an integer from 1 to 65535")
    if not isinstance(m["health_path"], str) or not m["health_path"].startswith(ALLOWED_HEALTH_PREFIXES):
        fail("health_path must begin with /")
    if not isinstance(m["branch"], str) or not m["branch"].strip():
        fail("branch must be a non-empty string")

    alpha = m.get("alpha", {})
    if alpha is not None and not isinstance(alpha, dict):
        fail("alpha must be an object when present")

    return {
        "name": m["name"].strip(),
        "slug": m["slug"],
        "build_context": m["build_context"],
        "dockerfile_path": m["dockerfile_path"],
        "container_port": m["container_port"],
        "health_path": m["health_path"],
        "branch": m["branch"].strip(),
        "alpha": alpha or {},
    }


def build_plan(m: dict) -> dict:
    normalized = validate_manifest(m)
    manifest_sha256 = hashlib.sha256(canonical_json(normalized)).hexdigest()
    image_tag = f"izakhono/{normalized['slug']}:{manifest_sha256[:16]}"

    plan = {
        "schema": "izakhono.deploy-plan/v1",
        "project": normalized["slug"],
        "manifest_sha256": manifest_sha256,
        "source": {
            "branch": normalized["branch"],
            "build_context": normalized["build_context"],
            "dockerfile_path": normalized["dockerfile_path"],
        },
        "build": {
            "image_tag": image_tag,
            "immutable_digest_required_before_execution": True,
            "secrets_embedded_in_image": False,
        },
        "runtime": {
            "container_port": normalized["container_port"],
            "health_path": normalized["health_path"],
            "public_port_published": False,
            "host_mounts_allowed": False,
            "privileged": False,
            "read_only_rootfs": True,
            "cap_drop_all": True,
            "no_new_privileges": True,
        },
        "promotion": {
            "automatic_public_promotion": False,
            "requires_ready_node": True,
            "requires_signed_execution_permit": True,
            "requires_health_pass": True,
            "requires_explicit_owner_activation": True,
        },
        "truth_boundary": {
            "plan_only": True,
            "workload_executed": False,
            "public_ready": False,
            "commercial_ready": False,
        },
    }
    plan["plan_sha256"] = hashlib.sha256(canonical_json(plan)).hexdigest()
    return plan


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate a fail-closed IZAKHONO CLOUD deployment proposal")
    parser.add_argument("manifest", type=Path, help="Path to .izakhono.json")
    parser.add_argument("--out", type=Path, help="Optional output JSON file")
    args = parser.parse_args()

    try:
        plan = build_plan(load_manifest(args.manifest))
    except ValueError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    rendered = json.dumps(plan, indent=2, sort_keys=True) + "\n"
    if args.out:
        args.out.write_text(rendered, encoding="utf-8")
    else:
        sys.stdout.write(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
