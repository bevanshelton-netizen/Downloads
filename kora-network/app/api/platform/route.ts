import { NextResponse } from 'next/server';
import { getKoraRuntime } from '@/lib/runtime';

export async function GET() {
  const runtime = getKoraRuntime();
  const configured = runtime.streaming === 'configured' && runtime.database === 'configured';
  const status = configured ? 'ready' : 'degraded';

  return NextResponse.json({
    service: 'KORA TV',
    status,
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
    releaseGates: {
      runtimeConfigured: configured,
      streamingConfigured: runtime.streaming === 'configured',
      databaseConfigured: runtime.database === 'configured',
      contentRightsVerified: false,
      paymentProductionVerified: false,
      publicDeploymentVerified: false,
    },
    note: 'Capabilities describe implemented platform features. Release gates must be verified before public launch. Playback and catalogue content must be licensed or otherwise authorized for KORA distribution.',
    timestamp: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
