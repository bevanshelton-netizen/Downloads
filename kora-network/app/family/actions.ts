'use server';

import { createHash } from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function createFamilyProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const name = String(formData.get('name') ?? '').trim();
  const profileType = String(formData.get('profile_type') ?? 'child');
  const maxAgeRating = String(formData.get('max_age_rating') ?? 'PG');
  if (!name || !['adult','teen','child'].includes(profileType) || !['A','PG','13','16','18'].includes(maxAgeRating)) {
    redirect('/family?error=Check%20profile%20details');
  }

  const childLike = profileType !== 'adult';
  const { error } = await supabase.from('family_profiles').insert({
    owner_id: user.id,
    name,
    profile_type: profileType,
    max_age_rating: maxAgeRating,
    purchases_allowed: childLike ? false : formData.get('purchases_allowed') === 'on',
    rewards_allowed: childLike ? false : formData.get('rewards_allowed') === 'on',
  });
  if (error) redirect(`/family?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/family');
}

export async function setParentalPin(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const pin = String(formData.get('pin') ?? '');
  if (!/^\d{4,8}$/.test(pin)) redirect('/family?error=PIN%20must%20be%204%20to%208%20digits');
  const salt = user.id;
  const pinHash = createHash('sha256').update(`${salt}:${pin}`).digest('hex');
  const { error } = await supabase.from('parental_pins').upsert({ owner_id: user.id, pin_hash: pinHash, updated_at: new Date().toISOString() });
  if (error) redirect(`/family?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/family');
}
