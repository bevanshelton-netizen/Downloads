# KORA FLEET

KORA FLEET is the enterprise mobility and fleet-safety layer built on KORA VEHICLE, KORA NAV, KORA EMERGENCY and KORA CONNECT.

## Architecture

`KORA VEHICLE → KORA FLEET → KORA NAV / KORA EMERGENCY / FORTRESS`

## Core capabilities

- fleet and organisation profiles
- vehicle assignment and driver references
- live/degraded/offline fleet state
- trip and route operations
- fleet safety monitoring
- maintenance and operational alerts
- incident escalation into KORA EMERGENCY
- secure fleet and CIT operational contexts
- dispatch and response references
- audit-ready operational events

## Security boundary

KORA FLEET orchestrates fleet intelligence and workflow. It must not claim custody of vehicles, physical intervention, responder dispatch, insurance coverage, regulatory approval or security-provider action unless the relevant integration confirms it.

Sensitive fleet, driver and location information should be minimised, access-controlled and retained only according to the applicable organisation and jurisdiction policies.
