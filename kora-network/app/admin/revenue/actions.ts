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
  if (profile?.role !== 'admin') redirect('/');
}

export async function allocateCreatorRevenue(formData: FormData) {
  await requireAdmin();
  const revenueEventId = String(formData.get('revenue_event_id') ?? '');
  const productionId = String(formData.get('production_id') ?? '');
  const eligibleAmount = Number(formData.get('eligible_amount'));
  if (!revenueEventId || !productionId || !Number.isFinite(eligibleAmount) || eligibleAmount <= 0) {
    redirect('/admin/revenue?error=Select%20a%20cleared%20revenue%20event%2C%20production%20and%20eligible%20amount');
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc('allocate_creator_revenue', {
    p_revenue_event_id: revenueEventId,
    p_production_id: productionId,
    p_eligible_amount: eligibleAmount,
  });
  if (error) redirect(`/admin/revenue?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/admin/revenue');
  revalidatePath('/studio/earnings');
}
