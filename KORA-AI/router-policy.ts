export type KoraDestination = 'learn' | 'nav' | 'sport' | 'news' | 'music' | 'tv' | 'radio' | 'general';
export type KoraMode = 'standard' | 'driver_safe' | 'emergency';

export interface KoraRouteRequest {
  requestId: string;
  intent: string;
  destination: KoraDestination;
  mode?: KoraMode;
  requiresLiveData?: boolean;
  requiresVerifiedSource?: boolean;
}

export interface KoraRouteDecision {
  allowed: boolean;
  destination: KoraDestination;
  reason: string;
}

/** Domain policy remains authoritative; KORA AI only routes and assists. */
export function resolveKoraRoute(request: KoraRouteRequest): KoraRouteDecision {
  if (request.mode === 'emergency') {
    return {
      allowed: true,
      destination: 'nav',
      reason: 'Emergency mode prioritises the KORA safety/navigation pathway.',
    };
  }

  if (request.mode === 'driver_safe' && request.destination === 'news' && request.requiresLiveData) {
    return {
      allowed: true,
      destination: 'news',
      reason: 'Driver-safe news requires a verified live-information pathway and concise presentation.',
    };
  }

  return {
    allowed: true,
    destination: request.destination,
    reason: 'Request routed to the selected KORA domain; downstream domain policy remains authoritative.',
  };
}
