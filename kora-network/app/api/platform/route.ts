import { NextResponse } from 'next/server';
import { getKoraRuntime } from '@/lib/runtime';

export async function GET() {
  const runtime = getKoraRuntime();

  return NextResponse.json({
    service: 'KORA TV',
    status: 'operational',
    architecture: 'dual-runtime',
    runtime,
    capabilities: {
      liveTv: true,
      hlsPlayback: true,
      epg: true,
      vod: true,
      subscriptions: true,
      advertising: true,
      providerFailover: true,
    },
    note: 'Playback and catalogue content must be licensed or otherwise authorized for KORA distribution.',
    timestamp: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
