'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

function httpsUrl(value: string, required = true) {
  if (!value && !required) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') throw new Error('HTTPS required');
    return url.toString();
  } catch {
    throw new Error('A valid HTTPS URL is required');
  }
}

export async function createCreative(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const campaignId = String(formData.get('campaign_id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const durationSeconds = Number(formData.get('duration_seconds') || 15);
  const familySafe = formData.get('family_safe') === 'on';
  if (!campaignId || !name || !Number.isFinite(durationSeconds) || durationSeconds < 5 || durationSeconds > 180) {
    redirect('/advertiser/creatives?error=Check%20creative%20details');
  }

  const { data: campaign } = await supabase.from('campaigns').select('id').eq('id', campaignId).eq('advertiser_id', user.id).maybeSingle();
  if (!campaign) redirect('/advertiser/creatives?error=Campaign%20not%20found');

  let mediaUrl: string;
  let clickUrl: string | null;
  try {
    mediaUrl = httpsUrl(String(formData.get('media_url') ?? ''))!;
    clickUrl = httpsUrl(String(formData.get('click_url') ?? '').trim(), false);
  } catch {
    redirect('/advertiser/creatives?error=Creative%20and%20click%20URLs%20must%20use%20HTTPS');
  }

  const { error } = await supabase.from('campaign_creatives').insert({
    campaign_id: campaign.id,
    name,
    media_url: mediaUrl,
    click_url: clickUrl,
    duration_seconds: durationSeconds,
    family_safe: familySafe,
    status: 'draft',
  });
  if (error) redirect(`/advertiser/creatives?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/advertiser/creatives');
}

export async function submitCreative(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const creativeId = String(formData.get('creative_id') ?? '');
  if (!creativeId) return;

  const { data: creative } = await supabase.from('campaign_creatives').select('id,campaign_id,status').eq('id', creativeId).maybeSingle();
  if (!creative || !['draft','rejected'].includes(creative.status)) redirect('/advertiser/creatives?error=Creative%20cannot%20be%20submitted');
  const { data: campaign } = await supabase.from('campaigns').select('id').eq('id', creative.campaign_id).eq('advertiser_id', user.id).maybeSingle();
  if (!campaign) redirect('/advertiser/creatives?error=Campaign%20not%20found');

  const { error } = await supabase.from('campaign_creatives').update({ status: 'submitted', updated_at: new Date().toISOString() }).eq('id', creative.id);
  if (error) redirect(`/advertiser/creatives?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/advertiser/creatives');
}
