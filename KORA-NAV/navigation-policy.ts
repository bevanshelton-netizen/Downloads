export type KoraNavStatus = 'ready' | 'routing' | 'active' | 'degraded' | 'offline' | 'emergency' | 'ended';
export type KoraNavConnectivity = 'online' | 'degraded' | 'offline' | 'unknown';
export type KoraNavSafetyLevel = 'normal' | 'caution' | 'high_risk' | 'emergency';

export interface KoraNavSession {
  sessionId: string;
  mode: 'navigation' | 'safety' | 'fleet' | 'emergency' | 'offline';
  status: KoraNavStatus;
  locationSource?: 'gps' | 'network' | 'fused' | 'cached' | 'unknown';
  connectivity: KoraNavConnectivity;
  safetyLevel: KoraNavSafetyLevel;
  hazardRefs?: string[];
  emergencyRef?: string;
}

export interface NavDecision {
  navigationAllowed: boolean;
  safetyOverlay: boolean;
  emergencyMode: boolean;
  reason: string;
}

export function resolveNavigationPolicy(session: KoraNavSession): NavDecision {
  if (session.status === 'ended') {
    return { navigationAllowed: false, safetyOverlay: false, emergencyMode: false, reason: 'Navigation session has ended.' };
  }

  if (session.status === 'emergency' || session.safetyLevel === 'emergency') {
    return { navigationAllowed: true, safetyOverlay: true, emergencyMode: true, reason: 'Emergency safety mode is active.' };
  }

  if (session.connectivity === 'offline') {
    return { navigationAllowed: true, safetyOverlay: true, emergencyMode: false, reason: 'Offline-capable navigation mode.' };
  }

  const degraded = session.status === 'degraded' || session.connectivity === 'degraded';
  return {
    navigationAllowed: session.status !== 'ended',
    safetyOverlay: degraded || session.safetyLevel !== 'normal' || Boolean(session.hazardRefs?.length),
    emergencyMode: false,
    reason: degraded ? 'Navigation is available with degraded connectivity.' : 'Navigation is available.'
  };
}
