import { getKoraRuntime } from '@/lib/runtime';
import { getIndependenceEngines } from '@/lib/independence';

export type ReleaseGate = {
  name: string;
  verified: boolean;
  reason: string;
};

const truthy = (name: string) => process.env[name] === 'true';

export function getReleaseGates(): ReleaseGate[] {
  const runtime = getKoraRuntime();
  const required = getIndependenceEngines().filter((engine) => engine.requiredForKora);
  const independenceVerified = required.length > 0 && required.every((engine) => engine.status === 'verified');
  const paymentVerified = truthy('KORA_PAYMENT_PRODUCTION_VERIFIED') ||
    (truthy('KORA_TICKET_LIVE_APPROVED') && truthy('KORA_IZAKHONO_PAY_LIVE_APPROVED'));
  const streamingVerified = runtime.streaming === 'configured' && process.env.VIDEO_PROVIDER !== 'mock';

  return [
    { name: 'Runtime configured', verified: runtime.database === 'configured' && runtime.primary !== 'other', reason: 'Primary runtime and database configuration are present.' },
    { name: 'Streaming production-ready', verified: streamingVerified, reason: 'Production media provider and streaming readiness must be configured.' },
    { name: 'Owned infrastructure', verified: independenceVerified, reason: `${required.filter((engine) => engine.status === 'verified').length}/${required.length} required IZAKHONO engines verified.` },
    { name: 'Content rights', verified: truthy('KORA_CONTENT_RIGHTS_VERIFIED'), reason: 'Rights clearance must be explicitly signed off.' },
    { name: 'Payments production', verified: paymentVerified, reason: 'Production payment processing must be explicitly verified.' },
    { name: 'Legal approval', verified: truthy('KORA_LEGAL_APPROVED'), reason: 'Operating/legal approval must be explicit.' },
    { name: 'Regulatory approval', verified: truthy('KORA_REGULATORY_APPROVED'), reason: 'Applicable regulatory approval must be explicit.' },
    { name: 'Child safety', verified: truthy('KORA_CHILD_SAFETY_APPROVED'), reason: 'Child-safety controls must be explicitly approved.' },
    { name: 'Payout operations', verified: truthy('KORA_PAYOUT_OPERATIONS_APPROVED'), reason: 'Creator/partner payout operations must be approved.' },
    { name: 'Backup operations', verified: truthy('KORA_BACKUP_OPERATIONS_APPROVED'), reason: 'Backup and recovery operations must be approved.' },
    { name: 'Incident response', verified: truthy('KORA_INCIDENT_RESPONSE_APPROVED'), reason: 'Incident response ownership and procedure must be approved.' },
    { name: 'Public deployment', verified: truthy('KORA_PUBLIC_DEPLOYMENT_VERIFIED'), reason: 'Public production deployment must be externally verified.' },
  ];
}

export function isReleaseReady(): boolean {
  return getReleaseGates().every((gate) => gate.verified);
}
