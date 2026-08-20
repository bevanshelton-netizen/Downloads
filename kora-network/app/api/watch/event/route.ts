import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const allowed = new Set(['start','progress','complete']);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    episodeId?: string;
    eventType?: string;
    secondsWatched?: number;
    sessionId?: string;
  } | null;

  if (!body?.episodeId || !body.eventType || !allowed.has(body.eventType)) {
    return NextResponse.json({ error: 'Invalid watch event' }, { status: 400 });
  }
  const sessionId = String(body.sessionId || '').trim();
  if (sessionId.length < 16 || sessionId.length > 100) return NextResponse.json({ error: 'Invalid session' }, { status: 400 });

  const admin = createAdminClient();
  const { data: episode } = await admin.from('episodes')
    .select('id,duration_seconds,status')
    .eq('id', body.episodeId)
    .eq('status', 'published')
    .maybeSingle();
  if (!episode) return NextResponse.json({ error: 'Episode not available' }, { status: 404 });

  const rawSeconds = Number(body.secondsWatched || 0);
  const maximum = Math.max(Number(episode.duration_seconds || 0), 0);
  const secondsWatched = Number.isFinite(rawSeconds)
    ? Math.max(0, Math.min(Math.floor(rawSeconds), maximum || 86400))
    : 0;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await admin.from('watch_events').insert({
    user_id: user?.id ?? null,
    episode_id: episode.id,
    event_type: body.eventType,
    seconds_watched: secondsWatched,
    session_id: sessionId,
  });
  if (error) return NextResponse.json({ error: 'Could not record watch event' }, { status: 500 });

  return new NextResponse(null, { status: 204 });
}
