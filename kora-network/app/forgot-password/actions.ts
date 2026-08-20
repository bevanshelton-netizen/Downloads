'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function sendPasswordReset(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) redirect('/forgot-password?error=Enter%20your%20email%20address');

  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    ...(appUrl ? { redirectTo: `${appUrl}/auth/callback?next=/reset-password` } : {}),
  });
  if (error) redirect(`/forgot-password?error=${encodeURIComponent(error.message)}`);
  redirect('/forgot-password?message=If%20that%20address%20has%20a%20KORA%20account%2C%20a%20password%20reset%20email%20has%20been%20sent');
}
