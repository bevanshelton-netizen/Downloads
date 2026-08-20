'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getLaunchReadiness } from '@/lib/launch-readiness';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/admin/launch');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') redirect('/');
  return user;
}

export async function updateReleaseState(formData: FormData) {
  const user = await requireAdmin();
  const releaseName = String(formData.get('release_name') ?? 'private_beta');
  if (!['private_beta','public_beta','general_availability'].includes(releaseName)) {
    redirect('/admin/launch?error=Invalid%20release%20stage');
  }

  const publicLaunch = formData.get('public_launch_enabled') === 'on';
  const publicSignups = formData.get('public_signups_enabled') === 'on';
  const creatorApplications = formData.get('creator_applications_enabled') === 'on';
  const advertiserCampaigns = formData.get('advertiser_campaigns_enabled') === 'on';
  const maintenanceMode = formData.get('maintenance_mode') === 'on';
  const maintenanceMessage = String(formData.get('maintenance_message') ?? '').trim().slice(0, 500);
  const note = String(formData.get('note') ?? '').trim().slice(0, 500);

  if (publicLaunch) {
    if (releaseName === 'private_beta') redirect('/admin/launch?error=Public%20launch%20requires%20Public%20Beta%20or%20General%20Availability');
    if (maintenanceMode) redirect('/admin/launch?error=Disable%20maintenance%20mode%20before%20public%20launch');
    const readiness = await getLaunchReadiness();
    const blocking = Object.entries(readiness.checks)
      .filter(([name, ok]) => name !== 'publicLaunchEnabled' && !ok)
      .map(([name]) => name);
    if (blocking.length) {
      redirect(`/admin/launch?error=${encodeURIComponent(`Launch blocked: ${blocking.join(', ')}`)}`);
    }
  }

  const admin = createAdminClient();
  const payload = {
    schema_version: 13,
    release_name: releaseName,
    public_launch_enabled: publicLaunch,
    public_signups_enabled: publicSignups,
    creator_applications_enabled: creatorApplications,
    advertiser_campaigns_enabled: advertiserCampaigns,
    maintenance_mode: maintenanceMode,
    maintenance_message: maintenanceMessage || null,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  };
  const { error } = await admin.from('platform_release_state').update(payload).eq('singleton', true);
  if (error) redirect(`/admin/launch?error=${encodeURIComponent(error.message)}`);

  await admin.from('platform_release_events').insert({
    actor_id: user.id,
    event_type: publicLaunch ? 'launch_state_updated' : maintenanceMode ? 'maintenance_state_updated' : 'release_state_updated',
    release_name: releaseName,
    public_launch_enabled: publicLaunch,
    public_signups_enabled: publicSignups,
    creator_applications_enabled: creatorApplications,
    advertiser_campaigns_enabled: advertiserCampaigns,
    maintenance_mode: maintenanceMode,
    note: note || null,
  });

  revalidatePath('/admin/launch');
  redirect('/admin/launch?saved=1');
}
