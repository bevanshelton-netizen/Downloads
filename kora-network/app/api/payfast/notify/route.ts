import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { plans, type PlanCode, validateItn } from '@/lib/payfast';

function addOneMonth(value?: string | null) {
  const base = value && new Date(value) > new Date() ? new Date(value) : new Date();
  const day = base.getUTCDate();
  base.setUTCDate(1);
  base.setUTCMonth(base.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  base.setUTCDate(Math.min(day, lastDay));
  return base.toISOString();
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
  const receivedAmount = Number(fields.amount_gross ?? 'NaN');
  if (!orderId) return new NextResponse('Missing order', { status: 400 });
  if (!Number.isFinite(receivedAmount) || receivedAmount < 0) return new NextResponse('Invalid amount', { status: 400 });

  const admin = createAdminClient();

  if (orderType === 'purchase') {
    const { data: purchase, error: purchaseLookupError } = await admin
      .from('purchases')
      .select('id,amount,status,provider_payment_id')
      .eq('id', orderId)
      .eq('provider', 'payfast')
      .maybeSingle();
    if (purchaseLookupError || !purchase) return new NextResponse('Unknown purchase', { status: 404 });

    const expectedAmount = Number(purchase.amount);
    if (Math.abs(receivedAmount - expectedAmount) > 0.01) return new NextResponse('Amount mismatch', { status: 400 });

    if (paymentStatus === 'COMPLETE') {
      const providerPaymentId = fields.pf_payment_id;
      if (!providerPaymentId) return new NextResponse('Missing provider payment', { status: 400 });
      const { error } = await admin.rpc('complete_payfast_purchase', {
        p_purchase_id: purchase.id,
        p_provider_payment_id: providerPaymentId,
        p_amount: receivedAmount,
      });
      if (error) return new NextResponse('Purchase persistence failure', { status: 500 });
    } else if (purchase.status !== 'complete') {
      const { error } = await admin.from('purchases')
        .update({ status: paymentStatus?.toLowerCase() || 'pending' })
        .eq('id', purchase.id);
      if (error) return new NextResponse('Purchase status failure', { status: 500 });
    }
    return new NextResponse('OK');
  }

  const { data: subscription, error: lookupError } = await admin
    .from('subscriptions')
    .select('id,plan_code,status,provider_subscription_id,current_period_end,cancelled_at')
    .eq('id', orderId)
    .maybeSingle();
  if (lookupError || !subscription) return new NextResponse('Unknown order', { status: 404 });

  const planCode = subscription.plan_code as PlanCode;
  if (!(planCode in plans)) return new NextResponse('Unknown plan', { status: 400 });
  const expectedAmount = Number(plans[planCode].amount);
  if (Math.abs(receivedAmount - expectedAmount) > 0.01) return new NextResponse('Amount mismatch', { status: 400 });

  if (paymentStatus === 'COMPLETE') {
    const providerPaymentId = fields.pf_payment_id;
    const subscriptionToken = fields.token || subscription.provider_subscription_id;
    if (!providerPaymentId) return new NextResponse('Missing provider payment', { status: 400 });
    if (!subscriptionToken) return new NextResponse('Missing subscription token', { status: 400 });

    const { data: existingRevenue, error: existingRevenueError } = await admin.from('revenue_events')
      .select('id')
      .eq('source_type', 'payfast_subscription')
      .eq('source_id', providerPaymentId)
      .maybeSingle();
    if (existingRevenueError) return new NextResponse('Revenue lookup failure', { status: 500 });

    if (!existingRevenue) {
      const { error: revenueError } = await admin.from('revenue_events').insert({
        source_type: 'payfast_subscription',
        source_id: providerPaymentId,
        gross_amount: receivedAmount,
        currency: 'ZAR',
        cleared: true,
        cleared_at: new Date().toISOString(),
      });
      if (revenueError) return new NextResponse('Revenue persistence failure', { status: 500 });

      const { error } = await admin.from('subscriptions').update({
        status: 'active',
        provider_subscription_id: subscriptionToken,
        current_period_end: addOneMonth(subscription.current_period_end),
      }).eq('id', orderId);
      if (error) return new NextResponse('Persistence failure', { status: 500 });
    } else if (subscription.provider_subscription_id !== subscriptionToken) {
      const { error } = await admin.from('subscriptions')
        .update({ provider_subscription_id: subscriptionToken })
        .eq('id', orderId);
      if (error) return new NextResponse('Token persistence failure', { status: 500 });
    }
  } else if (subscription.status !== 'active') {
    const { error } = await admin.from('subscriptions').update({
      status: paymentStatus?.toLowerCase() || 'pending',
    }).eq('id', orderId);
    if (error) return new NextResponse('Status persistence failure', { status: 500 });
  }

  return new NextResponse('OK');
}
