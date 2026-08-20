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
  const startsAt = String(formData.get('starts_at') ?? '');
  const endsAt = String(formData.get('ends_at') ?? '');

  if (!name || !Number.isFinite(budget) || budget <= 0 || rewardPool < 0 || rewardPool > budget) {
    redirect('/advertiser?error=Check%20campaign%20name%2C%20budget%20and%20reward%20pool');
  }
  if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) redirect('/advertiser?error=End%20date%20must%20follow%20start%20date');

  const { error } = await supabase.from('campaigns').insert({
    advertiser_id: user.id,
    name,
    budget,
    reward_pool: rewardPool,
    starts_at: startsAt ? new Date(startsAt).toISOString() : null,
    ends_at: endsAt ? new Date(endsAt).toISOString() : null,
    status: 'draft',
  });
  if (error) redirect(`/advertiser?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/advertiser');
}
