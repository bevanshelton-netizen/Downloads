import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyIkhokhaWebhook } from '@/lib/ikhokha';

type IkhokhaWebhook = {
  paylinkID?: string;
  status?: 'SUCCESS' | 'FAILURE' | string;
  externalTransactionID?: string;
  responseCode?: string;
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  const valid = verifyIkhokhaWebhook({
    requestUrl: request.url,
    rawBody,
    appIdHeader: request.headers.get('ik-appid'),
    signatureHeader: request.headers.get('ik-sign'),
  });

  if (!valid) return new NextResponse('Invalid signature', { status: 403 });

  const url = new URL(request.url);
  const kind = url.searchParams.get('kind');
  const orderId = url.searchParams.get('order');
  if (!orderId || !['purchase', 'ticket'].includes(kind || '')) {
    return new NextResponse('Invalid callback target', { status: 400 });
  }

  const payload = JSON.parse(rawBody) as IkhokhaWebhook;
  if (!payload.paylinkID || !payload.status) {
    return new NextResponse('Invalid callback payload', { status: 400 });
  }
  if (payload.externalTransactionID && payload.externalTransactionID !== orderId) {
    return new NextResponse('Transaction mismatch', { status: 400 });
  }

  const admin = createAdminClient();

  if (kind === 'purchase') {
    const { data: purchase, error: lookupError } = await admin
      .from('purchases')
      .select('id,amount,status')
      .eq('id', orderId)
      .eq('provider', 'ikhokha')
      .maybeSingle();

    if (lookupError || !purchase) return new NextResponse('Unknown purchase', { status: 404 });

    if (payload.status === 'SUCCESS') {
      const { error } = await admin.rpc('complete_ikhokha_purchase', {
        p_purchase_id: purchase.id,
        p_provider_payment_id: payload.paylinkID,
        p_amount: Number(purchase.amount),
      });
      if (error) return new NextResponse('Purchase persistence failure', { status: 500 });
    } else if (payload.status === 'FAILURE' && purchase.status === 'pending') {
      const { error } = await admin.from('purchases')
        .update({ status: 'failed' })
        .eq('id', purchase.id)
        .eq('status', 'pending');
      if (error) return new NextResponse('Purchase status failure', { status: 500 });
    }

    return new NextResponse('OK');
  }

  const { data: order, error: orderLookupError } = await admin
    .from('ticket_orders')
    .select('id,total_amount,status')
    .eq('id', orderId)
    .eq('provider', 'ikhokha')
    .maybeSingle();

  if (orderLookupError || !order) return new NextResponse('Unknown ticket order', { status: 404 });

  if (payload.status === 'SUCCESS') {
    const { error } = await admin.rpc('complete_ikhokha_ticket_order', {
      p_order_id: order.id,
      p_provider_payment_id: payload.paylinkID,
      p_amount: Number(order.total_amount),
    });
    if (error) return new NextResponse('Ticket persistence failure', { status: 500 });
  } else if (payload.status === 'FAILURE' && order.status === 'pending') {
    const { error } = await admin.rpc('release_ticket_order', {
      p_order_id: order.id,
      p_status: 'cancelled',
    });
    if (error) return new NextResponse('Ticket release failure', { status: 500 });
  }

  return new NextResponse('OK');
}
