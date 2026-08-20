'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { legal } from '@/lib/legal';

function catLocalToIso(value: string) {
  const withSeconds = value.length === 16 ? `${value}:00` : value;
  const parsed = new Date(`${withSeconds}+02:00`);
  if (Number.isNaN(parsed.getTime())) throw new Error('Invalid CAT date/time');
  return parsed.toISOString();
}

function csvList(value: FormDataEntryValue | null) {
  return String(value ?? '').split(',').map(x => x.trim()).filter(Boolean).slice(0, 20);
}

export async function createCampaign(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: acceptance } = await supabase.from('agreement_acceptances')
    .select('id')
    .eq('user_id', user.id)
    .eq('document_code', legal.advertiserTerms.code)
    .eq('document_version', legal.advertiserTerms.version)
    .maybeSingle();
  if (!acceptance) redirect('/legal/advertiser-terms/accept');

  const name = String(formData.get('name') ?? '').trim();
  const budget = Number(formData.get('budget'));
  const rewardPool = Number(formData.get('reward_pool') || 0);
  const rewardPerCompletion = Number(formData.get('reward_per_completion') || 0);
  const targetGenres = csvList(formData.get('target_genres'));
  const targetLanguages = csvList(formData.get('target_languages'));
  const startsAt = String(formData.get('starts_at') ?? '');
  const endsAt = String(formData.get('ends_at') ?? '');

  if (!name || !Number.isFinite(budget) || budget <= 0 || rewardPool < 0 || rewardPool > budget || rewardPerCompletion < 0 || rewardPerCompletion > rewardPool) {
    redirect('/advertiser?error=Check%20campaign%20budget%2C%20reward%20allocation%20and%20per-view%20reward');
  }
  if (rewardPool === 0 && rewardPerCompletion > 0) redirect('/advertiser?error=Allocate%20a%20reward%20pool%20before%20setting%20a%20viewer%20reward');

  let startIso: string | null = null;
  let endIso: string | null = null;
  try {
    startIso = startsAt ? catLocalToIso(startsAt) : null;
    endIso = endsAt ? catLocalToIso(endsAt) : null;
  } catch {
    redirect('/advertiser?error=Invalid%20campaign%20date%20or%20time');
  }
  if (startIso && endIso && new Date(endIso) <= new Date(startIso)) redirect('/advertiser?error=End%20date%20must%20follow%20start%20date');

  const { error } = await supabase.from('campaigns').insert({
    advertiser_id: user.id,
    name,
    budget,
    reward_pool: rewardPool,
    reward_per_completion: rewardPerCompletion,
    target_genres: targetGenres,
    target_languages: targetLanguages,
    starts_at: startIso,
    ends_at: endIso,
    status: 'draft',
  });
  if (error) redirect(`/advertiser?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/advertiser');
}
