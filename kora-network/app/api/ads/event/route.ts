import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const allowedEvents = new Set(['impression','click','complete']);

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const body = await request.json().catch(() => null) as { campaignId?: string; eventType?: string } | null;
  if (!body?.campaignId || !body.eventType || !allowedEvents.has(body.eventType)) {
    return NextResponse.json({ error: 'Invalid ad event' }, { status: 400 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: campaign } = await admin
    .from('campaigns')
    .select('id,status,starts_at,ends_at')
    .eq('id', body.campaignId)
    .maybeSingle();

  if (!campaign || campaign.status !== 'active') return NextResponse.json({ error: 'Campaign is not active' }, { status: 409 });
  if (campaign.starts_at && campaign.starts_at > now) return NextResponse.json({ error: 'Campaign has not started' }, { status: 409 });
  if (campaign.ends_at && campaign.ends_at < now) return NextResponse.json({ error: 'Campaign has ended' }, { status: 409 });

  const { data, error } = await admin.from('ad_events').insert({
    campaign_id: campaign.id,
    user_id: user.id,
    event_type: body.eventType,
    verified: false,
  }).select('id').single();

  if (error) return NextResponse.json({ error: 'Could not record event' }, { status: 500 });
  return NextResponse.json({ eventId: data.id, verified: false }, { status: 201 });
}
