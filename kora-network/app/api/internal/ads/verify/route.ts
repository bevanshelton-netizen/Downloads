import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  const expected = process.env.KORA_INTERNAL_API_SECRET;
  const supplied = request.headers.get('x-kora-internal-secret');
  if (!expected || !supplied || supplied !== expected) return new NextResponse('Unauthorized', { status: 401 });

  const body = await request.json().catch(() => null) as { eventId?: string } | null;
  if (!body?.eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });

  const admin = createAdminClient();
  const { data: event } = await admin.from('ad_events').select('id,event_type,verified,creative_id,watched_seconds').eq('id', body.eventId).maybeSingle();
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  if (!['impression','click','complete'].includes(event.event_type)) return NextResponse.json({ error: 'Unsupported event' }, { status: 400 });
  if (event.verified) return NextResponse.json({ eventId: event.id, verified: true, duplicate: true });

  if (event.event_type === 'complete' && event.creative_id) {
    const { data: creative } = await admin.from('ad_creatives').select('duration_seconds,moderation_status').eq('id', event.creative_id).maybeSingle();
    if (!creative || creative.moderation_status !== 'approved') return NextResponse.json({ error: 'Creative is not approved' }, { status: 409 });
    if (creative.duration_seconds && Number(event.watched_seconds || 0) < Math.max(1, Number(creative.duration_seconds) - 2)) {
      return NextResponse.json({ error: 'Recorded completion duration is insufficient' }, { status: 422 });
    }
  }

  const { error } = await admin.from('ad_events').update({ verified: true, verified_at: new Date().toISOString() }).eq('id', event.id).eq('verified',false);
  if (error) return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  return NextResponse.json({ eventId: event.id, verified: true });
}
