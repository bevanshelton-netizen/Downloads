export type VehicleStatus =
  | 'unknown' | 'parked' | 'active' | 'moving' | 'idle'
  | 'degraded' | 'offline' | 'emergency';

export interface VehicleState {
  vehicleId: string;
  status: VehicleStatus;
  telemetry?: {
    speedKph?: number;
    headingDegrees?: number;
    odometerKm?: number;
    fuelPercent?: number;
    batteryPercent?: number;
  };
  lastVerifiedAt?: string;
}

export interface VehicleDecision {
  navigationAllowed: boolean;
  safetyOverlayRequired: boolean;
  emergencyEscalationEligible: boolean;
  telemetryTrusted: boolean;
  reason: string;
}

/**
 * Vehicle intelligence is advisory/orchestration only. It cannot assert
 * certified vehicle control or manufacturer capability without verification.
 */
export function evaluateVehicleState(vehicle: VehicleState): VehicleDecision {
  const telemetryTrusted = Boolean(vehicle.lastVerifiedAt && vehicle.telemetry);
  const emergencyEscalationEligible = vehicle.status === 'emergency';
  const safetyOverlayRequired = emergencyEscalationEligible || vehicle.status === 'degraded';

  return {
    navigationAllowed: vehicle.status !== 'unknown',
    safetyOverlayRequired,
    emergencyEscalationEligible,
    telemetryTrusted,
    reason: telemetryTrusted
      ? 'Vehicle state contains a verified telemetry reference.'
      : 'Vehicle telemetry is unavailable or not verified; do not infer unsupported vehicle capability.'
  };
}
