import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const allowedEvents = new Set(['impression','click','complete']);

export async function POST(request: Request) {
  const jar = await cookies();
  if (jar.get('kora_child_profile')) return NextResponse.json({ error: 'Advertising events are disabled in Kids Mode' }, { status: 403 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const body = await request.json().catch(() => null) as { campaignId?: string; creativeId?: string; episodeId?: string; eventType?: string; sessionId?: string; placement?: string; watchedSeconds?: number } | null;
  if (!body?.campaignId || !body.creativeId || !body.eventType || !allowedEvents.has(body.eventType) || !body.sessionId || !/^[a-zA-Z0-9-]{16,80}$/.test(body.sessionId)) {
    return NextResponse.json({ error: 'Invalid ad event' }, { status: 400 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const { data: campaign } = await admin.from('campaigns')
    .select('id,status,starts_at,ends_at,frequency_cap_per_day,cpm_rate')
    .eq('id', body.campaignId)
    .maybeSingle();
  if (!campaign || campaign.status !== 'active' || Number(campaign.cpm_rate || 0) <= 0) return NextResponse.json({ error: 'Campaign is not deliverable' }, { status: 409 });
  if (campaign.starts_at && new Date(campaign.starts_at) > now) return NextResponse.json({ error: 'Campaign has not started' }, { status: 409 });
  if (campaign.ends_at && new Date(campaign.ends_at) <= now) return NextResponse.json({ error: 'Campaign has ended' }, { status: 409 });

  const { data: creative } = await admin.from('ad_creatives').select('id,campaign_id,moderation_status,duration_seconds').eq('id', body.creativeId).eq('campaign_id',campaign.id).maybeSingle();
  if (!creative || creative.moderation_status !== 'approved') return NextResponse.json({ error: 'Creative is not approved' }, { status: 409 });

  if (body.episodeId) {
    const { data: episode } = await admin.from('episodes').select('id').eq('id', body.episodeId).eq('status','published').maybeSingle();
    if (!episode) return NextResponse.json({ error: 'Episode is unavailable' }, { status: 409 });
  }

  const duplicateQuery = admin.from('ad_events').select('id').eq('campaign_id',campaign.id).eq('creative_id',creative.id).eq('event_type',body.eventType).eq('session_id',body.sessionId).limit(1);
  if (user) duplicateQuery.eq('user_id', user.id); else duplicateQuery.is('user_id', null);
  const { data: duplicate } = await duplicateQuery.maybeSingle();
  if (duplicate) return NextResponse.json({ eventId: duplicate.id, duplicate: true });

  if (body.eventType === 'impression' && user) {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await admin.from('ad_events').select('id', { count:'exact', head:true }).eq('campaign_id',campaign.id).eq('user_id',user.id).eq('event_type','impression').gte('created_at',cutoff);
    if ((count ?? 0) >= Number(campaign.frequency_cap_per_day || 3)) return NextResponse.json({ error: 'Frequency cap reached' }, { status: 429 });
  }

  const watchedSeconds = Math.max(0, Math.min(300, Math.round(Number(body.watchedSeconds) || 0)));
  if (body.eventType === 'complete' && creative.duration_seconds && watchedSeconds < Math.max(1, Number(creative.duration_seconds) - 2)) {
    return NextResponse.json({ error: 'Completion duration is insufficient' }, { status: 400 });
  }

  const { data, error } = await admin.from('ad_events').insert({
    campaign_id: campaign.id,
    creative_id: creative.id,
    user_id: user?.id ?? null,
    episode_id: body.episodeId || null,
    event_type: body.eventType,
    placement: String(body.placement || 'watch').slice(0,60),
    session_id: body.sessionId,
    watched_seconds: watchedSeconds,
    verified: false,
  }).select('id').single();

  if (error) return NextResponse.json({ error: 'Could not record event' }, { status: 500 });
  return NextResponse.json({ eventId: data.id, verified: false }, { status: 201 });
}
