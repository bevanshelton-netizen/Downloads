'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

function formCredentials(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!email || password.length < 8) throw new Error('Enter a valid email and a password of at least 8 characters.');
  return { email, password };
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const credentials = formCredentials(formData);
  const { error } = await supabase.auth.signInWithPassword(credentials);
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect('/studio');
}

export async function signUp(formData: FormData) {
  const supabase = await createClient();
  const credentials = formCredentials(formData);
  const { error } = await supabase.auth.signUp(credentials);
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect('/studio');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
