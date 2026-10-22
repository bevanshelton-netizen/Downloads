export type TrackAvailability =
  | "draft"
  | "active"
  | "restricted"
  | "unavailable";

export interface KoraMusicTrack {
  trackId: string;
  title: string;
  availability: TrackAvailability;
  playbackRef?: string | null;
}

export interface KoraPlaybackDecision {
  playable: boolean;
  reason:
    | "AVAILABLE"
    | "MISSING_PLAYBACK_REFERENCE"
    | "DRAFT"
    | "RESTRICTED"
    | "UNAVAILABLE";
}

/** Resolve catalogue availability into a safe playback decision. */
export function resolvePlayback(track: KoraMusicTrack): KoraPlaybackDecision {
  if (track.availability === "draft") {
    return { playable: false, reason: "DRAFT" };
  }

  if (track.availability === "restricted") {
    return { playable: false, reason: "RESTRICTED" };
  }

  if (track.availability === "unavailable") {
    return { playable: false, reason: "UNAVAILABLE" };
  }

  if (!track.playbackRef) {
    return { playable: false, reason: "MISSING_PLAYBACK_REFERENCE" };
  }

  return { playable: true, reason: "AVAILABLE" };
}
