import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildTicketCheckout } from '@/lib/payfast';
import { buildIzakhonoPayCheckout, useIzakhonoPay } from '@/lib/izakhono-pay';

export async function POST(request: Request) {
  const mode = process.env.KORA_TICKET_CHECKOUT_MODE || 'off';
  if (!['sandbox_staff', 'live'].includes(mode)) {
    return NextResponse.json({ error: 'KORA ticket checkout is not open yet' }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  if (mode === 'sandbox_staff') {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (!profile || !['moderator', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Ticket checkout is in staff-only testing' }, { status: 403 });
    }
  }

  if (mode === 'live') {
    if (useIzakhonoPay()) {
      if (process.env.KORA_IZAKHONO_PAY_LIVE_APPROVED !== 'true') {
        return NextResponse.json({ error: 'IZAKHONO PAY live ticket payments are not approved' }, { status: 503 });
      }
    } else if (process.env.PAYFAST_SANDBOX !== 'false' || process.env.KORA_TICKET_LIVE_APPROVED !== 'true') {
      return NextResponse.json({ error: 'Live ticket payments are not approved' }, { status: 503 });
    }
  }

  const body = await request.json().catch(() => null) as { tierId?: string; quantity?: number } | null;
  const quantity = Number(body?.quantity || 1);
  if (!body?.tierId || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    return NextResponse.json({ error: 'Invalid ticket selection' }, { status: 400 });
  }

  const reserved = await supabase.rpc('reserve_ticket_order', { p_tier_id: body.tierId, p_quantity: quantity });
  if (reserved.error || !reserved.data) {
    return NextResponse.json({ error: reserved.error?.message || 'Reservation failed' }, { status: 409 });
  }

  const admin = createAdminClient();
  const { data: order } = await admin.from('ticket_orders')
    .select('id,total_amount,event_id,tier_id')
    .eq('id', reserved.data)
    .single();
  if (!order) return NextResponse.json({ error: 'Order unavailable' }, { status: 500 });

  const [{ data: event }, { data: tier }] = await Promise.all([
    admin.from('ticket_events').select('title,slug').eq('id', order.event_id).single(),
    admin.from('ticket_tiers').select('name').eq('id', order.tier_id).single(),
  ]);
  if (!event || !tier) return NextResponse.json({ error: 'Event unavailable' }, { status: 409 });

  try {
    const title = `${event.title} — ${tier.name}`;
    if (useIzakhonoPay()) {
      return NextResponse.json(await buildIzakhonoPayCheckout({
        orderId: order.id,
        email: user.email,
        amount: Number(order.total_amount),
        description: `KORA Ticket: ${title}`,
        kind: 'ticket',
        metadata: { event_slug: event.slug, tier_id: order.tier_id, quantity },
      }));
    }
    return NextResponse.json(buildTicketCheckout({
      orderId: order.id,
      email: user.email,
      eventSlug: event.slug,
      title,
      amount: Number(order.total_amount),
    }));
  } catch (error) {
    await admin.rpc('release_ticket_order', { p_order_id: order.id, p_status: 'cancelled' });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Checkout unavailable' }, { status: 500 });
  }
}
