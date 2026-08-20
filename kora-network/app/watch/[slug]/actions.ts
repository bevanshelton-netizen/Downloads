'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function reportContent(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=Sign%20in%20to%20submit%20a%20content%20report');

  const productionId = String(formData.get('production_id') ?? '');
  const episodeId = String(formData.get('episode_id') ?? '').trim();
  const slug = String(formData.get('slug') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  const details = String(formData.get('details') ?? '').trim();
  if (!productionId || !slug || !reason) redirect(`/watch/${encodeURIComponent(slug)}?report=invalid`);

  const { error } = await supabase.from('content_reports').insert({
    reporter_id: user.id,
    production_id: productionId,
    episode_id: episodeId || null,
    reason: reason.slice(0, 120),
    details: details ? details.slice(0, 2000) : null,
  });
  if (error) redirect(`/watch/${encodeURIComponent(slug)}?report=error`);
  redirect(`/watch/${encodeURIComponent(slug)}?report=submitted`);
}
