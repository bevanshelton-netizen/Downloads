import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function configured(name: string) {
  return Boolean(process.env[name]?.trim());
}

export async function GET() {
  const supabase = configured('NEXT_PUBLIC_SUPABASE_URL') && configured('NEXT_PUBLIC_SUPABASE_ANON_KEY') && configured('SUPABASE_SERVICE_ROLE_KEY');
  const payfast = configured('PAYFAST_MERCHANT_ID') && configured('PAYFAST_MERCHANT_KEY') && configured('PAYFAST_PASSPHRASE');
  const videoProvider = process.env.VIDEO_PROVIDER || 'mock';
  const video = videoProvider === 'cloudflare'
    ? configured('CLOUDFLARE_ACCOUNT_ID') && configured('CLOUDFLARE_STREAM_TOKEN') && configured('CLOUDFLARE_STREAM_CUSTOMER_CODE')
    : videoProvider === 'mock';
  const appUrl = configured('NEXT_PUBLIC_APP_URL');

  const ready = supabase && payfast && video && appUrl;

  return NextResponse.json({
    service: 'KORA',
    status: ready ? 'ready' : 'configuration_required',
    environment: process.env.NODE_ENV || 'unknown',
    checks: {
      appUrl,
      supabase,
      payfast,
      video,
      videoProvider,
      payfastMode: process.env.PAYFAST_SANDBOX === 'false' ? 'live' : 'sandbox',
    },
    timestamp: new Date().toISOString(),
  }, { status: ready ? 200 : 503 });
}
