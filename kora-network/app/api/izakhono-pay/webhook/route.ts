import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

function signature(raw: string, timestamp: string, secret: string) {
  return createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex');
}

export async function POST(request: Request) {
  const secret = process.env.IZAKHONO_PAY_WEBHOOK_SECRET?.trim();
  if (!secret) return new NextResponse('Not configured', { status: 503 });

  const timestamp = request.headers.get('x-izakhono-timestamp') || '';
  const supplied = request.headers.get('x-izakhono-signature') || '';
  const eventName = request.headers.get('x-izakhono-event') || '';
  const raw = await request.text();
  const unix = Number(timestamp);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isInteger(unix) || Math.abs(now - unix) > 300) return new NextResponse('Stale webhook', { status: 401 });
  if (!supplied || !safeEqual(signature(raw, timestamp, secret), supplied)) return new NextResponse('Invalid signature', { status: 401 });
  if (eventName !== 'payment.paid') return new NextResponse('Ignored', { status: 202 });

  const payload = JSON.parse(raw) as {
    event?: string;
    merchant?: string;
    intent?: {
      id?: string;
      reference?: string;
      amount_minor?: number;
      currency?: string;
      status?: string;
      provider?: string;
      provider_reference?: string | null;
      metadata?: { kind?: string; order_id?: string } & Record<string, unknown>;
    };
  };

  const intent = payload.intent;
  if (payload.event !== 'payment.paid' || payload.merchant !== 'kora' || !intent || intent.status !== 'paid') {
    return new NextResponse('Invalid event', { status: 400 });
  }
  if (intent.currency !== 'ZAR' || intent.provider !== 'payfast') return new NextResponse('Unsupported settlement', { status: 409 });

  const orderId = String(intent.metadata?.order_id || '');
  const kind = String(intent.metadata?.kind || '');
  const amount = Number(intent.amount_minor) / 100;
  const providerPaymentId = String(intent.provider_reference || '');
  if (!orderId || !Number.isFinite(amount) || amount <= 0 || !providerPaymentId) return new NextResponse('Incomplete event', { status: 400 });

  const admin = createAdminClient();

  if (kind === 'purchase') {
    const { data: purchase, error } = await admin.from('purchases')
      .select('id,amount,status')
      .eq('id', orderId)
      .eq('provider', 'payfast')
      .maybeSingle();
    if (error || !purchase) return new NextResponse('Unknown purchase', { status: 404 });
    if (Math.abs(Number(purchase.amount) - amount) > 0.01) return new NextResponse('Amount mismatch', { status: 409 });
    if (purchase.status === 'complete') return new NextResponse('OK');
    const completed = await admin.rpc('complete_payfast_purchase', {
      p_purchase_id: purchase.id,
      p_provider_payment_id: providerPaymentId,
      p_amount: amount,
    });
    if (completed.error) return new NextResponse('Purchase persistence failure', { status: 500 });
    return new NextResponse('OK');
  }

  if (kind === 'ticket') {
    const { data: order, error } = await admin.from('ticket_orders')
      .select('id,total_amount,status')
      .eq('id', orderId)
      .eq('provider', 'payfast')
      .maybeSingle();
    if (error || !order) return new NextResponse('Unknown ticket order', { status: 404 });
    if (Math.abs(Number(order.total_amount) - amount) > 0.01) return new NextResponse('Amount mismatch', { status: 409 });
    if (order.status === 'complete') return new NextResponse('OK');
    const completed = await admin.rpc('complete_payfast_ticket_order', {
      p_order_id: order.id,
      p_provider_payment_id: providerPaymentId,
      p_amount: amount,
    });
    if (completed.error) return new NextResponse('Ticket persistence failure', { status: 500 });
    return new NextResponse('OK');
  }

  return new NextResponse('Unsupported payment kind', { status: 409 });
}
