import { createClient } from '@/lib/supabase/server';

export type GuideItem = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  sponsor_name: string | null;
  is_premiere: boolean;
};

export type BroadcastChannel = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  playback_url: string | null;
  logo_url: string | null;
  is_family_safe: boolean;
  now: GuideItem | null;
  next: GuideItem | null;
};

export async function getBroadcastGuide(): Promise<BroadcastChannel[]> {
  const supabase = await createClient();
  const now = new Date();
  const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const [{ data: channels, error: channelError }, { data: schedule, error: scheduleError }] = await Promise.all([
    supabase
      .from('live_channels')
      .select('id,name,slug,description,playback_url,logo_url,is_family_safe')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('schedule_items')
      .select('id,channel_id,title,starts_at,ends_at,sponsor_name,is_premiere')
      .gte('ends_at', now.toISOString())
      .lte('starts_at', horizon.toISOString())
      .order('starts_at'),
  ]);

  if (channelError || scheduleError) return [];

  return (channels ?? []).map((channel) => {
    const items = (schedule ?? []).filter((item) => item.channel_id === channel.id);
    const current = items.find((item) => new Date(item.starts_at) <= now && new Date(item.ends_at) > now) ?? null;
    const upcoming = items.find((item) => new Date(item.starts_at) > now) ?? null;
    return { ...channel, now: current, next: upcoming } as BroadcastChannel;
  });
}

export async function getChannel(slug: string) {
  const supabase = await createClient();
  const now = new Date();
  const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const { data: channel } = await supabase
    .from('live_channels')
    .select('id,name,slug,description,playback_url,logo_url,is_family_safe')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  if (!channel) return null;

  const { data: schedule } = await supabase
    .from('schedule_items')
    .select('id,title,starts_at,ends_at,sponsor_name,is_premiere')
    .eq('channel_id', channel.id)
    .gte('ends_at', now.toISOString())
    .lte('starts_at', horizon.toISOString())
    .order('starts_at')
    .limit(12);

  return { channel, schedule: schedule ?? [] };
}
