import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function upstreamOrigin() {
  const configured = String(process.env.IZAKHONO_COMMANDS_ORIGIN || '').trim();
  const raw = configured || 'https://ai.izakhono.co.za';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') throw new Error('HTTPS required');
    return url.origin;
  } catch {
    return 'https://ai.izakhono.co.za';
  }
}

async function proxy(request: NextRequest, path: '/api/commands' | '/api/commands/run') {
  const secret = request.headers.get('x-admin-secret') || '';
  if (!secret) {
    return NextResponse.json({ ok: false, error: 'Owner credential required.' }, { status: 401 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const init: RequestInit = {
      method: request.method,
      headers: {
        'x-admin-secret': secret,
        'accept': 'application/json',
      },
      cache: 'no-store',
      signal: controller.signal,
    };
    if (request.method === 'POST') {
      init.headers = { ...init.headers, 'content-type': 'application/json' };
      init.body = await request.text();
    }

    const response = await fetch(upstreamOrigin() + path, init);
    const text = await response.text();
    const headers = new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    return new Response(text || JSON.stringify({ ok: response.ok }), { status: response.status, headers });
  } catch {
    return NextResponse.json({
      ok: false,
      fallback: true,
      error: 'IZAKHONO owned command runtime is currently unreachable. The external command mirror remains available in resilience mode.',
    }, { status: 503, headers: { 'cache-control': 'no-store' } });
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: NextRequest) {
  return proxy(request, '/api/commands');
}

export async function POST(request: NextRequest) {
  return proxy(request, '/api/commands/run');
}
