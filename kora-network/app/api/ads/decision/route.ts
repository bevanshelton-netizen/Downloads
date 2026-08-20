import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const placementTypes = new Set(['pre_roll','mid_roll','post_roll','sponsored_unlock','display']);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    viewerProfileId?: string;
    episodeId?: string;
    channelId?: string;
    placementType?: string;
  } | null;

  const placementType = body?.placementType || 'pre_roll';
  if (!placementTypes.has(placementType)) return NextResponse.json({ error: 'Invalid placement type' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let viewerProfile: { id: string; profile_kind: string; rewards_allowed: boolean; personalised_ads_allowed: boolean } | null = null;

  if (body?.viewerProfileId) {
    if (!user) return NextResponse.json({ error: 'Authentication required for a household profile' }, { status: 401 });
    const { data } = await supabase
      .from('viewer_profiles')
      .select('id,profile_kind,rewards_allowed,personalised_ads_allowed')
      .eq('id', body.viewerProfileId)
      .eq('owner_id', user.id)
      .maybeSingle();
    if (!data) return NextResponse.json({ error: 'Viewer profile not found' }, { status: 404 });
    viewerProfile = data;
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: campaigns } = await admin
    .from('campaigns')
    .select('id,reward_per_completion,budget,reward_pool,media_cpm,media_spend')
    .eq('status', 'active')
    .gt('media_cpm', 0)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gt.${now}`);

  const eligibleCampaigns = (campaigns ?? []).filter(c => {
    const cost = Number(c.media_cpm || 0) / 1000;
    return cost > 0 && Number(c.media_spend || 0) + cost <= Math.max(Number(c.budget || 0) - Number(c.reward_pool || 0), 0);
  });
  if (!eligibleCampaigns.length) return new NextResponse(null, { status: 204 });
  const campaignById = new Map(eligibleCampaigns.map(c => [c.id, c]));

  let creativeQuery = admin
    .from('campaign_creatives')
    .select('id,campaign_id,name,media_url,click_url,duration_seconds,family_safe')
    .eq('status', 'approved')
    .in('campaign_id', eligibleCampaigns.map(c => c.id));

  if (viewerProfile?.profile_kind === 'child') creativeQuery = creativeQuery.eq('family_safe', true);
  const { data: creatives } = await creativeQuery.limit(50);
  if (!creatives?.length) return new NextResponse(null, { status: 204 });

  // Selection is contextual, never behavioural. Shuffle candidates so one campaign does not
  // permanently occupy the first slot, then let the database atomically reserve media spend.
  const candidates = [...creatives].sort(() => Math.random() - 0.5);
  for (const creative of candidates) {
    const campaign = campaignById.get(creative.campaign_id);
    if (!campaign) continue;

    const rewardsAllowed = Boolean(user) && (!viewerProfile || viewerProfile.rewards_allowed) && viewerProfile?.profile_kind !== 'child';
    const rewardAmount = Number(campaign.reward_per_completion || 0);
    const rewardEligible = rewardsAllowed && rewardAmount > 0;

    const { data: deliveryId, error } = await admin.rpc('issue_contextual_ad_delivery', {
      p_campaign_id: campaign.id,
      p_creative_id: creative.id,
      p_user_id: user?.id ?? null,
      p_viewer_profile_id: viewerProfile?.id ?? null,
      p_episode_id: body?.episodeId || null,
      p_channel_id: body?.channelId || null,
      p_placement_type: placementType,
      p_reward_eligible: rewardEligible,
    });
    if (error || !deliveryId) continue;

    return NextResponse.json({
      deliveryId,
      campaignId: campaign.id,
      creative: {
        id: creative.id,
        name: creative.name,
        mediaUrl: creative.media_url,
        clickUrl: creative.click_url,
        durationSeconds: creative.duration_seconds,
      },
      rewardEligible,
      rewardAmount: rewardEligible ? rewardAmount : 0,
      targeting: 'contextual',
    });
  }

  return new NextResponse(null, { status: 204 });
}
