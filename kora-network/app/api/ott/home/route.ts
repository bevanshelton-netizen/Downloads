import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();

  const [{ data: productions, error: productionsError }, { data: liveChannels, error: channelsError }] = await Promise.all([
    admin.from('productions').select('id,title,slug,synopsis,genre,primary_language,age_rating,status,created_at').eq('status', 'published').order('created_at', { ascending: false }).limit(24),
    admin.from('live_channels').select('id,name,slug,description,is_active').eq('is_active', true).order('name'),
  ]);

  if (productionsError || channelsError) {
    return NextResponse.json({ error: productionsError?.message ?? channelsError?.message ?? 'Catalog unavailable' }, { status: 500 });
  }

  const productionIds = (productions ?? []).map((production) => production.id);
  const { data: episodes, error: episodesError } = productionIds.length
    ? await admin.from('episodes').select('id,production_id,episode_number,title,duration_seconds,playback_id,published_at,status').in('production_id', productionIds).eq('status', 'published').order('episode_number', { ascending: true })
    : { data: [], error: null };

  if (episodesError) return NextResponse.json({ error: episodesError.message }, { status: 500 });

  let continueWatching: Array<{ episodeId: string; productionId: string; secondsWatched: number; durationSeconds: number }> = [];
  if (user && episodes?.length) {
    const episodeIds = episodes.map((episode) => episode.id);
    const { data: events } = await admin.from('watch_events').select('episode_id,seconds_watched,created_at').eq('user_id', user.id).in('episode_id', episodeIds).order('created_at', { ascending: false }).limit(100);
    const seen = new Set<string>();
    continueWatching = (events ?? []).flatMap((event) => {
      if (!event.episode_id || seen.has(event.episode_id)) return [];
      seen.add(event.episode_id);
      const episode = episodes.find((item) => item.id === event.episode_id);
      if (!episode || !event.seconds_watched || event.seconds_watched <= 0 || event.seconds_watched >= episode.duration_seconds) return [];
      return [{ episodeId: episode.id, productionId: episode.production_id, secondsWatched: event.seconds_watched, durationSeconds: episode.duration_seconds }];
    }).slice(0, 12);
  }

  return NextResponse.json({
    authenticated: Boolean(user),
    productions: productions ?? [],
    episodes: episodes ?? [],
    liveChannels: liveChannels ?? [],
    continueWatching,
    generatedAt: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
