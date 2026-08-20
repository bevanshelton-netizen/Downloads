import { NextResponse } from 'next/server';
import { getLaunchReadiness } from '@/lib/launch-readiness';

export const dynamic = 'force-dynamic';

export async function GET() {
  const readiness = await getLaunchReadiness();
  return NextResponse.json(readiness, { status: readiness.productionReady ? 200 : 503 });
}
