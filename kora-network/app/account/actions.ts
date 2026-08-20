'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

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
