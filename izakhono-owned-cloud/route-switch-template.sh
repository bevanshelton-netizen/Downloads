#!/usr/bin/env bash
set -euo pipefail

# TEMPLATE ONLY. Copy this file outside the repository and adapt it to the
# real route authority you control.
#
# Inputs:
#   IZAKHONO_FAILOVER_TARGET=primary|standby
#   IZAKHONO_FAILOVER_FENCING_TOKEN=<current witness token>
#   IZAKHONO_FAILOVER_PREVIOUS_TOKEN=<previous token>
#
# A real implementation may update a delegated DNS A/AAAA record, a private
# tunnel target, or another route you explicitly control. It MUST exit non-zero
# if the route cannot be proven changed.

echo "ROUTE SWITCH TEMPLATE ONLY — no production route changed."
exit 70
