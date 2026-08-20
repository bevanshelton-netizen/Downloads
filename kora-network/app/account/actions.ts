'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cancelPayFastSubscription } from '@/lib/payfast';

export async function requestPayout(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const amount = Number(formData.get('amount'));
  if (!Number.isFinite(amount) || amount < 100) redirect('/account?error=Minimum%20payout%20is%20R100');

  const { error } = await supabase.rpc('request_wallet_payout', { p_amount: amount });
  if (error) redirect(`/account?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/account');
  redirect('/account?payout=requested');
}

export async function cancelMembership(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const subscriptionId = String(formData.get('subscription_id') ?? '');
  if (!subscriptionId) redirect('/account?error=Membership%20was%20not%20found');

  const admin = createAdminClient();
  const { data: membership, error } = await admin
    .from('subscriptions')
    .select('id,status,provider_subscription_id,current_period_end,cancel_at_period_end')
    .eq('id', subscriptionId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (error || !membership || membership.status !== 'active') redirect('/account?error=Active%20membership%20was%20not%20found');
  if (membership.cancel_at_period_end) redirect('/account?membership=cancelling');
  if (!membership.provider_subscription_id) redirect('/account?error=PayFast%20has%20not%20confirmed%20the%20recurring%20membership%20token%20yet');

  try {
    await cancelPayFastSubscription(membership.provider_subscription_id);
  } catch (cancelError) {
    redirect(`/account?error=${encodeURIComponent(cancelError instanceof Error ? cancelError.message : 'Could not cancel recurring billing')}`);
  }

  const { error: updateError } = await admin
    .from('subscriptions')
    .update({ cancel_at_period_end: true })
    .eq('id', membership.id);
  if (updateError) redirect(`/account?error=${encodeURIComponent(updateError.message)}`);

  revalidatePath('/account');
  redirect('/account?membership=cancelling');
}
