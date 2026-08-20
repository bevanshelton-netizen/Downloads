import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateItn } from '@/lib/payfast';

export async function POST(request: Request) {
  const raw = await request.text();
  const params = new URLSearchParams(raw);
  const fields = Object.fromEntries(params.entries());

  const valid = await validateItn(fields).catch(() => false);
  if (!valid) return new NextResponse('Invalid', { status: 400 });

  const orderId = fields.m_payment_id;
  const paymentStatus = fields.payment_status;
  if (!orderId) return new NextResponse('Missing order', { status: 400 });

  const admin = createAdminClient();
  const status = paymentStatus === 'COMPLETE' ? 'active' : paymentStatus?.toLowerCase() || 'pending';
  const currentPeriodEnd = paymentStatus === 'COMPLETE'
    ? new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const { error } = await admin
    .from('subscriptions')
    .update({
      status,
      provider_subscription_id: fields.pf_payment_id || null,
      current_period_end: currentPeriodEnd,
    })
    .eq('id', orderId);

  if (error) return new NextResponse('Persistence failure', { status: 500 });
  return new NextResponse('OK');
}
