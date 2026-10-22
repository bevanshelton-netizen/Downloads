export type KoraTvMode = "scheduled" | "live" | "simulcast" | "emergency" | "offline";
export type KoraTvStatus = "READY" | "ON_AIR" | "DEGRADED" | "FAILOVER" | "OFFLINE";

export interface KoraTvSession {
  sessionId: string;
  acceptedOutput: boolean;
  state: "STARTING" | "LIVE" | "DEGRADED" | "FAILOVER" | "RECOVERING" | "STOPPING" | "ENDED" | "ERROR";
}

export interface KoraTvChannelState {
  mode: KoraTvMode;
  status: KoraTvStatus;
  activeSessionId: string | null;
  emergencyOverride: boolean;
}

/**
 * Converts a verified KORA LIVE session into a conservative TV channel state.
 * A channel only becomes ON_AIR when the upstream session is LIVE and its output
 * has been explicitly accepted by the distribution layer.
 */
export function resolveChannelState(
  current: KoraTvChannelState,
  session: KoraTvSession | null
): KoraTvChannelState {
  if (current.emergencyOverride) {
    return { ...current, mode: "emergency", status: session?.acceptedOutput ? "ON_AIR" : "DEGRADED" };
  }

  if (!session) {
    return { ...current, activeSessionId: null, status: current.mode === "offline" ? "OFFLINE" : "READY" };
  }

  const acceptedLive = session.state === "LIVE" && session.acceptedOutput;
  if (acceptedLive) {
    return { ...current, activeSessionId: session.sessionId, status: "ON_AIR" };
  }

  if (session.state === "FAILOVER" || session.state === "DEGRADED" || session.state === "RECOVERING") {
    return { ...current, activeSessionId: session.sessionId, status: "DEGRADED" };
  }

  return { ...current, activeSessionId: session.sessionId, status: "READY" };
}
