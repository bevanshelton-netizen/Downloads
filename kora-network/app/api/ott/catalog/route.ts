import { NextResponse } from 'next/server';
import { starterCatalog } from '@/lib/ott/catalog';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ok: true,
    catalog: {
      channels: starterCatalog.channels.filter((channel) => channel.active),
      programmes: starterCatalog.programmes,
    },
    timestamp: new Date().toISOString(),
  });
}
