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

export async function confirmCampaignFunding(formData: FormData) {
  await requireStaff();
  const campaignId = String(formData.get('campaign_id') ?? '');
  const grossAmount = Number(formData.get('gross_amount'));
  const rewardAmount = Number(formData.get('reward_amount') || 0);
  if (!campaignId || !Number.isFinite(grossAmount) || grossAmount <= 0 || !Number.isFinite(rewardAmount) || rewardAmount < 0 || rewardAmount > grossAmount) {
    redirect('/admin/campaigns?error=Check%20cleared%20and%20reward%20amounts');
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc('fund_campaign_from_cleared_revenue', {
    p_campaign_id: campaignId,
    p_gross_amount: grossAmount,
    p_reward_amount: rewardAmount,
  });
  if (error) redirect(`/admin/campaigns?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/admin/campaigns');
  revalidatePath('/advertiser');
}
