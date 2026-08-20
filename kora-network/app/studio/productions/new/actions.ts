'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

export async function createProduction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const title = String(formData.get('title') ?? '').trim();
  const synopsis = String(formData.get('synopsis') ?? '').trim();
  const genre = String(formData.get('genre') ?? '').trim();
  const primaryLanguage = String(formData.get('primary_language') ?? '').trim();
  const ageRating = String(formData.get('age_rating') ?? 'PG').trim();
  const rightsConfirmed = formData.get('rights_confirmed') === 'on';
  const policyConfirmed = formData.get('policy_confirmed') === 'on';

  if (title.length < 2) redirect('/studio/productions/new?error=Please%20enter%20a%20title');
  if (!rightsConfirmed) redirect('/studio/productions/new?error=You%20must%20confirm%20you%20have%20the%20rights%20to%20publish%20this%20content');
  if (!policyConfirmed) redirect('/studio/productions/new?error=You%20must%20accept%20the%20content%20policy');

  let { data: creator } = await supabase
    .from('creators')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle();

  if (!creator) {
    const creatorName = String(user.user_metadata?.display_name || user.email?.split('@')[0] || 'Creator');
    const result = await supabase
      .from('creators')
      .insert({ owner_id: user.id, name: creatorName })
      .select('id')
      .single();
    if (result.error) redirect(`/studio/productions/new?error=${encodeURIComponent(result.error.message)}`);
    creator = result.data;
  }

  const slug = `${slugify(title) || 'production'}-${randomUUID().slice(0, 8)}`;
  const { error } = await supabase.from('productions').insert({
    creator_id: creator.id,
    title,
    slug,
    synopsis: synopsis || null,
    genre: genre || null,
    primary_language: primaryLanguage || null,
    age_rating: ageRating,
    status: 'draft',
    explicit_sexual_content: false,
  });

  if (error) redirect(`/studio/productions/new?error=${encodeURIComponent(error.message)}`);
  redirect('/studio?created=1');
}
