import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildPurchaseCheckout } from '@/lib/payfast';
import { buildIzakhonoPayCheckout, useIzakhonoPay } from '@/lib/izakhono-pay';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const body = await request.json().catch(() => null) as { productionId?: string } | null;
  if (!body?.productionId) return NextResponse.json({ error: 'Missing production' }, { status: 400 });

  const { data: production } = await supabase
    .from('productions')
    .select('id,title,slug,access_mode,purchase_price,status')
    .eq('id', body.productionId)
    .eq('status', 'published')
    .maybeSingle();

  if (!production || production.access_mode !== 'pay_per_view') {
    return NextResponse.json({ error: 'Title is not available for pay-per-view' }, { status: 409 });
  }
  const amount = Number(production.purchase_price);
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Purchase price is not configured' }, { status: 409 });

  const admin = createAdminClient();
  const { data: complete } = await admin.from('purchases')
    .select('id')
    .eq('user_id', user.id)
    .eq('production_id', production.id)
    .eq('status', 'complete')
    .limit(1)
    .maybeSingle();
  if (complete) return NextResponse.json({ alreadyOwned: true, redirect: `/watch/${production.slug}` });

  const { data: existingPending } = await admin.from('purchases')
    .select('id,amount')
    .eq('user_id', user.id)
    .eq('production_id', production.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let purchase = existingPending;
  if (!purchase || Math.abs(Number(purchase.amount) - amount) > 0.01) {
    const created = await admin.from('purchases').insert({
      user_id: user.id,
      production_id: production.id,
      amount,
      currency: 'ZAR',
      // Keep the proven local settlement RPC contract while IZAKHONO PAY
      // becomes the checkout/orchestration owner.
      provider: 'payfast',
      status: 'pending',
    }).select('id,amount').single();
    if (created.error || !created.data) return NextResponse.json({ error: created.error?.message || 'Could not create purchase' }, { status: 500 });
    purchase = created.data;
  }

  try {
    if (useIzakhonoPay()) {
      const safeSlug = encodeURIComponent(production.slug);
      return NextResponse.json(await buildIzakhonoPayCheckout({
        orderId: purchase.id,
        email: user.email,
        amount,
        description: `KORA: ${production.title}`,
        kind: 'purchase',
        returnPath: `/watch/${safeSlug}?payment=success`,
        cancelPath: `/watch/${safeSlug}?payment=cancelled`,
        metadata: { production_id: production.id, slug: production.slug },
      }));
    }
    return NextResponse.json(buildPurchaseCheckout({
      orderId: purchase.id,
      email: user.email,
      productionId: production.id,
      slug: production.slug,
      title: production.title,
      amount,
    }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Checkout unavailable' }, { status: 500 });
  }
}
