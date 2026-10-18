import { NextResponse } from 'next/server';
import { getIndependenceEngines, getIndependenceSummary } from '@/lib/independence';

export const dynamic = 'force-dynamic';

export async function GET() {
  const engines = getIndependenceEngines();
  const summary = getIndependenceSummary();

  return NextResponse.json({
    service: 'KORA',
    status: summary.independent ? 'ok' : 'degraded',
    environment: process.env.NODE_ENV || 'unknown',
    infrastructure: {
      mode: summary.independent ? 'owned-independent' : 'provider-assisted',
      ...summary,
      engines,
    },
    timestamp: new Date().toISOString(),
  }, { status: summary.independent ? 200 : 503 });
}
