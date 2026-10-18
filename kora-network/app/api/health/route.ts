import { NextResponse } from 'next/server';
import { getIndependenceEngines, isKoraInfrastructureIndependent } from '@/lib/independence';

export const dynamic = 'force-dynamic';

export async function GET() {
  const engines = getIndependenceEngines();
  const independent = isKoraInfrastructureIndependent();

  return NextResponse.json({
    service: 'KORA',
    status: independent ? 'ok' : 'degraded',
    environment: process.env.NODE_ENV || 'unknown',
    infrastructure: {
      mode: independent ? 'owned-independent' : 'provider-assisted',
      independent,
      required_engines: engines.filter((engine) => engine.requiredForKora).length,
      verified_engines: engines.filter((engine) => engine.requiredForKora && engine.status === 'verified').length,
    },
    timestamp: new Date().toISOString(),
  }, { status: independent ? 200 : 503 });
}
