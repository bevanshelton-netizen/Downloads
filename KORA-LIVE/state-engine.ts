export type LiveState =
  | "STARTING"
  | "LIVE"
  | "DEGRADED"
  | "FAILOVER"
  | "RECOVERING"
  | "STOPPING"
  | "ENDED"
  | "ERROR";

export type LiveEvent =
  | { type: "OUTPUT_ACCEPTED" }
  | { type: "HEALTH_GOOD" }
  | { type: "HEALTH_DEGRADED" }
  | { type: "LINK_FAILED" }
  | { type: "FAILOVER_SELECTED" }
  | { type: "LINK_RECOVERED" }
  | { type: "STOP_REQUESTED" }
  | { type: "STOPPED" }
  | { type: "FATAL_ERROR" };

const transitions: Record<LiveState, Partial<Record<LiveEvent["type"], LiveState>>> = {
  STARTING: {
    OUTPUT_ACCEPTED: "LIVE",
    FATAL_ERROR: "ERROR",
    STOP_REQUESTED: "STOPPING"
  },
  LIVE: {
    HEALTH_DEGRADED: "DEGRADED",
    LINK_FAILED: "FAILOVER",
    STOP_REQUESTED: "STOPPING",
    FATAL_ERROR: "ERROR"
  },
  DEGRADED: {
    HEALTH_GOOD: "LIVE",
    LINK_FAILED: "FAILOVER",
    STOP_REQUESTED: "STOPPING",
    FATAL_ERROR: "ERROR"
  },
  FAILOVER: {
    FAILOVER_SELECTED: "RECOVERING",
    STOP_REQUESTED: "STOPPING",
    FATAL_ERROR: "ERROR"
  },
  RECOVERING: {
    HEALTH_GOOD: "LIVE",
    HEALTH_DEGRADED: "DEGRADED",
    LINK_FAILED: "FAILOVER",
    STOP_REQUESTED: "STOPPING",
    FATAL_ERROR: "ERROR"
  },
  STOPPING: {
    STOPPED: "ENDED",
    FATAL_ERROR: "ERROR"
  },
  ENDED: {},
  ERROR: {}
};

export function transition(state: LiveState, event: LiveEvent): LiveState {
  return transitions[state][event.type] ?? state;
}

export function canTransition(state: LiveState, event: LiveEvent): boolean {
  return transitions[state][event.type] !== undefined;
}

export function isCustomerLive(state: LiveState, acceptedOutput: boolean): boolean {
  return state === "LIVE" && acceptedOutput;
}
