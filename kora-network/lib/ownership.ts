import type { SupabaseClient } from '@supabase/supabase-js';

export async function creatorOwnsEpisode(supabase: SupabaseClient, userId: string, episodeId: string) {
  const { data: episode } = await supabase.from('episodes').select('id,production_id').eq('id', episodeId).maybeSingle();
  if (!episode) return false;
  const { data: production } = await supabase.from('productions').select('creator_id').eq('id', episode.production_id).maybeSingle();
  if (!production) return false;
  const { data: creator } = await supabase.from('creators').select('owner_id').eq('id', production.creator_id).maybeSingle();
  return creator?.owner_id === userId;
}
