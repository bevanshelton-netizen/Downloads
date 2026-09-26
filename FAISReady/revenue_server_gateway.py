#!/usr/bin/env python3
"""FAISReady payment-provider gateway selector.

The application/entitlement layer stays stable while the payment rail can be
changed through FAISREADY_PAYMENT_PROVIDER:
- ikhokha  -> direct iK Pay API adapter (intended production rail)
- payfast  -> existing direct PayFast rail (sandbox/fallback)
- izakhono -> IZAKHONO PAY orchestration wrapper
"""
from __future__ import annotations

import argparse
import os


def selected_provider() -> str:
    value = os.environ.get("FAISREADY_PAYMENT_PROVIDER", "payfast").strip().lower()
    aliases = {"ik": "ikhokha", "pf": "payfast", "iz": "izakhono"}
    value = aliases.get(value, value)
    if value not in {"ikhokha", "payfast", "izakhono"}:
        raise SystemExit("FAISREADY_PAYMENT_PROVIDER must be ikhokha, payfast, or izakhono")
    return value


def implementation():
    provider = selected_provider()
    if provider == "ikhokha":
        import revenue_server_ikhokha as impl
    elif provider == "izakhono":
        import revenue_server_izakhono as impl
    else:
        import revenue_server as impl
    return provider, impl


def main() -> int:
    parser = argparse.ArgumentParser(description="FAISReady payment-provider gateway")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    provider, impl = implementation()
    print(f"FAISReady payment_provider={provider}")
    if args.self_test:
        return impl.self_test()
    return impl.run_server()


if __name__ == "__main__":
    raise SystemExit(main())
