import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { getIkhokhaPaymentStatus } from '@/lib/ikhokha';

export async function reconcileIkhokhaPurchase(orderId: string) {
  const admin = createAdminClient();
  const { data: purchase, error: lookupError } = await admin
    .from('purchases')
    .select('id,amount,currency,status,provider,provider_payment_id')
    .eq('id', orderId)
    .eq('provider', 'ikhokha')
    .maybeSingle();

  if (lookupError) throw new Error('Could not load iKhokha purchase');
  if (!purchase) return false;
  if (purchase.status === 'complete') return true;
  if (purchase.status !== 'pending' || !purchase.provider_payment_id) return false;

  const status = await getIkhokhaPaymentStatus(purchase.provider_payment_id);
  if (status.status !== 'PAID') return false;

  const expectedCents = Math.round(Number(purchase.amount) * 100);
  if (!Number.isFinite(expectedCents) || expectedCents <= 0) {
    throw new Error('Stored purchase amount is invalid');
  }
  if (Number(status.amount) !== expectedCents) {
    throw new Error('iKhokha payment amount mismatch');
  }

  const { error: revenueError } = await admin.from('revenue_events').insert({
    source_type: 'ikhokha_purchase',
    source_id: purchase.provider_payment_id,
    gross_amount: Number(purchase.amount),
    currency: purchase.currency || 'ZAR',
    cleared: true,
    cleared_at: new Date().toISOString(),
  });

  if (revenueError && revenueError.code !== '23505') {
    throw new Error('Could not record iKhokha revenue');
  }

  const { data: completed, error: completeError } = await admin
    .from('purchases')
    .update({ status: 'complete' })
    .eq('id', purchase.id)
    .eq('provider', 'ikhokha')
    .eq('provider_payment_id', purchase.provider_payment_id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (completeError) throw new Error('Could not unlock iKhokha purchase');
  if (completed) return true;

  const { data: alreadyComplete } = await admin
    .from('purchases')
    .select('id')
    .eq('id', purchase.id)
    .eq('provider', 'ikhokha')
    .eq('status', 'complete')
    .maybeSingle();

  return Boolean(alreadyComplete);
}
