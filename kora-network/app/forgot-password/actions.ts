'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) redirect('/forgot-password?error=Enter%20your%20email%20address');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (!appUrl) redirect('/forgot-password?error=Password%20recovery%20is%20not%20configured%20yet');

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent('/reset-password')}`,
  });

  redirect('/forgot-password?message=If%20that%20email%20belongs%20to%20a%20KORA%20account%2C%20a%20reset%20link%20has%20been%20sent.');
}
