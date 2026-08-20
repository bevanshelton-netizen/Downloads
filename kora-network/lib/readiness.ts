import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export const REQUIRED_SCHEMA_VERSION = 13;

function configured(name: string) {
  return Boolean(process.env[name]?.trim());
}

function approved(name: string) {
  return process.env[name] === 'true';
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

export async function getProductionReadiness() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const payfastMode = process.env.PAYFAST_SANDBOX === 'false' ? 'live' : 'sandbox';
  const videoProvider = process.env.VIDEO_PROVIDER || 'mock';
  const operatorName = process.env.NEXT_PUBLIC_OPERATOR_NAME?.trim();

  const supabaseConfigured = isHttpsOrigin(supabaseUrl)
    && configured('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    && configured('SUPABASE_SERVICE_ROLE_KEY');

  let databaseReachable = false;
  let detectedSchemaVersion: number | null = null;
  if (supabaseConfigured) {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('platform_schema_meta')
        .select('version')
        .eq('singleton', true)
        .maybeSingle();
      if (!error) {
        databaseReachable = true;
        detectedSchemaVersion = data?.version == null ? null : Number(data.version);
      }
    } catch {
      databaseReachable = false;
    }
  }

  const checks = {
    appUrl: isHttpsOrigin(appUrl),
    supabaseConfigured,
    databaseReachable,
    databaseSchemaCurrent: detectedSchemaVersion !== null && detectedSchemaVersion >= REQUIRED_SCHEMA_VERSION,
    payfastCredentials: configured('PAYFAST_MERCHANT_ID')
      && configured('PAYFAST_MERCHANT_KEY')
      && configured('PAYFAST_PASSPHRASE'),
    payfastLive: payfastMode === 'live',
    cloudflareStream: videoProvider === 'cloudflare'
      && configured('CLOUDFLARE_ACCOUNT_ID')
      && configured('CLOUDFLARE_STREAM_TOKEN')
      && configured('CLOUDFLARE_STREAM_CUSTOMER_CODE'),
    rewardVerifierSecret: configured('KORA_INTERNAL_API_SECRET'),
    operatorIdentity: Boolean(operatorName && !/pending/i.test(operatorName)),
    supportContacts: isRealEmail(process.env.NEXT_PUBLIC_SUPPORT_EMAIL)
      && isRealEmail(process.env.NEXT_PUBLIC_PRIVACY_EMAIL)
      && isRealEmail(process.env.NEXT_PUBLIC_RIGHTS_EMAIL),
    legalApproved: approved('KORA_LEGAL_APPROVED'),
    regulatoryApproved: approved('KORA_REGULATORY_APPROVED'),
    childSafetyApproved: approved('KORA_CHILD_SAFETY_APPROVED'),
    payoutOperationsApproved: approved('KORA_PAYOUT_OPERATIONS_APPROVED'),
    paymentAcceptanceApproved: approved('KORA_PAYMENT_ACCEPTANCE_APPROVED'),
    streamingAcceptanceApproved: approved('KORA_STREAMING_ACCEPTANCE_APPROVED'),
    adOperationsApproved: approved('KORA_AD_OPERATIONS_APPROVED'),
    monitoringApproved: approved('KORA_MONITORING_APPROVED'),
    backupApproved: approved('KORA_BACKUP_APPROVED'),
  };

  return {
    productionReady: Object.values(checks).every(Boolean),
    checks,
    details: {
      payfastMode,
      videoProvider,
      requiredSchemaVersion: REQUIRED_SCHEMA_VERSION,
      detectedSchemaVersion,
    },
  };
}
