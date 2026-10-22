export type NewsStatus =
  | "draft"
  | "pending_review"
  | "verified"
  | "published"
  | "updated"
  | "corrected"
  | "withdrawn";

export type NewsPriority = "standard" | "breaking" | "emergency";

export interface KoraNewsStory {
  storyId: string;
  status: NewsStatus;
  priority: NewsPriority;
  sourceRefs: string[];
}

export interface KoraNewsDecision {
  distributable: boolean;
  priority: NewsPriority;
  reason:
    | "VERIFIED"
    | "REQUIRES_REVIEW"
    | "NO_SOURCE"
    | "WITHDRAWN"
    | "CORRECTED_REQUIRES_UPDATE";
}

/**
 * Editorial gate for distribution. Priority can accelerate distribution after
 * verification; it cannot substitute for verification or sourcing.
 */
export function resolveNewsDistribution(
  story: KoraNewsStory,
): KoraNewsDecision {
  if (story.status === "withdrawn") {
    return {
      distributable: false,
      priority: story.priority,
      reason: "WITHDRAWN",
    };
  }

  if (story.status === "corrected") {
    return {
      distributable: story.sourceRefs.length > 0,
      priority: story.priority,
      reason:
        story.sourceRefs.length > 0
          ? "CORRECTED_REQUIRES_UPDATE"
          : "NO_SOURCE",
    };
  }

  if (story.status !== "verified" && story.status !== "published" && story.status !== "updated") {
    return {
      distributable: false,
      priority: story.priority,
      reason: "REQUIRES_REVIEW",
    };
  }

  if (story.sourceRefs.length === 0) {
    return {
      distributable: false,
      priority: story.priority,
      reason: "NO_SOURCE",
    };
  }

  return {
    distributable: true,
    priority: story.priority,
    reason: "VERIFIED",
  };
}
