import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    service: 'KORA',
    status: 'ok',
    environment: process.env.NODE_ENV || 'unknown',
    timestamp: new Date().toISOString(),
  });
}
