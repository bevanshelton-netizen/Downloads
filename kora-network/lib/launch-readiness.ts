import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPlatformReleaseState, publicAccessOpen } from '@/lib/platform-state';

function configured(name: string, minimumLength = 1) {
  return (process.env[name]?.trim().length ?? 0) >= minimumLength;
}

function configuredAny(names: string[], minimumLength = 1) {
  return names.some((name) => configured(name, minimumLength));
}

function isHttpsOrigin(value?: string) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname);
  } catch {
    return false;
  }
}

function isRealEmail(value?: string) {
  if (!value || value.endsWith('.invalid')) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function getLaunchReadiness() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const payfastMode = process.env.PAYFAST_SANDBOX === 'false' ? 'live' : 'sandbox';
  const videoProvider = process.env.VIDEO_PROVIDER || 'mock';
  const operatorName = process.env.NEXT_PUBLIC_OPERATOR_NAME?.trim();
  const release = await getPlatformReleaseState();

  let adminCount = 0;
  let activeChannelCount = 0;
  let databaseReachable = false;
  try {
    const admin = createAdminClient();
    const [admins, channels] = await Promise.all([
      admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin'),
      admin.from('live_channels').select('id', { count: 'exact', head: true }).eq('is_active', true),
    ]);
    databaseReachable = !admins.error && !channels.error;
    adminCount = admins.count ?? 0;
    activeChannelCount = channels.count ?? 0;
  } catch {
    databaseReachable = false;
  }

  const checks = {
    appUrl: isHttpsOrigin(appUrl),
    supabaseConfigured: isHttpsOrigin(supabaseUrl)
      && configuredAny(['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'], 10)
      && configuredAny(['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY'], 20),
    databaseReachable,
    schemaCurrent: release.schema_version >= 14,
    adminBootstrapped: adminCount > 0,
    channelSeeded: activeChannelCount >= 1,
    payfastCredentials: configured('PAYFAST_MERCHANT_ID')
      && configured('PAYFAST_MERCHANT_KEY')
      && configured('PAYFAST_PASSPHRASE'),
    payfastLive: payfastMode === 'live',
    cloudflareStream: videoProvider === 'cloudflare'
      && configured('CLOUDFLARE_ACCOUNT_ID')
      && configured('CLOUDFLARE_STREAM_TOKEN', 20)
      && configured('CLOUDFLARE_STREAM_CUSTOMER_CODE'),
    rewardVerifierSecret: configured('KORA_INTERNAL_API_SECRET', 32),
    operatorIdentity: Boolean(operatorName && !/pending/i.test(operatorName)),
    supportContacts: isRealEmail(process.env.NEXT_PUBLIC_SUPPORT_EMAIL)
      && isRealEmail(process.env.NEXT_PUBLIC_PRIVACY_EMAIL)
      && isRealEmail(process.env.NEXT_PUBLIC_RIGHTS_EMAIL),
    legalApproved: process.env.KORA_LEGAL_APPROVED === 'true',
    regulatoryApproved: process.env.KORA_REGULATORY_APPROVED === 'true',
    childSafetyApproved: process.env.KORA_CHILD_SAFETY_APPROVED === 'true',
    payoutOperationsApproved: process.env.KORA_PAYOUT_OPERATIONS_APPROVED === 'true',
    backupOperationsApproved: process.env.KORA_BACKUP_OPERATIONS_APPROVED === 'true',
    incidentResponseApproved: process.env.KORA_INCIDENT_RESPONSE_APPROVED === 'true',
    publicLaunchEnabled: publicAccessOpen(release),
  };

  const productionReady = Object.values(checks).every(Boolean);
  return {
    service: 'KORA',
    status: productionReady ? 'ready' : 'configuration_required',
    productionReady,
    environment: process.env.NODE_ENV || 'unknown',
    checks,
    details: {
      payfastMode,
      videoProvider,
      schemaVersion: release.schema_version,
      releaseName: release.release_name,
      adminCount,
      activeChannelCount,
      maintenanceMode: release.maintenance_mode,
      publicSignupsEnabled: release.public_signups_enabled,
      creatorApplicationsEnabled: release.creator_applications_enabled,
      advertiserCampaignsEnabled: release.advertiser_campaigns_enabled,
    },
    timestamp: new Date().toISOString(),
  };
}
