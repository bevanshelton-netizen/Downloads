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

export async function allocateCreatorEarning(formData: FormData) {
  const creatorId = String(formData.get('creator_id') ?? '');
  const revenueEventId = String(formData.get('revenue_event_id') ?? '');
  const amount = Number(formData.get('amount'));
  const productionId = String(formData.get('production_id') ?? '').trim();

  if (!creatorId || !revenueEventId || !Number.isFinite(amount) || amount <= 0) {
    redirect('/admin/earnings?error=Check%20creator%2C%20revenue%20event%20and%20amount');
  }

  const admin = await requireAdmin();
  const { error } = await admin.rpc('allocate_creator_earning', {
    p_creator_id: creatorId,
    p_revenue_event_id: revenueEventId,
    p_amount: amount,
    p_production_id: productionId || null,
  });

  if (error) redirect(`/admin/earnings?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/admin/earnings');
  revalidatePath('/studio');
}
