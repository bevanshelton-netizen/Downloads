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

export async function reviewCreatorApplication(formData: FormData) {
  await requireStaff();
  const applicationId = String(formData.get('application_id') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const sharePercent = Number(formData.get('share_percent') || 70);
  if (!applicationId || !['accepted','declined','waitlisted','reviewing'].includes(decision)) return;
  if (decision === 'accepted' && (!Number.isFinite(sharePercent) || sharePercent < 0 || sharePercent > 90)) {
    redirect('/admin/creators?error=Creator%20share%20must%20be%20between%200%20and%2090%25');
  }

  const admin = createAdminClient();
  const { data: application, error: applicationError } = await admin
    .from('creator_applications')
    .select('id,user_id,display_name,status')
    .eq('id', applicationId)
    .maybeSingle();
  if (applicationError || !application) redirect('/admin/creators?error=Creator%20application%20not%20found');

  if (decision !== 'accepted') {
    const { error } = await admin.from('creator_applications').update({ status: decision, reviewed_at: new Date().toISOString() }).eq('id', application.id);
    if (error) redirect(`/admin/creators?error=${encodeURIComponent(error.message)}`);
    revalidatePath('/admin/creators');
    return;
  }

  let { data: creator } = await admin.from('creators').select('id').eq('owner_id', application.user_id).maybeSingle();
  if (!creator) {
    const result = await admin.from('creators').insert({ owner_id: application.user_id, name: application.display_name }).select('id').single();
    if (result.error) redirect(`/admin/creators?error=${encodeURIComponent(result.error.message)}`);
    creator = result.data;
  }

  const { data: ownerProfile } = await admin.from('profiles').select('role').eq('id', application.user_id).maybeSingle();
  if (ownerProfile?.role === 'viewer') await admin.from('profiles').update({ role: 'creator' }).eq('id', application.user_id);

  const version = 'founding-2026-v1';
  const { error: dealError } = await admin.from('creator_deals').upsert({
    creator_id: creator.id,
    deal_name: 'KORA Founding Creator Offer',
    version,
    revenue_share_bps: Math.round(sharePercent * 100),
    revenue_basis: 'eligible_net_content_revenue',
    status: 'offered',
    accepted_at: null,
  }, { onConflict: 'creator_id,version' });
  if (dealError) redirect(`/admin/creators?error=${encodeURIComponent(dealError.message)}`);

  const { error: statusError } = await admin.from('creator_applications').update({ status: 'accepted', reviewed_at: new Date().toISOString() }).eq('id', application.id);
  if (statusError) redirect(`/admin/creators?error=${encodeURIComponent(statusError.message)}`);

  revalidatePath('/admin/creators');
  revalidatePath('/studio');
}
