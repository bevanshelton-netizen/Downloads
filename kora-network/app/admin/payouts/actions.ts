'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') redirect('/');
}

export async function verifyPayoutOnboarding(formData: FormData) {
  await requireAdmin();
  const ownerId = String(formData.get('owner_id') ?? '');
  const kycStatus = String(formData.get('kyc_status') ?? '');
  const payoutStatus = String(formData.get('payout_status') ?? '');
  const provider = String(formData.get('provider') ?? '').trim();
  const providerAccountRef = String(formData.get('provider_account_ref') ?? '').trim();
  const accountLast4 = String(formData.get('account_last4') ?? '').trim();

  if (!ownerId || !['unverified','pending','verified','rejected'].includes(kycStatus) || !['pending','verified','rejected','suspended'].includes(payoutStatus)) {
    redirect('/admin/payouts?error=Invalid%20verification%20state');
  }
  if (accountLast4 && !/^\d{4}$/.test(accountLast4)) redirect('/admin/payouts?error=Destination%20last%204%20must%20be%204%20digits');
  if (payoutStatus === 'verified' && (!provider || !providerAccountRef)) redirect('/admin/payouts?error=Verified%20payouts%20require%20an%20approved%20provider%20reference');

  const admin = createAdminClient();
  const { error: profileError } = await admin.from('profiles').update({ kyc_status: kycStatus }).eq('id', ownerId);
  if (profileError) redirect(`/admin/payouts?error=${encodeURIComponent(profileError.message)}`);

  const { error: payoutError } = await admin.from('payout_profiles').update({
    status: payoutStatus,
    provider: provider || null,
    provider_account_ref: providerAccountRef || null,
    account_last4: accountLast4 || null,
    updated_at: new Date().toISOString(),
  }).eq('owner_id', ownerId);
  if (payoutError) redirect(`/admin/payouts?error=${encodeURIComponent(payoutError.message)}`);

  revalidatePath('/admin/payouts');
  revalidatePath('/studio/earnings');
}

export async function resolvePayout(formData: FormData) {
  await requireAdmin();
  const payoutRequestId = String(formData.get('payout_request_id') ?? '');
  const decision = String(formData.get('decision') ?? '');
  if (!payoutRequestId || !['paid','rejected'].includes(decision)) return;

  const admin = createAdminClient();
  const { error } = await admin.rpc('resolve_payout_request', { p_request_id: payoutRequestId, p_decision: decision });
  if (error) redirect(`/admin/payouts?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/admin/payouts');
  revalidatePath('/studio/earnings');
}
