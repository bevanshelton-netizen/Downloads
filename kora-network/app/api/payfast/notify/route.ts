import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { plans, type PlanCode, validateItn } from '@/lib/payfast';

function monthlyPeriodEnd() {
  const value = new Date();
  value.setUTCMonth(value.getUTCMonth() + 1);
  return value.toISOString();
}

function amountMatches(received: string | undefined, expected: number) {
  const amount = Number(received ?? 'NaN');
  return Number.isFinite(amount) && Math.abs(amount - expected) <= 0.01 ? amount : null;
}

export async function POST(request: Request) {
  const raw = await request.text();
  const params = new URLSearchParams(raw);
  const fields = Object.fromEntries(params.entries());

  const valid = await validateItn(fields).catch(() => false);
  if (!valid) return new NextResponse('Invalid', { status: 400 });

  const orderId = fields.m_payment_id;
  const paymentStatus = fields.payment_status;
  const orderType = fields.custom_str2 || 'subscription';
  if (!orderId) return new NextResponse('Missing order', { status: 400 });

  const admin = createAdminClient();

  if (orderType === 'purchase') {
    const { data: purchase, error: lookupError } = await admin
      .from('purchases')
      .select('id,amount,status')
      .eq('id', orderId)
      .maybeSingle();
    if (lookupError || !purchase) return new NextResponse('Unknown purchase', { status: 404 });

    const receivedAmount = amountMatches(fields.amount_gross, Number(purchase.amount));
    if (receivedAmount === null) return new NextResponse('Amount mismatch', { status: 400 });

    const status = paymentStatus === 'COMPLETE' ? 'complete' : paymentStatus?.toLowerCase() || 'pending';
    const { error } = await admin
      .from('purchases')
      .update({ status, provider_payment_id: fields.pf_payment_id || null })
      .eq('id', orderId);
    if (error) return new NextResponse('Persistence failure', { status: 500 });

    if (paymentStatus === 'COMPLETE') {
      const { error: revenueError } = await admin.from('revenue_events').upsert({
        source_type: 'payfast_purchase',
        source_id: fields.pf_payment_id || orderId,
        gross_amount: receivedAmount,
        currency: 'ZAR',
        cleared: true,
        cleared_at: new Date().toISOString(),
      }, { onConflict: 'source_type,source_id' });
      if (revenueError) return new NextResponse('Revenue persistence failure', { status: 500 });
    }

    return new NextResponse('OK');
  }

  if (orderType !== 'subscription') return new NextResponse('Unknown order type', { status: 400 });

  const { data: subscription, error: lookupError } = await admin
    .from('subscriptions')
    .select('id,plan_code,status,provider_subscription_id')
    .eq('id', orderId)
    .maybeSingle();
  if (lookupError || !subscription) return new NextResponse('Unknown subscription', { status: 404 });

  const planCode = subscription.plan_code as PlanCode;
  if (!(planCode in plans)) return new NextResponse('Unknown plan', { status: 400 });
  if (fields.custom_str1 && fields.custom_str1 !== planCode) return new NextResponse('Plan mismatch', { status: 400 });

  const receivedAmount = amountMatches(fields.amount_gross, Number(plans[planCode].amount));
  if (receivedAmount === null) return new NextResponse('Amount mismatch', { status: 400 });

  const status = paymentStatus === 'COMPLETE'
    ? 'active'
    : paymentStatus === 'FAILED'
      ? 'past_due'
      : paymentStatus?.toLowerCase() || subscription.status || 'pending';

  const subscriptionUpdate: Record<string, string | null> = {
    status,
    provider_subscription_id: fields.token || subscription.provider_subscription_id || null,
  };
  if (paymentStatus === 'COMPLETE') subscriptionUpdate.current_period_end = monthlyPeriodEnd();

  const { error } = await admin.from('subscriptions').update(subscriptionUpdate).eq('id', orderId);
  if (error) return new NextResponse('Persistence failure', { status: 500 });

  if (paymentStatus === 'COMPLETE') {
    const { error: revenueError } = await admin.from('revenue_events').upsert({
      source_type: 'payfast_subscription',
      source_id: fields.pf_payment_id || orderId,
      gross_amount: receivedAmount,
      currency: 'ZAR',
      cleared: true,
      cleared_at: new Date().toISOString(),
    }, { onConflict: 'source_type,source_id' });
    if (revenueError) return new NextResponse('Revenue persistence failure', { status: 500 });
  }

  return new NextResponse('OK');
}
