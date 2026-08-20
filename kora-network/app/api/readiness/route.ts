import { NextResponse } from 'next/server';

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

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const payfastMode = process.env.PAYFAST_SANDBOX === 'false' ? 'live' : 'sandbox';
  const videoProvider = process.env.VIDEO_PROVIDER || 'mock';

  const checks = {
    appUrl: isHttpsOrigin(appUrl),
    supabase: isHttpsOrigin(supabaseUrl)
      && configured('NEXT_PUBLIC_SUPABASE_ANON_KEY')
      && configured('SUPABASE_SERVICE_ROLE_KEY'),
    payfastCredentials: configured('PAYFAST_MERCHANT_ID')
      && configured('PAYFAST_MERCHANT_KEY')
      && configured('PAYFAST_PASSPHRASE'),
    payfastLive: payfastMode === 'live',
    cloudflareStream: videoProvider === 'cloudflare'
      && configured('CLOUDFLARE_ACCOUNT_ID')
      && configured('CLOUDFLARE_STREAM_TOKEN')
      && configured('CLOUDFLARE_STREAM_CUSTOMER_CODE'),
  };

  const productionReady = Object.values(checks).every(Boolean);

  return NextResponse.json({
    service: 'KORA',
    status: productionReady ? 'ready' : 'configuration_required',
    productionReady,
    environment: process.env.NODE_ENV || 'unknown',
    checks: {
      ...checks,
      payfastMode,
      videoProvider,
    },
    timestamp: new Date().toISOString(),
  }, { status: productionReady ? 200 : 503 });
}
