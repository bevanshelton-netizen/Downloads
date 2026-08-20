'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function updatePassword(formData: FormData) {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm_password') ?? '');
  if (password.length < 8) redirect('/reset-password?error=Password%20must%20be%20at%20least%208%20characters');
  if (password !== confirm) redirect('/reset-password?error=Passwords%20do%20not%20match');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=Open%20the%20latest%20password%20recovery%20link%20from%20your%20email');

  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  redirect('/account?password=updated');
}
