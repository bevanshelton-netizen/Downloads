'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getPlatformReleaseState } from '@/lib/platform-state';

const creatorTypes = new Set(['filmmaker','producer','writer','actor_creator','comedian','musician','documentarian','studio','other']);

function httpsUrl(value: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function submitCreatorApplication(formData: FormData) {
  const release = await getPlatformReleaseState();
  if (!release.creator_applications_enabled) redirect('/creators/apply?error=Creator%20applications%20are%20not%20open%20yet');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/creators/apply');

  const displayName = String(formData.get('display_name') ?? '').trim();
  const countryCode = String(formData.get('country_code') ?? 'ZA').trim().toUpperCase();
  const creatorType = String(formData.get('creator_type') ?? '').trim();
  const languages = String(formData.get('languages') ?? '').split(',').map(x => x.trim()).filter(Boolean).slice(0, 12);
  const portfolioInput = String(formData.get('portfolio_url') ?? '').trim();
  const portfolioUrl = httpsUrl(portfolioInput);
  const pitch = String(formData.get('pitch') ?? '').trim().slice(0, 3000);

  if (displayName.length < 2 || !/^[A-Z]{2}$/.test(countryCode) || !creatorTypes.has(creatorType)) {
    redirect('/creators/apply?error=Complete%20your%20creator%20name%2C%20country%20and%20creator%20type');
  }
  if (portfolioInput && !portfolioUrl) redirect('/creators/apply?error=Portfolio%20links%20must%20use%20HTTPS');
  if (pitch.length < 40) redirect('/creators/apply?error=Tell%20us%20a%20little%20more%20about%20what%20you%20want%20to%20create');

  const { data: existing } = await supabase.from('creator_applications').select('id,status').eq('user_id', user.id).maybeSingle();
  if (existing?.status === 'accepted') redirect('/studio');
  if (existing && !['submitted'].includes(existing.status)) redirect(`/creators/apply?status=${existing.status}`);

  const payload = {
    user_id: user.id,
    display_name: displayName,
    country_code: countryCode,
    creator_type: creatorType,
    languages,
    portfolio_url: portfolioUrl,
    pitch,
    status: 'submitted',
  };

  const result = existing
    ? await supabase.from('creator_applications').update(payload).eq('id', existing.id)
    : await supabase.from('creator_applications').insert(payload);

  if (result.error) redirect(`/creators/apply?error=${encodeURIComponent(result.error.message)}`);
  revalidatePath('/creators/apply');
  redirect('/creators/apply?submitted=1');
}
