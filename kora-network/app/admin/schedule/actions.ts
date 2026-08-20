'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function staffClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (!profile || !['moderator', 'admin'].includes(profile.role)) redirect('/');
  return supabase;
}

function catLocalToIso(value: string) {
  const withSeconds = value.length === 16 ? `${value}:00` : value;
  const parsed = new Date(`${withSeconds}+02:00`);
  if (Number.isNaN(parsed.getTime())) throw new Error('Invalid CAT date/time');
  return parsed.toISOString();
}

export async function createScheduleItem(formData: FormData) {
  const channelId = String(formData.get('channel_id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const startsAt = String(formData.get('starts_at') ?? '');
  const endsAt = String(formData.get('ends_at') ?? '');
  const sponsorName = String(formData.get('sponsor_name') ?? '').trim();
  const isPremiere = formData.get('is_premiere') === 'on';

  if (!channelId || !title || !startsAt || !endsAt) {
    redirect('/admin/schedule?error=Check%20channel%2C%20title%20and%20programme%20times');
  }

  let startIso: string;
  let endIso: string;
  try {
    startIso = catLocalToIso(startsAt);
    endIso = catLocalToIso(endsAt);
  } catch {
    redirect('/admin/schedule?error=Invalid%20programme%20date%20or%20time');
  }
  if (new Date(endIso) <= new Date(startIso)) redirect('/admin/schedule?error=Programme%20end%20must%20follow%20its%20start');

  const supabase = await staffClient();
  const { data: overlap } = await supabase
    .from('schedule_items')
    .select('id')
    .eq('channel_id', channelId)
    .lt('starts_at', endIso)
    .gt('ends_at', startIso)
    .limit(1);

  if (overlap?.length) redirect('/admin/schedule?error=That%20channel%20already%20has%20a%20programme%20in%20this%20time%20window');

  const { error } = await supabase.from('schedule_items').insert({
    channel_id: channelId,
    title,
    starts_at: startIso,
    ends_at: endIso,
    sponsor_name: sponsorName || null,
    is_premiere: isPremiere,
  });
  if (error) redirect(`/admin/schedule?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/admin/schedule');
  revalidatePath('/live');
}

export async function updateChannelStream(formData: FormData) {
  const channelId = String(formData.get('channel_id') ?? '');
  const playbackUrl = String(formData.get('playback_url') ?? '').trim();
  if (!channelId) return;
  if (playbackUrl && !/^https:\/\//i.test(playbackUrl)) redirect('/admin/schedule?error=Stream%20URL%20must%20use%20HTTPS');

  const supabase = await staffClient();
  const { error } = await supabase.from('live_channels').update({ playback_url: playbackUrl || null }).eq('id', channelId);
  if (error) redirect(`/admin/schedule?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/admin/schedule');
  revalidatePath('/live');
}
