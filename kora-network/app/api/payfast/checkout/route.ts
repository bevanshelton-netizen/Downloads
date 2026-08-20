import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildCheckout, plans, type PlanCode } from '@/lib/payfast';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const payload = await request.json().catch(() => ({}));
  const planCode = String(payload.planCode ?? '') as PlanCode;
  if (!(planCode in plans)) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });

  const admin = createAdminClient();
  const { data: subscription, error } = await admin
    .from('subscriptions')
    .insert({ user_id: user.id, plan_code: planCode, provider: 'payfast', status: 'pending' })
    .select('id')
    .single();

  if (error || !subscription) return NextResponse.json({ error: error?.message ?? 'Could not create subscription' }, { status: 400 });

  try {
    return NextResponse.json(buildCheckout({ orderId: subscription.id, email: user.email, planCode }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Checkout unavailable' }, { status: 500 });
  }
}
