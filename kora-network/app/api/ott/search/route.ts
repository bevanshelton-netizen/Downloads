import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (query.length < 2) return NextResponse.json({ query, productions: [], episodes: [], channels: [] });

  const admin = createAdminClient();
  const pattern = `%${query.replace(/[%_]/g, '')}%`;
  const [{ data: productions, error: productionError }, { data: episodes, error: episodeError }, { data: channels, error: channelError }] = await Promise.all([
    admin.from('productions').select('id,title,slug,synopsis,genre,primary_language,age_rating').eq('status', 'published').or(`title.ilike.${pattern},synopsis.ilike.${pattern},genre.ilike.${pattern},primary_language.ilike.${pattern}`).limit(20),
    admin.from('episodes').select('id,production_id,episode_number,title,duration_seconds').eq('status', 'published').ilike('title', pattern).limit(20),
    admin.from('live_channels').select('id,name,slug,description').eq('is_active', true).or(`name.ilike.${pattern},description.ilike.${pattern}`).limit(20),
  ]);

  const error = productionError ?? episodeError ?? channelError;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ query, productions: productions ?? [], episodes: episodes ?? [], channels: channels ?? [] }, { headers: { 'Cache-Control': 'private, max-age=30' } });
}
