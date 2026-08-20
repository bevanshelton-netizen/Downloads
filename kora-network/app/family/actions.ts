'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function authenticatedClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/family');
  return { supabase, user };
}

async function hasFamilyPin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from('family_pins').select('owner_id').eq('owner_id', userId).maybeSingle();
  return Boolean(data);
}

async function verifyPin(supabase: Awaited<ReturnType<typeof createClient>>, pin: string) {
  const { data, error } = await supabase.rpc('verify_family_pin', { p_pin: pin });
  return !error && data === true;
}

export async function setFamilyPin(formData: FormData) {
  const { supabase, user } = await authenticatedClient();
  const currentPin = String(formData.get('current_pin') ?? '');
  const newPin = String(formData.get('new_pin') ?? '');
  const confirmPin = String(formData.get('confirm_pin') ?? '');
  if (newPin !== confirmPin) redirect('/family?error=New%20PINs%20do%20not%20match');

  if (await hasFamilyPin(supabase, user.id)) {
    if (!(await verifyPin(supabase, currentPin))) redirect('/family?error=Current%20family%20PIN%20is%20incorrect');
  }

  const { error } = await supabase.rpc('set_family_pin', { p_pin: newPin });
  if (error) redirect(`/family?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/family');
  redirect('/family?pin=saved');
}

export async function createChildProfile(formData: FormData) {
  const { supabase, user } = await authenticatedClient();
  const pin = String(formData.get('family_pin') ?? '');
  if (!(await hasFamilyPin(supabase, user.id))) redirect('/family?error=Set%20a%20family%20PIN%20before%20creating%20Kids%20profiles');
  if (!(await verifyPin(supabase, pin))) redirect('/family?error=Family%20PIN%20is%20incorrect');

  const nickname = String(formData.get('nickname') ?? '').trim();
  const ageBand = String(formData.get('age_band') ?? '');
  const { error } = await supabase.rpc('create_viewer_profile', {
    p_nickname: nickname,
    p_profile_kind: 'child',
    p_age_band: ageBand,
  });
  if (error) redirect(`/family?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/family');
}

export async function deleteChildProfile(formData: FormData) {
  const { supabase, user } = await authenticatedClient();
  const profileId = String(formData.get('profile_id') ?? '');
  const pin = String(formData.get('family_pin') ?? '');
  if (!(await verifyPin(supabase, pin))) redirect('/family?error=Family%20PIN%20is%20incorrect');
  const { error } = await supabase.from('viewer_profiles').delete().eq('id', profileId).eq('owner_id', user.id).eq('profile_kind', 'child');
  if (error) redirect(`/family?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/family');
}

export async function enterChildMode(formData: FormData) {
  const { supabase, user } = await authenticatedClient();
  const profileId = String(formData.get('profile_id') ?? '');
  if (!(await hasFamilyPin(supabase, user.id))) redirect('/family?error=Set%20a%20family%20PIN%20before%20launching%20Kids%20Mode');

  const { data: profile } = await supabase.from('viewer_profiles').select('id').eq('id', profileId).eq('owner_id', user.id).eq('profile_kind', 'child').maybeSingle();
  if (!profile) redirect('/family?error=Kids%20profile%20not%20found');

  const jar = await cookies();
  jar.set('kora_child_profile', profile.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 8 * 60 * 60,
  });
  redirect('/kids');
}

export async function exitChildMode(formData: FormData) {
  const { supabase } = await authenticatedClient();
  const pin = String(formData.get('family_pin') ?? '');
  if (!(await verifyPin(supabase, pin))) redirect('/kids?exit_error=Family%20PIN%20is%20incorrect');
  const jar = await cookies();
  jar.delete('kora_child_profile');
  redirect('/family');
}
