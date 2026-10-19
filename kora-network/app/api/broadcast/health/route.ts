import { NextResponse } from 'next/server';
import { getBroadcastEngineSummary } from '@/lib/broadcast-engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  const summary = getBroadcastEngineSummary();
  const status = summary.state === 'verified' ? 200 : 503;
  return NextResponse.json({ service: 'KORA Broadcast Engine', ...summary, timestamp: new Date().toISOString() }, { status });
}
