'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { legal } from '@/lib/legal';

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
  const accepted = formData.get('platform_accepted') === 'on';
  if (!accepted) redirect('/login?error=Accept%20the%20Terms%20of%20Use%20and%20Privacy%20Notice%20to%20create%20an%20account');

  const supabase = await createClient();
  const credentials = formCredentials(formData);
  const { error } = await supabase.auth.signUp({
    ...credentials,
    options: {
      data: {
        platform_terms_version: legal.platformTerms.version,
        privacy_notice_version: legal.privacyNotice.version,
        legal_acceptance_recorded_at: new Date().toISOString(),
      },
    },
  });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect('/studio');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
