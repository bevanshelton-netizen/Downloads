import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildPurchaseCheckout } from '@/lib/payfast';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const productionId = String(body.productionId ?? '');
  if (!productionId) return NextResponse.json({ error: 'productionId is required' }, { status: 400 });

  const admin = createAdminClient();
  const { data: production, error: productionError } = await admin
    .from('productions')
    .select('id,title,status,access_mode,purchase_price')
    .eq('id', productionId)
    .maybeSingle();

  if (productionError || !production || production.status !== 'published' || production.access_mode !== 'pay_per_view') {
    return NextResponse.json({ error: 'This title is not available for purchase.' }, { status: 404 });
  }

  const amount = Number(production.purchase_price);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'This title does not have a valid purchase price.' }, { status: 400 });
  }

  const { data: existing } = await admin
    .from('purchases')
    .select('id')
    .eq('user_id', user.id)
    .eq('production_id', production.id)
    .eq('status', 'complete')
    .limit(1)
    .maybeSingle();
  if (existing) return NextResponse.json({ error: 'You already own this title.' }, { status: 409 });

  const { data: purchase, error } = await admin
    .from('purchases')
    .insert({ user_id: user.id, production_id: production.id, amount, currency: 'ZAR', provider: 'payfast', status: 'pending' })
    .select('id')
    .single();
  if (error || !purchase) return NextResponse.json({ error: error?.message ?? 'Could not create purchase' }, { status: 400 });

  return NextResponse.json(buildPurchaseCheckout({ orderId: purchase.id, email: user.email, title: production.title, amount }));
}
