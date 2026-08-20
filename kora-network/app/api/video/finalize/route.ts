import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { creatorOwnsEpisode } from '@/lib/ownership';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const episodeId = String(body.episodeId ?? '');
  const assetId = String(body.assetId ?? '');
  if (!episodeId || !assetId) return NextResponse.json({ error: 'episodeId and assetId are required' }, { status: 400 });
  if (!(await creatorOwnsEpisode(supabase, user.id, episodeId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const admin = createAdminClient();
  const { error: assetError } = await admin
    .from('upload_assets')
    .update({ upload_status: 'uploaded', moderation_status: 'pending' })
    .eq('episode_id', episodeId)
    .eq('provider_asset_id', assetId);
  if (assetError) return NextResponse.json({ error: assetError.message }, { status: 400 });

  const { error: episodeError } = await admin
    .from('episodes')
    .update({ playback_id: assetId, status: 'draft' })
    .eq('id', episodeId);
  if (episodeError) return NextResponse.json({ error: episodeError.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
