import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ entitled: false }, { status: 401 });

  const productionId = new URL(request.url).searchParams.get('productionId');
  if (!productionId) return NextResponse.json({ error: 'Missing production' }, { status: 400 });

  const { data } = await supabase.from('purchases')
    .select('id')
    .eq('user_id', user.id)
    .eq('production_id', productionId)
    .eq('status', 'complete')
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ entitled: Boolean(data) });
}
