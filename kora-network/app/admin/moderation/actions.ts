'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function moderator() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (!profile || !['moderator', 'admin'].includes(profile.role)) redirect('/');
  return { supabase, admin: createAdminClient(), user };
}

export async function moderateProduction(formData: FormData) {
  const productionId = String(formData.get('production_id') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  const kidsRequested = formData.get('kids_approved') === 'on';
  if (!productionId || !['approved', 'rejected', 'needs_changes'].includes(decision)) return;

  const { supabase, admin, user } = await moderator();
  const { data: production } = await supabase.from('productions').select('age_rating').eq('id', productionId).maybeSingle();
  const kidsApproved = decision === 'approved' && kidsRequested && ['A','PG'].includes(production?.age_rating ?? '');
  const productionStatus = decision === 'approved' ? 'published' : decision === 'rejected' ? 'rejected' : 'draft';
  const episodeStatus = decision === 'approved' ? 'published' : decision === 'rejected' ? 'rejected' : 'draft';

  const { error } = await admin.from('productions').update({ status: productionStatus, kids_approved: kidsApproved }).eq('id', productionId).eq('status', 'review');
  if (error) redirect(`/admin/moderation?error=${encodeURIComponent(error.message)}`);

  const { error: episodeError } = await admin.from('episodes').update({
    status: episodeStatus,
    published_at: decision === 'approved' ? new Date().toISOString() : null,
  }).eq('production_id', productionId);
  if (episodeError) redirect(`/admin/moderation?error=${encodeURIComponent(episodeError.message)}`);

  const { error: reviewError } = await admin.from('moderation_reviews').insert({
    production_id: productionId,
    reviewer_id: user.id,
    decision,
    reason: reason || (kidsRequested && !kidsApproved ? 'General catalogue decision; Kids approval not applied because Kids requires A or PG.' : null),
  });
  if (reviewError) redirect(`/admin/moderation?error=${encodeURIComponent(reviewError.message)}`);

  revalidatePath('/admin/moderation');
  revalidatePath('/kids');
  revalidatePath('/watch');
}
