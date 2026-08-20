import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function configured(name: string) {
  return Boolean(process.env[name]?.trim());
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

async function schemaReady(supabaseConfigured: boolean) {
  if (!supabaseConfigured) return false;
  try {
    const admin = createAdminClient();
    const [subscriptions, rewards, rights, earnings] = await Promise.all([
      admin.from('subscriptions').select('id,cancel_at_period_end').limit(1),
      admin.from('reward_claims').select('id').limit(1),
      admin.from('rights_disputes').select('id').limit(1),
      admin.from('creator_earnings').select('id').limit(1),
    ]);
    return !subscriptions.error && !rewards.error && !rights.error && !earnings.error;
  } catch {
    return false;
  }
}

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const payfastMode = process.env.PAYFAST_SANDBOX === 'false' ? 'live' : 'sandbox';
  const videoProvider = process.env.VIDEO_PROVIDER || 'mock';
  const operatorName = process.env.NEXT_PUBLIC_OPERATOR_NAME?.trim();
  const supabaseConfigured = isHttpsOrigin(supabaseUrl)
    && configured('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    && configured('SUPABASE_SERVICE_ROLE_KEY');

  const checks = {
    appUrl: isHttpsOrigin(appUrl),
    supabase: supabaseConfigured,
    databaseSchema: await schemaReady(supabaseConfigured),
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
    legalApproved: process.env.KORA_LEGAL_APPROVED === 'true',
    regulatoryApproved: process.env.KORA_REGULATORY_APPROVED === 'true',
  };

  const productionReady = Object.values(checks).every(Boolean);

  return NextResponse.json({
    service: 'KORA',
    status: productionReady ? 'ready' : 'configuration_required',
    productionReady,
    environment: process.env.NODE_ENV || 'unknown',
    checks: { ...checks, payfastMode, videoProvider },
    timestamp: new Date().toISOString(),
  }, { status: productionReady ? 200 : 503 });
}
