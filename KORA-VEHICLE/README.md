# KORA VEHICLE

KORA VEHICLE is the vehicle-intelligence layer connecting KORA NAV, KORA EMERGENCY, KORA CONNECT and fleet/security services.

## Architecture

`VEHICLE → KORA VEHICLE → KORA NAV / KORA EMERGENCY / KORA FLEET`

## Core capabilities

- vehicle profile and capability references
- telemetry and health-state references
- fuel/energy and maintenance context
- safety-system state
- sensor and diagnostic references
- trip and vehicle-session correlation
- fleet assignment and operational context
- emergency escalation signals
- offline/degraded telemetry buffering

## Safety boundary

KORA may orchestrate and interpret available vehicle data, but must not claim a vehicle capability, diagnostic result, safety intervention or manufacturer integration unless the relevant signal or integration is actually verified.

KORA VEHICLE is an intelligence/orchestration layer and does not replace certified vehicle control systems, manufacturer systems or regulated safety equipment.
