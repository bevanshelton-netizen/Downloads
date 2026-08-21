'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function requireStaff() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (!profile || !['moderator','admin'].includes(profile.role)) redirect('/');
}

export async function reviewLiveEvent(formData: FormData) {
  await requireStaff();
  const id = String(formData.get('application_id') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const reviewNotes = String(formData.get('review_notes') ?? '').trim().slice(0, 2000) || null;
  if (!id || !['reviewing','rehearsal','waitlisted','approved','declined','cancelled'].includes(decision)) return;

  const admin = createAdminClient();
  const { error } = await admin.from('live_event_applications').update({
    status: decision,
    review_notes: reviewNotes,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) redirect(`/admin/live-events?error=${encodeURIComponent(error.message)}`);

  revalidatePath('/admin/live-events');
  revalidatePath('/perform-live/apply');
}
