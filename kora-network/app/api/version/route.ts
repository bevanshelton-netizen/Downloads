import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || null;
  return NextResponse.json({
    service: 'KORA',
    appVersion: process.env.npm_package_version || 'unknown',
    schemaVersion: 14,
    commit: commit ? commit.slice(0, 12) : null,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
    timestamp: new Date().toISOString(),
  });
}
