import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function matchesTarget(targets: string[] | null, value: string | null) {
  if (!targets?.length) return true;
  if (!value) return false;
  const normal = value.trim().toLowerCase();
  return targets.some(item => item.trim().toLowerCase() === normal);
}

export async function GET(request: Request) {
  const jar = await cookies();
  if (jar.get('kora_child_profile')) return NextResponse.json({ ad: null, reason: 'kids_mode' });

  const url = new URL(request.url);
  const episodeId = url.searchParams.get('episodeId');
  if (!episodeId) return NextResponse.json({ error: 'Missing episodeId' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();

  const { data: episode } = await admin.from('episodes').select('id,production_id,status').eq('id', episodeId).eq('status','published').maybeSingle();
  if (!episode) return NextResponse.json({ ad: null, reason: 'episode_unavailable' });
  const { data: production } = await admin.from('productions').select('id,genre,primary_language,status').eq('id', episode.production_id).eq('status','published').maybeSingle();
  if (!production) return NextResponse.json({ ad: null, reason: 'production_unavailable' });

  const now = new Date();
  const { data: campaigns } = await admin.from('campaigns')
    .select('id,name,status,starts_at,ends_at,target_genres,target_languages,frequency_cap_per_day,cpm_rate,reward_per_completion')
    .eq('status','active')
    .gt('cpm_rate', 0)
    .limit(50);

  const candidates = (campaigns ?? []).filter(campaign => {
    if (campaign.starts_at && new Date(campaign.starts_at) > now) return false;
    if (campaign.ends_at && new Date(campaign.ends_at) <= now) return false;
    if (!matchesTarget(campaign.target_genres, production.genre)) return false;
    if (!matchesTarget(campaign.target_languages, production.primary_language)) return false;
    return true;
  });

  if (!candidates.length) return NextResponse.json({ ad: null, reason: 'no_campaign' });
  const creativeResult = await admin.from('ad_creatives').select('id,campaign_id,title,media_type,media_url,click_url,duration_seconds').in('campaign_id', candidates.map(c => c.id)).eq('moderation_status','approved');
  const creatives = creativeResult.data ?? [];
  const rollingCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  for (const campaign of candidates) {
    const campaignCreatives = creatives.filter(c => c.campaign_id === campaign.id);
    if (!campaignCreatives.length) continue;

    if (user) {
      const { count: userImpressions } = await admin.from('ad_events').select('id', { count:'exact', head:true }).eq('campaign_id', campaign.id).eq('user_id', user.id).eq('event_type','impression').gte('created_at', rollingCutoff);
      if ((userImpressions ?? 0) >= Number(campaign.frequency_cap_per_day || 3)) continue;
    }

    const [{ data: clearedRows }, { count: deliveredImpressions }] = await Promise.all([
      admin.from('revenue_events').select('gross_amount').eq('source_type','campaign').eq('source_id',campaign.id).eq('cleared',true),
      admin.from('ad_events').select('id', { count:'exact', head:true }).eq('campaign_id', campaign.id).eq('event_type','impression'),
    ]);
    const clearedGross = (clearedRows ?? []).reduce((sum,row) => sum + Number(row.gross_amount || 0), 0);
    const cpm = Number(campaign.cpm_rate || 0);
    const maxImpressions = cpm > 0 ? Math.floor((clearedGross / cpm) * 1000) : 0;
    if (maxImpressions < 1 || (deliveredImpressions ?? 0) >= maxImpressions) continue;

    const creative = campaignCreatives[Math.floor(Math.random() * campaignCreatives.length)];
    return NextResponse.json({
      ad: {
        campaignId: campaign.id,
        campaignName: campaign.name,
        creativeId: creative.id,
        title: creative.title,
        mediaType: creative.media_type,
        mediaUrl: creative.media_url,
        clickUrl: creative.click_url,
        durationSeconds: creative.duration_seconds,
        rewardEligible: Boolean(user && Number(campaign.reward_per_completion || 0) > 0),
        rewardPerVerifiedCompletion: user ? Number(campaign.reward_per_completion || 0) : 0,
      },
    });
  }

  return NextResponse.json({ ad: null, reason: 'delivery_caps' });
}
