export type FleetStatus = 'draft' | 'active' | 'degraded' | 'offline' | 'suspended';

export interface KoraFleet {
  fleetId: string;
  organisationRef?: string;
  type: 'commercial' | 'logistics' | 'passenger' | 'public-service' | 'security' | 'cit' | 'mixed';
  status: FleetStatus;
  vehicleRefs?: string[];
  driverRefs?: string[];
  activeTripRefs?: string[];
  incidentRefs?: string[];
}

export interface FleetDecision {
  operationsAllowed: boolean;
  safetyMonitoringRequired: boolean;
  emergencyIntegrationAvailable: boolean;
  reason: string;
}

export function evaluateFleetPolicy(fleet: KoraFleet): FleetDecision {
  if (fleet.status === 'suspended') {
    return {
      operationsAllowed: false,
      safetyMonitoringRequired: true,
      emergencyIntegrationAvailable: false,
      reason: 'Fleet operations are suspended.'
    };
  }

  const degraded = fleet.status === 'degraded' || fleet.status === 'offline';

  return {
    operationsAllowed: fleet.status === 'active' || degraded,
    safetyMonitoringRequired: true,
    emergencyIntegrationAvailable: fleet.status !== 'offline',
    reason: degraded
      ? 'Fleet is operating with reduced connectivity or capability.'
      : 'Fleet policy permits normal operational orchestration.'
  };
}
