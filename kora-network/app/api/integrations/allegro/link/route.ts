import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const ref = String(body.allegro_creator_ref || '').trim().slice(0,200);
  if (ref.length < 8) return NextResponse.json({ error: 'Valid ALLEGRO creator reference required' }, { status: 422 });

  const { data: creator } = await supabase.from('creators').select('id,owner_id').eq('owner_id', user.id).maybeSingle();
  if (!creator) return NextResponse.json({ error: 'Create/approve your KORA creator profile first' }, { status: 409 });

  const admin = createAdminClient();
  const { error } = await admin.from('allegro_creator_links').upsert({
    allegro_creator_ref: ref,
    kora_creator_id: creator.id,
    linked_by: user.id,
    status: 'active',
    updated_at: new Date().toISOString()
  }, { onConflict: 'allegro_creator_ref' });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, allegro_creator_ref: ref, kora_creator_id: creator.id });
}
