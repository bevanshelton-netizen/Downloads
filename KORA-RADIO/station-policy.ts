export type KoraRadioMode =
  | "scheduled"
  | "live"
  | "simulcast"
  | "emergency"
  | "offline";

export type KoraRadioStatus =
  | "READY"
  | "ON_AIR"
  | "DEGRADED"
  | "FAILOVER"
  | "OFFLINE";

export interface KoraRadioSession {
  state:
    | "STARTING"
    | "LIVE"
    | "DEGRADED"
    | "FAILOVER"
    | "RECOVERING"
    | "STOPPING"
    | "ENDED"
    | "ERROR";
  acceptedOutput: boolean;
}

export interface KoraRadioStationState {
  mode: KoraRadioMode;
  status: KoraRadioStatus;
  activeSessionId?: string | null;
}

/**
 * Resolve the customer-visible radio state from the upstream KORA LIVE session.
 * A station is only ON_AIR when the contribution session is LIVE and its output
 * has been accepted. Emergency mode may override programming, but not transport
 * verification.
 */
export function resolveStationState(
  mode: KoraRadioMode,
  session?: KoraRadioSession | null,
  activeSessionId?: string | null,
): KoraRadioStationState {
  if (!session) {
    return {
      mode: mode === "emergency" ? "emergency" : "offline",
      status: mode === "emergency" ? "DEGRADED" : "READY",
      activeSessionId: null,
    };
  }

  if (mode === "emergency") {
    return {
      mode: "emergency",
      status: session.state === "LIVE" && session.acceptedOutput ? "ON_AIR" : "DEGRADED",
      activeSessionId: activeSessionId ?? null,
    };
  }

  if (session.state === "LIVE" && session.acceptedOutput) {
    return { mode, status: "ON_AIR", activeSessionId: activeSessionId ?? null };
  }

  if (session.state === "FAILOVER") {
    return { mode, status: "FAILOVER", activeSessionId: activeSessionId ?? null };
  }

  if (
    session.state === "DEGRADED" ||
    session.state === "RECOVERING" ||
    (session.state === "LIVE" && !session.acceptedOutput)
  ) {
    return { mode, status: "DEGRADED", activeSessionId: activeSessionId ?? null };
  }

  return { mode, status: "OFFLINE", activeSessionId: activeSessionId ?? null };
}
