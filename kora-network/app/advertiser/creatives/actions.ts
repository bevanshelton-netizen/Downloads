'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

function safeHttps(value: string, required = true) {
  if (!value && !required) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function submitCreative(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/advertiser/creatives');

  const campaignId = String(formData.get('campaign_id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const mediaType = String(formData.get('media_type') ?? '');
  const mediaInput = String(formData.get('media_url') ?? '').trim();
  const clickInput = String(formData.get('click_url') ?? '').trim();
  const duration = Number(formData.get('duration_seconds') || 0);
  const mediaUrl = safeHttps(mediaInput);
  const clickUrl = safeHttps(clickInput, false);

  if (!campaignId || title.length < 2 || !['image','video'].includes(mediaType) || !mediaUrl || (clickInput && !clickUrl)) {
    redirect('/advertiser/creatives?error=Complete%20the%20creative%20and%20use%20HTTPS%20media%20and%20click%20links');
  }
  if (mediaType === 'video' && (!Number.isFinite(duration) || duration < 1 || duration > 300)) {
    redirect('/advertiser/creatives?error=Video%20duration%20must%20be%20between%201%20and%20300%20seconds');
  }

  const { data: campaign } = await supabase.from('campaigns').select('id').eq('id', campaignId).eq('advertiser_id', user.id).maybeSingle();
  if (!campaign) redirect('/advertiser/creatives?error=Campaign%20not%20found');

  const { error } = await supabase.from('ad_creatives').insert({
    campaign_id: campaign.id,
    title,
    media_type: mediaType,
    media_url: mediaUrl,
    click_url: clickUrl,
    duration_seconds: mediaType === 'video' ? Math.round(duration) : null,
    moderation_status: 'pending',
  });
  if (error) redirect(`/advertiser/creatives?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/advertiser/creatives');
  redirect('/advertiser/creatives?submitted=1');
}
