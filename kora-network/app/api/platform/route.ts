import { NextResponse } from 'next/server';
import { getKoraRuntime } from '@/lib/runtime';
import { getIndependenceEngines } from '@/lib/independence';
import { getReleaseGates, isReleaseReady } from '@/lib/release-readiness';

export async function GET() {
  const runtime = getKoraRuntime();
  const engines = getIndependenceEngines();
  const gates = getReleaseGates();
  const ready = isReleaseReady();

  return NextResponse.json({
    service: 'KORA TV',
    status: ready ? 'ready' : 'degraded',
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
    infrastructure: {
      independent: engines.filter((engine) => engine.requiredForKora).every((engine) => engine.status === 'verified'),
      requiredEngines: engines.filter((engine) => engine.requiredForKora).length,
      verifiedEngines: engines.filter((engine) => engine.requiredForKora && engine.status === 'verified').length,
    },
    releaseGates: Object.fromEntries(gates.map((gate) => [gate.name, gate.verified])),
    releaseReady: ready,
    note: 'Capabilities describe implemented platform features. Release gates must be verified before public launch. Playback and catalogue content must be licensed or otherwise authorized for KORA distribution.',
    timestamp: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
