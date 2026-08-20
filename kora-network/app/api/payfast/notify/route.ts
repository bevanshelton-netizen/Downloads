import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { plans, type PlanCode, validateItn } from '@/lib/payfast';

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
  const { data: subscription, error: lookupError } = await admin
    .from('subscriptions')
    .select('id,plan_code,status')
    .eq('id', orderId)
    .maybeSingle();
  if (lookupError || !subscription) return new NextResponse('Unknown order', { status: 404 });

  const planCode = subscription.plan_code as PlanCode;
  if (!(planCode in plans)) return new NextResponse('Unknown plan', { status: 400 });
  const expectedAmount = Number(plans[planCode].amount);
  const receivedAmount = Number(fields.amount_gross ?? 'NaN');
  if (!Number.isFinite(receivedAmount) || Math.abs(receivedAmount - expectedAmount) > 0.01) {
    return new NextResponse('Amount mismatch', { status: 400 });
  }

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

  if (paymentStatus === 'COMPLETE') {
    await admin.from('revenue_events').upsert({
      source_type: 'payfast_subscription',
      source_id: fields.pf_payment_id || orderId,
      gross_amount: receivedAmount,
      currency: 'ZAR',
      cleared: true,
      cleared_at: new Date().toISOString(),
    }, { onConflict: 'source_type,source_id' });
  }

  return new NextResponse('OK');
}
