import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const allowedEvents = new Set(['impression','click','complete']);

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const body = await request.json().catch(() => null) as { deliveryId?: string; campaignId?: string; eventType?: string } | null;
  if (!body?.eventType || !allowedEvents.has(body.eventType)) return NextResponse.json({ error: 'Invalid ad event' }, { status: 400 });
  if (body.eventType === 'complete' && !body.deliveryId) return NextResponse.json({ error: 'Completed ads require a delivery token' }, { status: 400 });
  if (!body.deliveryId && !body.campaignId) return NextResponse.json({ error: 'Missing ad attribution' }, { status: 400 });
  if (!body.deliveryId && !user) return NextResponse.json({ error: 'Authentication required without a delivery token' }, { status: 401 });

  const admin = createAdminClient();
  let campaignId = body.campaignId || '';
  let eventUserId: string | null = user?.id ?? null;
  let creativeId: string | null = null;
  let viewerProfileId: string | null = null;
  let episodeId: string | null = null;

  if (body.deliveryId) {
    const { data: delivery } = await admin
      .from('ad_deliveries')
      .select('id,campaign_id,creative_id,user_id,viewer_profile_id,episode_id')
      .eq('id', body.deliveryId)
      .maybeSingle();
    if (!delivery) return NextResponse.json({ error: 'Ad delivery not found' }, { status: 404 });
    if (delivery.user_id && !user) return NextResponse.json({ error: 'Authentication required for this delivery' }, { status: 401 });
    if (delivery.user_id && delivery.user_id !== user?.id) return NextResponse.json({ error: 'Ad delivery does not belong to this viewer' }, { status: 403 });
    campaignId = delivery.campaign_id;
    eventUserId = delivery.user_id;
    creativeId = delivery.creative_id;
    viewerProfileId = delivery.viewer_profile_id;
    episodeId = delivery.episode_id;
  }

  const now = new Date().toISOString();
  const { data: campaign } = await admin
    .from('campaigns')
    .select('id,status,starts_at,ends_at')
    .eq('id', campaignId)
    .maybeSingle();

  if (!campaign || campaign.status !== 'active') return NextResponse.json({ error: 'Campaign is not active' }, { status: 409 });
  if (campaign.starts_at && campaign.starts_at > now) return NextResponse.json({ error: 'Campaign has not started' }, { status: 409 });
  if (campaign.ends_at && campaign.ends_at < now) return NextResponse.json({ error: 'Campaign has ended' }, { status: 409 });

  const { data, error } = await admin.from('ad_events').insert({
    campaign_id: campaign.id,
    user_id: eventUserId,
    event_type: body.eventType,
    verified: false,
    delivery_id: body.deliveryId || null,
    creative_id: creativeId,
    viewer_profile_id: viewerProfileId,
    episode_id: episodeId,
  }).select('id').single();

  if (error?.code === '23505') return NextResponse.json({ error: 'This delivery event was already recorded' }, { status: 409 });
  if (error) return NextResponse.json({ error: 'Could not record event' }, { status: 500 });
  return NextResponse.json({ eventId: data.id, verified: false }, { status: 201 });
}
