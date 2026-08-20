'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (!profile || profile.role !== 'admin') redirect('/');
  return createAdminClient();
}

export async function recordRightsDispute(formData: FormData) {
  const productionId = String(formData.get('production_id') ?? '').trim();
  const episodeId = String(formData.get('episode_id') ?? '').trim();
  const claimantName = String(formData.get('claimant_name') ?? '').trim();
  const claimantEmail = String(formData.get('claimant_email') ?? '').trim();
  const rightsBasis = String(formData.get('rights_basis') ?? '').trim();
  const evidenceReference = String(formData.get('evidence_reference') ?? '').trim();
  const goodFaith = formData.get('good_faith_statement') === 'on';

  if ((!productionId && !episodeId) || !claimantName || !claimantEmail || !rightsBasis || !goodFaith) {
    redirect('/admin/rights?error=Complete%20the%20claimant%2C%20content%2C%20rights%20basis%20and%20good-faith%20fields');
  }

  const admin = await requireAdmin();
  const { error } = await admin.from('rights_disputes').insert({
    production_id: productionId || null,
    episode_id: episodeId || null,
    claimant_name: claimantName.slice(0, 200),
    claimant_email: claimantEmail.slice(0, 320),
    rights_basis: rightsBasis.slice(0, 4000),
    evidence_reference: evidenceReference ? evidenceReference.slice(0, 2000) : null,
    good_faith_statement: true,
  });
  if (error) redirect(`/admin/rights?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/admin/rights');
}

export async function resolveRightsDispute(formData: FormData) {
  const disputeId = String(formData.get('dispute_id') ?? '');
  const resolution = String(formData.get('resolution') ?? '');
  if (!disputeId || !['resolved', 'dismissed'].includes(resolution)) return;

  const admin = await requireAdmin();
  const { error } = await admin.from('rights_disputes').update({ status: resolution, resolved_at: new Date().toISOString() }).eq('id', disputeId).eq('status', 'open');
  if (error) redirect(`/admin/rights?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/admin/rights');
}
