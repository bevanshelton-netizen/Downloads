'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function createCampaign(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const name = String(formData.get('name') ?? '').trim();
  const budget = Number(formData.get('budget'));
  const rewardPool = Number(formData.get('reward_pool') || 0);
  const rewardPerCompletion = Number(formData.get('reward_per_completion') || 0);
  const startsAt = String(formData.get('starts_at') ?? '');
  const endsAt = String(formData.get('ends_at') ?? '');

  if (!name || !Number.isFinite(budget) || budget <= 0 || rewardPool < 0 || rewardPool > budget || rewardPerCompletion < 0 || rewardPerCompletion > rewardPool) {
    redirect('/advertiser?error=Check%20campaign%20budget%2C%20reward%20allocation%20and%20per-view%20reward');
  }
  if (rewardPool === 0 && rewardPerCompletion > 0) redirect('/advertiser?error=Allocate%20a%20reward%20pool%20before%20setting%20a%20viewer%20reward');
  if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) redirect('/advertiser?error=End%20date%20must%20follow%20start%20date');

  const { error } = await supabase.from('campaigns').insert({
    advertiser_id: user.id,
    name,
    budget,
    reward_pool: rewardPool,
    reward_per_completion: rewardPerCompletion,
    starts_at: startsAt ? new Date(startsAt).toISOString() : null,
    ends_at: endsAt ? new Date(endsAt).toISOString() : null,
    status: 'draft',
  });
  if (error) redirect(`/advertiser?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/advertiser');
}
