import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const allowedEvents = new Set(['start','heartbeat']);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { episodeId?: string; eventType?: string; sessionId?: string; seconds?: number } | null;
  if (!body?.episodeId || !body.eventType || !allowedEvents.has(body.eventType) || !body.sessionId || !/^[a-zA-Z0-9-]{16,80}$/.test(body.sessionId)) {
    return NextResponse.json({ error: 'Invalid engagement event' }, { status: 400 });
  }

  const seconds = body.eventType === 'heartbeat' ? Math.max(1, Math.min(60, Number(body.seconds) || 30)) : 0;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();

  const { data: episode } = await admin.from('episodes').select('id').eq('id', body.episodeId).eq('status','published').maybeSingle();
  if (!episode) return NextResponse.json({ error: 'Episode is not available' }, { status: 404 });

  if (body.eventType === 'start') {
    const { data: existing } = await admin.from('watch_events').select('id').eq('episode_id', episode.id).eq('session_id', body.sessionId).eq('event_type','start').limit(1).maybeSingle();
    if (existing) return NextResponse.json({ recorded: false, duplicate: true });
  } else {
    const cutoff = new Date(Date.now() - 20_000).toISOString();
    const { data: recent } = await admin.from('watch_events').select('id').eq('episode_id', episode.id).eq('session_id', body.sessionId).eq('event_type','heartbeat').gte('created_at', cutoff).limit(1).maybeSingle();
    if (recent) return NextResponse.json({ recorded: false, rateLimited: true }, { status: 429 });
  }

  const { error } = await admin.from('watch_events').insert({
    user_id: user?.id ?? null,
    episode_id: episode.id,
    event_type: body.eventType,
    seconds_watched: seconds,
    session_id: body.sessionId,
  });
  if (error) return NextResponse.json({ error: 'Could not record engagement' }, { status: 500 });

  return NextResponse.json({ recorded: true });
}
