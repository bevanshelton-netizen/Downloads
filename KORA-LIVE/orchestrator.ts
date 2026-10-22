import { rankKoraLinks, type KoraLinkTelemetry } from "../KORA-CONNECT/link-score";
import type { LiveState } from "./state-engine";

export type LiveProfile = "mobile" | "broadcast" | "emergency" | "fleet";

export interface LiveProfilePolicy {
  minimumScore: number;
  failoverRequired: boolean;
  offlineResilience?: boolean;
}

export interface LiveSelection {
  profile: LiveProfile;
  state: LiveState;
  activeLinkId: string | null;
  failoverLinkIds: string[];
  ranked: Array<{ id: string; score: number; state: KoraLinkTelemetry["state"] }>;
  reason: string;
}

/**
 * Selects a transport for a KORA LIVE session from KORA CONNECT telemetry.
 * KORA remains vendor-neutral: adapters only provide telemetry and perform the actual transport work.
 */
export function selectLiveLinks(
  profile: LiveProfile,
  links: KoraLinkTelemetry[],
  policy: LiveProfilePolicy
): LiveSelection {
  const ranked = rankKoraLinks(links).map(({ link, score }) => ({
    id: link.id,
    score,
    state: link.state
  }));

  const usable = ranked.filter(item => item.state !== "failed" && item.score >= policy.minimumScore);
  const active = usable[0] ?? null;
  const failover = usable.slice(1).map(item => item.id);

  if (!active) {
    return {
      profile,
      state: "DEGRADED",
      activeLinkId: null,
      failoverLinkIds: [],
      ranked,
      reason: "No transport currently meets the profile minimum health score."
    };
  }

  if (policy.failoverRequired && failover.length === 0) {
    return {
      profile,
      state: "DEGRADED",
      activeLinkId: active.id,
      failoverLinkIds: [],
      ranked,
      reason: "Primary transport is usable, but the profile requires a failover path."
    };
  }

  return {
    profile,
    state: "RECOVERING",
    activeLinkId: active.id,
    failoverLinkIds: failover,
    ranked,
    reason: "Primary transport selected from deterministic KORA CONNECT health ranking."
  };
}
