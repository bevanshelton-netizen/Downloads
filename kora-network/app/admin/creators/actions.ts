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

export async function reviewCreatorApplication(formData: FormData) {
  const { supabase } = await requireStaff();
  const id = String(formData.get('application_id') ?? '');
  const status = String(formData.get('status') ?? 'review');
  if (!id || !['review','accepted','declined','waitlist'].includes(status)) return;
  const { error } = await supabase.from('creator_applications').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) redirect(`/admin/creators?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/admin/creators');
}

export async function reviewCreatorKyc(formData: FormData) {
  const { supabase, user } = await requireStaff();
  const creatorId = String(formData.get('creator_id') ?? '');
  const status = String(formData.get('status') ?? 'needs_changes');
  if (!creatorId || !['needs_changes','verified','rejected'].includes(status)) return;
  const { error } = await supabase.from('creator_kyc').update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('creator_id', creatorId);
  if (error) redirect(`/admin/creators?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/admin/creators');
  revalidatePath('/studio/payouts');
}
