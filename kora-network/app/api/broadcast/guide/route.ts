import { NextResponse } from 'next/server';
import { getBroadcastGuide } from '@/lib/broadcast';

export const dynamic = 'force-dynamic';

export async function GET() {
  const guide = await getBroadcastGuide();
  return NextResponse.json({ service: 'KORA EPG Engine', generatedAt: new Date().toISOString(), channels: guide });
}
