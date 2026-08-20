'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function acceptCreatorDeal(formData: FormData) {
  const dealId = String(formData.get('deal_id') ?? '');
  if (!dealId) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/studio/earnings');
  const { error } = await supabase.rpc('accept_creator_deal', { p_deal_id: dealId });
  if (error) redirect(`/studio/earnings?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/studio/earnings');
}

export async function submitPayoutOnboarding(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/studio/earnings');

  const legalName = String(formData.get('legal_name') ?? '').trim();
  const countryCode = String(formData.get('country_code') ?? 'ZA').trim().toUpperCase();
  const preferredMethod = String(formData.get('preferred_method') ?? 'bank_eft');

  const { error } = await supabase.rpc('submit_payout_profile', {
    p_legal_name: legalName,
    p_country_code: countryCode,
    p_preferred_method: preferredMethod,
  });
  if (error) redirect(`/studio/earnings?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/studio/earnings');
}

export async function requestPayout(formData: FormData) {
  const amount = Number(formData.get('amount'));
  if (!Number.isFinite(amount) || amount < 100) redirect('/studio/earnings?error=Minimum%20payout%20is%20R100');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/studio/earnings');

  const { error } = await supabase.rpc('request_wallet_payout', { p_amount: amount });
  if (error) redirect(`/studio/earnings?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/studio/earnings');
  redirect('/studio/earnings?payout=requested');
}
