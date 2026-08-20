import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createDirectVideoUpload } from '@/lib/video';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const episodeId = String(body.episodeId ?? '');
  if (!episodeId) return NextResponse.json({ error: 'episodeId is required' }, { status: 400 });

  const { data: episode } = await supabase.from('episodes').select('id,production_id').eq('id', episodeId).maybeSingle();
  if (!episode) return NextResponse.json({ error: 'Episode not found' }, { status: 404 });

  const { data: production } = await supabase.from('productions').select('creator_id').eq('id', episode.production_id).maybeSingle();
  if (!production) return NextResponse.json({ error: 'Production not found' }, { status: 404 });

  const { data: creator } = await supabase.from('creators').select('owner_id').eq('id', production.creator_id).maybeSingle();
  if (!creator || creator.owner_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const upload = await createDirectVideoUpload();
  const admin = createAdminClient();
  const { error } = await admin.from('upload_assets').insert({
    episode_id: episodeId,
    provider: upload.provider,
    provider_asset_id: upload.assetId,
    upload_status: 'created',
    moderation_status: 'pending',
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json(upload);
}
