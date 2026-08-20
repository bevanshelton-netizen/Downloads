'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function updatePassword(formData: FormData) {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm_password') ?? '');
  if (password.length < 8) redirect('/reset-password?error=Use%20at%20least%208%20characters');
  if (password !== confirm) redirect('/reset-password?error=Passwords%20do%20not%20match');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/forgot-password?error=Your%20recovery%20link%20has%20expired.%20Request%20a%20new%20one.');

  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  redirect('/account?message=Password%20updated%20successfully.');
}
