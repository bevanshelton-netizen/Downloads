export type SportEventStatus =
  | "scheduled"
  | "pre_match"
  | "live"
  | "halftime"
  | "paused"
  | "finished"
  | "postponed"
  | "cancelled"
  | "unknown";

export type DataFreshness = "live" | "recent" | "stale" | "unknown";

export interface KoraSportEvent {
  eventId: string;
  status: SportEventStatus;
  dataFreshness: DataFreshness;
  sourceRefs: string[];
}

export interface KoraSportDecision {
  livePresentationAllowed: boolean;
  driverAudioAllowed: boolean;
  reason: "LIVE_CONFIRMED" | "STALE_DATA" | "UNKNOWN_STATE" | "NO_SOURCE" | "NOT_LIVE";
}

/**
 * Gate live sports presentation. Driver audio remains deliberately conservative:
 * it requires confirmed live data and at least one source.
 */
export function resolveSportPresentation(event: KoraSportEvent): KoraSportDecision {
  if (event.sourceRefs.length === 0) {
    return {
      livePresentationAllowed: false,
      driverAudioAllowed: false,
      reason: "NO_SOURCE",
    };
  }

  if (event.status === "live" && event.dataFreshness === "live") {
    return {
      livePresentationAllowed: true,
      driverAudioAllowed: true,
      reason: "LIVE_CONFIRMED",
    };
  }

  if (event.dataFreshness === "stale") {
    return {
      livePresentationAllowed: false,
      driverAudioAllowed: false,
      reason: "STALE_DATA",
    };
  }

  if (event.status === "unknown" || event.dataFreshness === "unknown") {
    return {
      livePresentationAllowed: false,
      driverAudioAllowed: false,
      reason: "UNKNOWN_STATE",
    };
  }

  return {
    livePresentationAllowed: false,
    driverAudioAllowed: false,
    reason: "NOT_LIVE",
  };
}
