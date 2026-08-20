'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function requireStaff() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (!profile || !['moderator','admin'].includes(profile.role)) redirect('/');
  return { supabase, user };
}

export async function reviewCreative(formData: FormData) {
  const { supabase, user } = await requireStaff();
  const id = String(formData.get('creative_id') ?? '');
  const decision = String(formData.get('decision') ?? '');
  if (!id || !['approved','rejected','archived'].includes(decision)) return;

  const { error } = await supabase.from('campaign_creatives').update({
    status: decision,
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) redirect(`/admin/ads?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/admin/ads');
  revalidatePath('/advertiser/creatives');
}
