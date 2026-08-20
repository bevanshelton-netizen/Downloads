import { NextResponse } from 'next/server';
import { getProductionReadiness } from '@/lib/readiness';

export const dynamic = 'force-dynamic';

export async function GET() {
  const readiness = await getProductionReadiness();
  return NextResponse.json({
    service: 'KORA',
    status: readiness.productionReady ? 'ready' : 'configuration_required',
    productionReady: readiness.productionReady,
    environment: process.env.NODE_ENV || 'unknown',
    checks: readiness.checks,
    details: readiness.details,
    timestamp: new Date().toISOString(),
  }, { status: readiness.productionReady ? 200 : 503 });
}
