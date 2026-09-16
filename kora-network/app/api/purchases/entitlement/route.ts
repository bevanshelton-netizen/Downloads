import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { reconcileIkhokhaPurchase } from '@/lib/ikhokha-purchase';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ entitled: false }, { status: 401 });

  const productionId = new URL(request.url).searchParams.get('productionId');
  if (!productionId) return NextResponse.json({ error: 'Missing production' }, { status: 400 });

  const { data: complete } = await supabase.from('purchases')
    .select('id')
    .eq('user_id', user.id)
    .eq('production_id', productionId)
    .eq('status', 'complete')
    .limit(1)
    .maybeSingle();

  if (complete) return NextResponse.json({ entitled: true });

  const { data: pending } = await supabase.from('purchases')
    .select('id')
    .eq('user_id', user.id)
    .eq('production_id', productionId)
    .eq('provider', 'ikhokha')
    .eq('status', 'pending')
    .not('provider_payment_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pending) {
    try {
      if (await reconcileIkhokhaPurchase(pending.id)) {
        return NextResponse.json({ entitled: true });
      }
    } catch {
      // The secure provider callback or a later poll can retry reconciliation.
    }
  }

  return NextResponse.json({ entitled: false });
}
