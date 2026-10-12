import { NextResponse } from 'next/server';
import { supportedDevices } from '@/lib/ott/devices';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'KORA OTT Universal Device Layer',
    version: 1,
    devices: Object.entries(supportedDevices).map(([id, profile]) => ({ id, ...profile })),
    timestamp: new Date().toISOString(),
  });
}
