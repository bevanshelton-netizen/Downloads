import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const body = await request.json().catch(() => null) as { adEventId?: string } | null;
  if (!body?.adEventId) return NextResponse.json({ error: 'Missing adEventId' }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('claim_verified_ad_reward', {
    p_user_id: user.id,
    p_ad_event_id: body.adEventId,
  });

  if (error) {
    const message = error.message || 'Reward not available';
    const status = /already claimed/i.test(message) ? 409 : /verified|funded|campaign/i.test(message) ? 422 : 400;
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ claimId: data, status: 'credited' });
}
