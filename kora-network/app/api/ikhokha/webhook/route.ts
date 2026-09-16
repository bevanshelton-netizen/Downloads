import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyIkhokhaWebhook } from '@/lib/ikhokha';
import { reconcileIkhokhaPurchase } from '@/lib/ikhokha-purchase';

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

  const orderId = new URL(request.url).searchParams.get('order');
  if (!orderId) return new NextResponse('Invalid callback target', { status: 400 });

  let payload: IkhokhaWebhook;
  try {
    payload = JSON.parse(rawBody) as IkhokhaWebhook;
  } catch {
    return new NextResponse('Invalid callback payload', { status: 400 });
  }

  if (
    payload.responseCode !== '00' ||
    !payload.paylinkID ||
    !payload.status ||
    payload.externalTransactionID !== orderId
  ) {
    return new NextResponse('Invalid callback payload', { status: 400 });
  }

  const admin = createAdminClient();
  const { data: purchase, error: lookupError } = await admin
    .from('purchases')
    .select('id,status,provider_payment_id')
    .eq('id', orderId)
    .eq('provider', 'ikhokha')
    .maybeSingle();

  if (lookupError || !purchase) return new NextResponse('Unknown purchase', { status: 404 });
  if (purchase.provider_payment_id !== payload.paylinkID) {
    return new NextResponse('Payment-link mismatch', { status: 400 });
  }

  if (payload.status === 'SUCCESS') {
    try {
      const complete = await reconcileIkhokhaPurchase(purchase.id);
      return new NextResponse(complete ? 'OK' : 'Payment not confirmed', { status: complete ? 200 : 409 });
    } catch {
      return new NextResponse('Purchase reconciliation failure', { status: 500 });
    }
  }

  if (payload.status === 'FAILURE' && purchase.status === 'pending') {
    const { error } = await admin.from('purchases')
      .update({ status: 'failed' })
      .eq('id', purchase.id)
      .eq('provider', 'ikhokha')
      .eq('provider_payment_id', payload.paylinkID)
      .eq('status', 'pending');

    if (error) return new NextResponse('Purchase status failure', { status: 500 });
    return new NextResponse('OK');
  }

  return new NextResponse('Unsupported payment status', { status: 400 });
}
