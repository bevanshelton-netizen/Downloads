const required = [
  ['KORA_CONTENT_RIGHTS_VERIFIED', 'content rights'],
  ['KORA_PAYMENT_PRODUCTION_VERIFIED', 'production payments'],
  ['KORA_LEGAL_APPROVED', 'legal approval'],
  ['KORA_REGULATORY_APPROVED', 'regulatory approval'],
  ['KORA_CHILD_SAFETY_APPROVED', 'child safety'],
  ['KORA_PAYOUT_OPERATIONS_APPROVED', 'payout operations'],
  ['KORA_BACKUP_OPERATIONS_APPROVED', 'backup operations'],
  ['KORA_INCIDENT_RESPONSE_APPROVED', 'incident response'],
  ['KORA_PUBLIC_DEPLOYMENT_VERIFIED', 'public deployment'],
];

const missing = required.filter(([key]) => process.env[key] !== 'true');
const streamingReady = process.env.KORA_STREAMING_READY === 'true' && process.env.VIDEO_PROVIDER && process.env.VIDEO_PROVIDER !== 'mock';

console.log(`KORA release readiness: ${required.length - missing.length}/${required.length} explicit approval gates verified.`);
console.log(`Production streaming configured: ${streamingReady ? 'yes' : 'no'}`);

if (missing.length) console.log(`Missing approvals: ${missing.map(([, label]) => label).join(', ')}`);
if (!streamingReady) console.log('Streaming remains blocked until a real production media provider is configured.');

if (process.env.REQUIRE_RELEASE_READINESS === 'true' && (missing.length || !streamingReady)) process.exit(1);
