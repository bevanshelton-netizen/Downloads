'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { legal } from '@/lib/legal';
import { getPlatformReleaseState } from '@/lib/platform-state';

function formCredentials(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!email || password.length < 8) throw new Error('Enter a valid email and a password of at least 8 characters.');
  return { email, password };
}

function safeNext(value: FormDataEntryValue | null) {
  const next = String(value ?? '').trim();
  return next.startsWith('/') && !next.startsWith('//') ? next : '/studio';
}

function loginError(message: string, next: string) {
  const suffix = next !== '/studio' ? `&next=${encodeURIComponent(next)}` : '';
  return `/login?error=${encodeURIComponent(message)}${suffix}`;
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const credentials = formCredentials(formData);
  const next = safeNext(formData.get('next'));
  const { error } = await supabase.auth.signInWithPassword(credentials);
  if (error) redirect(loginError(error.message, next));
  redirect(next);
}

export async function signUp(formData: FormData) {
  const next = safeNext(formData.get('next'));
  const release = await getPlatformReleaseState();
  const privateSignup = process.env.KORA_PRIVATE_SIGNUP_ENABLED === 'true';
  if (!release.public_signups_enabled && !privateSignup) {
    redirect(loginError('New account creation is not open yet.', next));
  }

  const accepted = formData.get('platform_accepted') === 'on';
  if (!accepted) redirect(loginError('Accept the Terms of Use and Privacy Notice to create an account', next));

  const supabase = await createClient();
  const credentials = formCredentials(formData);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  const { data, error } = await supabase.auth.signUp({
    ...credentials,
    options: {
      emailRedirectTo: appUrl ? `${appUrl}/auth/callback?next=${encodeURIComponent(next)}` : undefined,
      data: {
        platform_terms_version: legal.platformTerms.version,
        privacy_notice_version: legal.privacyNotice.version,
        legal_acceptance_recorded_at: new Date().toISOString(),
      },
    },
  });
  if (error) redirect(loginError(error.message, next));
  if (!data.session) redirect(`/login?message=${encodeURIComponent('Check your email to confirm your KORA account.')}`);
  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
