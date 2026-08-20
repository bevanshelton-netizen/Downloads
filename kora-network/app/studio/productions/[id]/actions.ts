'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function ownedProduction(productionId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: production } = await supabase.from('productions').select('id,creator_id,status').eq('id', productionId).maybeSingle();
  if (!production) throw new Error('Production not found');
  const { data: creator } = await supabase.from('creators').select('owner_id').eq('id', production.creator_id).maybeSingle();
  if (!creator || creator.owner_id !== user.id) throw new Error('Forbidden');
  return { supabase, production };
}

export async function addEpisode(formData: FormData) {
  const productionId = String(formData.get('production_id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const episodeNumber = Number(formData.get('episode_number'));
  if (!productionId || title.length < 1 || !Number.isInteger(episodeNumber) || episodeNumber < 1) return;

  const { supabase } = await ownedProduction(productionId);
  const { error } = await supabase.from('episodes').insert({
    production_id: productionId,
    episode_number: episodeNumber,
    title,
    status: 'draft',
  });
  if (error) redirect(`/studio/productions/${productionId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/studio/productions/${productionId}`);
}

export async function submitForReview(formData: FormData) {
  const productionId = String(formData.get('production_id') ?? '');
  const { supabase, production } = await ownedProduction(productionId);
  if (production.status === 'published') return;

  const { data: episodes } = await supabase.from('episodes').select('id,playback_id').eq('production_id', productionId);
  if (!episodes?.length) redirect(`/studio/productions/${productionId}?error=Add%20at%20least%20one%20episode%20before%20review`);
  if (episodes.some((episode) => !episode.playback_id)) redirect(`/studio/productions/${productionId}?error=Upload%20video%20for%20every%20episode%20before%20review`);

  const { error } = await supabase.from('productions').update({ status: 'review' }).eq('id', productionId);
  if (error) redirect(`/studio/productions/${productionId}?error=${encodeURIComponent(error.message)}`);
  await supabase.from('episodes').update({ status: 'review' }).eq('production_id', productionId);
  revalidatePath(`/studio/productions/${productionId}`);
}
