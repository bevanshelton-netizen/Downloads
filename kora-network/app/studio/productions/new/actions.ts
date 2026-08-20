'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { legal } from '@/lib/legal';

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

  const { data: acceptance } = await supabase.from('agreement_acceptances')
    .select('id')
    .eq('user_id', user.id)
    .eq('document_code', legal.creatorAgreement.code)
    .eq('document_version', legal.creatorAgreement.version)
    .maybeSingle();
  if (!acceptance) redirect('/legal/creator-agreement/accept');

  const title = String(formData.get('title') ?? '').trim();
  const synopsis = String(formData.get('synopsis') ?? '').trim();
  const genre = String(formData.get('genre') ?? '').trim();
  const primaryLanguage = String(formData.get('primary_language') ?? '').trim();
  const ageRating = String(formData.get('age_rating') ?? 'PG').trim();
  const rightsConfirmed = formData.get('rights_confirmed') === 'on';
  const contributorsConfirmed = formData.get('contributors_confirmed') === 'on';
  const musicConfirmed = formData.get('music_confirmed') === 'on';
  const likenessConfirmed = formData.get('likeness_confirmed') === 'on';
  const policyConfirmed = formData.get('policy_confirmed') === 'on';

  if (title.length < 2) redirect('/studio/productions/new?error=Please%20enter%20a%20title');
  if (!rightsConfirmed || !contributorsConfirmed || !musicConfirmed || !likenessConfirmed || !policyConfirmed) {
    redirect('/studio/productions/new?error=Complete%20every%20rights%20and%20content%20declaration%20before%20creating%20the%20production');
  }

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
  const productionResult = await supabase.from('productions').insert({
    creator_id: creator.id,
    title,
    slug,
    synopsis: synopsis || null,
    genre: genre || null,
    primary_language: primaryLanguage || null,
    age_rating: ageRating,
    status: 'draft',
    explicit_sexual_content: false,
  }).select('id').single();

  if (productionResult.error || !productionResult.data) {
    redirect(`/studio/productions/new?error=${encodeURIComponent(productionResult.error?.message || 'Could not create production')}`);
  }

  const declaration = await supabase.from('production_rights_declarations').insert({
    production_id: productionResult.data.id,
    declarant_id: user.id,
    creator_terms_version: legal.creatorAgreement.version,
    owns_or_controls_rights: rightsConfirmed,
    contributor_permissions_confirmed: contributorsConfirmed,
    music_permissions_confirmed: musicConfirmed,
    likeness_permissions_confirmed: likenessConfirmed,
    content_policy_confirmed: policyConfirmed,
  });

  if (declaration.error) {
    const admin = createAdminClient();
    await admin.from('productions').delete().eq('id', productionResult.data.id);
    redirect(`/studio/productions/new?error=${encodeURIComponent(`Rights record failed: ${declaration.error.message}`)}`);
  }

  redirect('/studio?created=1');
}
