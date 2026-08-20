'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function submitKyc(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: creator } = await supabase.from('creators').select('id').eq('owner_id', user.id).maybeSingle();
  if (!creator) redirect('/studio/payouts?error=Create%20a%20creator%20profile%20first');

  const legalName = String(formData.get('legal_name') ?? '').trim();
  const entityType = String(formData.get('entity_type') ?? 'individual');
  const bankAccountName = String(formData.get('bank_account_name') ?? '').trim();
  const bankName = String(formData.get('bank_name') ?? '').trim();
  const bankLast4 = String(formData.get('bank_account_last4') ?? '').replace(/\D/g,'').slice(-4);
  if (!legalName || !bankAccountName || !bankName || bankLast4.length !== 4) redirect('/studio/payouts?error=Complete%20the%20required%20KYC%20and%20bank%20fields');

  const payload = {
    creator_id: creator.id,
    legal_name: legalName,
    entity_type: entityType,
    country_code: String(formData.get('country_code') ?? 'ZA').toUpperCase().slice(0,2),
    identity_reference: String(formData.get('identity_reference') ?? '').trim() || null,
    company_registration: String(formData.get('company_registration') ?? '').trim() || null,
    tax_reference: String(formData.get('tax_reference') ?? '').trim() || null,
    bank_account_name: bankAccountName,
    bank_name: bankName,
    bank_account_last4: bankLast4,
    status: 'submitted',
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('creator_kyc').upsert(payload, { onConflict: 'creator_id' });
  if (error) redirect(`/studio/payouts?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/studio/payouts');
}

export async function requestPayout(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: creator } = await supabase.from('creators').select('id').eq('owner_id', user.id).maybeSingle();
  if (!creator) redirect('/studio/payouts?error=Creator%20profile%20not%20found');
  const amount = Number(formData.get('amount'));
  if (!Number.isFinite(amount) || amount <= 0) redirect('/studio/payouts?error=Enter%20a%20valid%20payout%20amount');
  const { error } = await supabase.rpc('request_creator_payout', { p_creator_id: creator.id, p_amount: amount });
  if (error) redirect(`/studio/payouts?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/studio/payouts');
}
