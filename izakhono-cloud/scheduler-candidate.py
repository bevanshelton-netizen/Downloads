#!/usr/bin/env python3
"""IZAKHONO CLOUD v1.8 placement scheduler candidate.

This module can rank verified owner-controlled nodes and emit a placement
proposal. It deliberately cannot deploy, start, stop, migrate, or fail over
workloads. A proposal is advisory until real-machine promotion gates exist.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

SCHEMA = "izakhono.scheduler-candidate.v1"


def die(message: str) -> "NoReturn":
    raise SystemExit(f"ERROR: {message}")


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        die(f"cannot read {path}: {exc}")


def positive_int(value: Any, field: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value <= 0:
        die(f"{field} must be a positive integer")
    return value


def validate_workload(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        die("workload must be a JSON object")
    allowed = {"workload_id", "cpu_millicores", "memory_mb", "disk_mb", "architecture", "labels"}
    extra = sorted(set(raw) - allowed)
    if extra:
        die(f"unsupported workload fields: {', '.join(extra)}")
    workload_id = raw.get("workload_id")
    if not isinstance(workload_id, str) or not workload_id.strip():
        die("workload_id is required")
    architecture = raw.get("architecture", "any")
    if architecture not in {"any", "x86_64", "amd64", "aarch64", "arm64"}:
        die("unsupported workload architecture")
    labels = raw.get("labels", [])
    if not isinstance(labels, list) or any(not isinstance(v, str) or not v for v in labels):
        die("labels must be a list of non-empty strings")
    return {
        "workload_id": workload_id,
        "cpu_millicores": positive_int(raw.get("cpu_millicores"), "cpu_millicores"),
        "memory_mb": positive_int(raw.get("memory_mb"), "memory_mb"),
        "disk_mb": positive_int(raw.get("disk_mb"), "disk_mb"),
        "architecture": architecture,
        "labels": sorted(set(labels)),
    }


def normalize_arch(value: str) -> str:
    return {"amd64": "x86_64", "arm64": "aarch64"}.get(value, value)


def validate_node(raw: Any) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    node_id = raw.get("node_id")
    if not isinstance(node_id, str) or not node_id.startswith("izn-"):
        return None
    if raw.get("signature_verified") is not True:
        return None
    if raw.get("controller_authenticated") is not True:
        return None
    if raw.get("trust_state") != "candidate":
        return None
    if raw.get("proof_state") not in {"local_ready", "runtime_ready"}:
        return None
    if raw.get("healthy") is not True:
        return None
    # Candidate scheduler explicitly refuses nodes already asserting live/schedulable state.
    if raw.get("schedulable") is not False or raw.get("public_ready") is not False:
        return None
    arch = raw.get("architecture")
    if arch not in {"x86_64", "amd64", "aarch64", "arm64"}:
        return None
    labels = raw.get("labels", [])
    if not isinstance(labels, list) or any(not isinstance(v, str) or not v for v in labels):
        return None
    capacities: dict[str, int] = {}
    for field in ("free_cpu_millicores", "free_memory_mb", "free_disk_mb"):
        value = raw.get(field)
        if not isinstance(value, int) or isinstance(value, bool) or value < 0:
            return None
        capacities[field] = value
    return {
        "node_id": node_id,
        "architecture": normalize_arch(arch),
        "labels": set(labels),
        **capacities,
    }


def fits(node: dict[str, Any], workload: dict[str, Any]) -> bool:
    wanted_arch = normalize_arch(workload["architecture"])
    if wanted_arch != "any" and node["architecture"] != wanted_arch:
        return False
    if not set(workload["labels"]).issubset(node["labels"]):
        return False
    return (
        node["free_cpu_millicores"] >= workload["cpu_millicores"]
        and node["free_memory_mb"] >= workload["memory_mb"]
        and node["free_disk_mb"] >= workload["disk_mb"]
    )


def score(node: dict[str, Any], workload: dict[str, Any]) -> tuple[int, int, int, str]:
    # Prefer more remaining memory, then CPU, then disk; node_id is a deterministic tie-break.
    return (
        node["free_memory_mb"] - workload["memory_mb"],
        node["free_cpu_millicores"] - workload["cpu_millicores"],
        node["free_disk_mb"] - workload["disk_mb"],
        node["node_id"],
    )


def propose(nodes_raw: Any, workload_raw: Any) -> dict[str, Any]:
    if not isinstance(nodes_raw, list):
        die("nodes input must be a JSON array")
    workload = validate_workload(workload_raw)
    eligible = []
    rejected = 0
    for raw in nodes_raw:
        node = validate_node(raw)
        if node is None:
            rejected += 1
            continue
        if fits(node, workload):
            eligible.append(node)
        else:
            rejected += 1

    proposal: dict[str, Any] = {
        "schema": SCHEMA,
        "workload_id": workload["workload_id"],
        "decision_state": "proposal",
        "execution_allowed": False,
        "remote_execution": False,
        "automatic_failover": False,
        "public_ready": False,
        "requires_real_node_proof": True,
        "eligible_nodes": len(eligible),
        "rejected_nodes": rejected,
    }
    if not eligible:
        proposal["placement"] = None
        proposal["reason"] = "no verified candidate node satisfies the workload constraints"
        return proposal

    chosen = max(eligible, key=lambda n: score(n, workload))
    proposal["placement"] = {
        "node_id": chosen["node_id"],
        "architecture": chosen["architecture"],
    }
    proposal["reason"] = "highest deterministic residual-capacity score among verified candidates"
    return proposal


def main() -> None:
    parser = argparse.ArgumentParser(description="IZAKHONO CLOUD placement proposal generator")
    parser.add_argument("--nodes", type=Path, required=True)
    parser.add_argument("--workload", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    proposal = propose(load_json(args.nodes), load_json(args.workload))
    rendered = json.dumps(proposal, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.write_text(rendered, encoding="utf-8")
    else:
        sys.stdout.write(rendered)


if __name__ == "__main__":
    main()
