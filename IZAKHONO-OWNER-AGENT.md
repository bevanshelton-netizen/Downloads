# IZAKHONO OWNER AGENT

The Owner Agent removes repeated manual deployment clicks while preserving a narrow trust boundary.

## Trust model

The agent trusts only the canonical bevanshelton-netizen/Downloads repository main branch and only the control document at owner-host/control/desired-state.json.

It does not execute command strings from JSON.

Supported actions are hard-coded:

- activate-one-local-model
- configure-one-ai
- deploy-one-ai
- verify-one-ai

Requests can expire and have at most three attempts. Model names and hostnames are validated. Hostnames must remain under the IZAKHONO Africa namespace.

## Safety

- refuses an unexpected Git origin;
- refuses to overwrite a dirty source tree;
- one process at a time with flock;
- action allowlist only;
- no arbitrary shell field in the request schema;
- local run logs and state receipts;
- successful request IDs are not executed twice;
- request expiry prevents stale future execution.

## Install once

Run on the Windows owner machine:

INSTALL-IZAKHONO-OWNER-AGENT.cmd

It creates a Windows Scheduled Task that invokes the Linux owner agent about every five minutes while the Windows owner session can run WSL.

A pending request for the already-approved ONE bootstrap model activation is included in the canonical control file. Installing the agent therefore starts that activation automatically.

The agent is not considered installed until the owner machine writes its local status/receipt.
