import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  const expected = process.env.KORA_INTERNAL_API_SECRET;
  const supplied = request.headers.get('x-kora-internal-secret');
  if (!expected || !supplied || supplied !== expected) return new NextResponse('Unauthorized', { status: 401 });

  const body = await request.json().catch(() => null) as { eventId?: string } | null;
  if (!body?.eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });

  const admin = createAdminClient();
  const { data: event } = await admin.from('ad_events').select('id,event_type,verified,delivery_id').eq('id', body.eventId).maybeSingle();
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  if (!['impression','click','complete'].includes(event.event_type)) return NextResponse.json({ error: 'Unsupported event' }, { status: 400 });

  const { error } = await admin.from('ad_events').update({ verified: true }).eq('id', event.id);
  if (error) return NextResponse.json({ error: 'Verification failed' }, { status: 500 });

  if (event.event_type === 'complete' && event.delivery_id) {
    const { error: deliveryError } = await admin.from('ad_deliveries').update({
      completed_at: new Date().toISOString(),
      verified: true,
    }).eq('id', event.delivery_id);
    if (deliveryError) return NextResponse.json({ error: 'Delivery verification failed' }, { status: 500 });
  }

  return NextResponse.json({ eventId: event.id, verified: true });
}
