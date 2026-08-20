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

export async function reviewAdCreative(formData: FormData) {
  await requireStaff();
  const creativeId = String(formData.get('creative_id') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  if (!creativeId || !['approved','rejected','paused'].includes(decision)) return;
  if (decision === 'rejected' && reason.length < 3) redirect('/admin/ads?error=Add%20a%20reason%20when%20rejecting%20a%20creative');

  const admin = createAdminClient();
  const { error } = await admin.rpc('review_ad_creative', { p_creative_id: creativeId, p_decision: decision, p_reason: reason || null });
  if (error) redirect(`/admin/ads?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/admin/ads');
  revalidatePath('/advertiser/creatives');
}
