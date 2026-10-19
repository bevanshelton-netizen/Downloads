import { createClient } from '@/lib/supabase/server';

export type GuideItem = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  sponsor_name: string | null;
  is_premiere: boolean;
  is_synthetic?: boolean;
};

export type BroadcastChannel = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  playback_url: string | null;
  logo_url: string | null;
  is_family_safe: boolean;
  display_order: number;
  now: GuideItem | null;
  next: GuideItem | null;
  schedule_source?: 'database' | 'continuity-preview';
};

const FALLBACK_CHANNELS = [
  ['KORA One', 'kora-one', 'Flagship African entertainment'],
  ['KORA Drama', 'kora-drama', 'African drama around the clock'],
  ['KORA Family', 'kora-family', 'Family-safe entertainment'],
  ['KORA Faith', 'kora-faith', 'Faith, values and inspiration'],
  ['KORA Music', 'kora-music', 'Music, performance and culture'],
  ['KORA Kids', 'kora-kids', 'Curated programming for children'],
  ['KORA Creators', 'kora-creators', 'Independent African creator showcase'],
] as const;

function envStream(slug: string) {
  const key = `KORA_STREAM_URL_${slug.toUpperCase().replace(/-/g, '_')}`;
  return process.env[key] || null;
}

function continuityGuide(channelId: string, now = new Date()): GuideItem[] {
  const slotMs = 30 * 60 * 1000;
  const start = new Date(Math.floor(now.getTime() / slotMs) * slotMs);
  return Array.from({ length: 12 }, (_, index) => {
    const startsAt = new Date(start.getTime() + index * slotMs);
    const endsAt = new Date(startsAt.getTime() + slotMs);
    return {
      id: `continuity-${channelId}-${startsAt.toISOString()}`,
      title: 'KORA Continuity',
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      sponsor_name: null,
      is_premiere: false,
      is_synthetic: true,
    };
  });
}

function fallbackGuide(): BroadcastChannel[] {
  const now = new Date();
  return FALLBACK_CHANNELS.map(([name, slug, description], index) => {
    const schedule = continuityGuide(slug, now);
    return {
      id: slug,
      name,
      slug,
      description,
      playback_url: envStream(slug),
      logo_url: null,
      is_family_safe: true,
      display_order: index + 1,
      now: schedule[0],
      next: schedule[1],
      schedule_source: 'continuity-preview',
    };
  });
}

export async function getBroadcastGuide(): Promise<BroadcastChannel[]> {
  try {
    const supabase = await createClient();
    const now = new Date();
    const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const [{ data: channels, error: channelError }, { data: schedule, error: scheduleError }] = await Promise.all([
      supabase
        .from('live_channels')
        .select('id,name,slug,description,playback_url,logo_url,is_family_safe,display_order')
        .eq('is_active', true)
        .order('display_order'),
      supabase
        .from('schedule_items')
        .select('id,channel_id,title,starts_at,ends_at,sponsor_name,is_premiere')
        .gte('ends_at', now.toISOString())
        .lte('starts_at', horizon.toISOString())
        .order('starts_at'),
    ]);

    if (channelError || scheduleError || !channels?.length) return fallbackGuide();

    return channels.map((channel) => {
      const items = (schedule ?? []).filter((item) => item.channel_id === channel.id);
      const current = items.find((item) => new Date(item.starts_at) <= now && new Date(item.ends_at) > now) ?? null;
      const upcoming = items.find((item) => new Date(item.starts_at) > now) ?? null;
      const preview = continuityGuide(channel.id, now);
      return {
        ...channel,
        playback_url: channel.playback_url || envStream(channel.slug),
        now: current ?? preview[0],
        next: upcoming ?? preview[1],
        schedule_source: current || upcoming ? 'database' : 'continuity-preview',
      } as BroadcastChannel;
    });
  } catch {
    return fallbackGuide();
  }
}

export async function getChannel(slug: string) {
  try {
    const supabase = await createClient();
    const now = new Date();
    const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const { data: channel } = await supabase
      .from('live_channels')
      .select('id,name,slug,description,playback_url,logo_url,is_family_safe,display_order')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();
    if (channel) {
      const { data: schedule } = await supabase
        .from('schedule_items')
        .select('id,title,starts_at,ends_at,sponsor_name,is_premiere')
        .eq('channel_id', channel.id)
        .gte('ends_at', now.toISOString())
        .lte('starts_at', horizon.toISOString())
        .order('starts_at')
        .limit(12);
      const preview = continuityGuide(channel.id, now);
      const items = schedule?.length ? schedule : preview;
      return {
        channel: { ...channel, playback_url: channel.playback_url || envStream(channel.slug) },
        schedule: items,
        schedule_source: schedule?.length ? 'database' : 'continuity-preview',
      };
    }
  } catch {
    // Provider/database outage: continue to the provider-independent public fallback.
  }

  const fallback = fallbackGuide().find((item) => item.slug === slug);
  if (!fallback) return null;
  const schedule = continuityGuide(fallback.id, new Date());
  return {
    channel: {
      id: fallback.id,
      name: fallback.name,
      slug: fallback.slug,
      description: fallback.description,
      playback_url: fallback.playback_url,
      logo_url: fallback.logo_url,
      is_family_safe: fallback.is_family_safe,
      display_order: fallback.display_order,
    },
    schedule,
    schedule_source: 'continuity-preview' as const,
  };
}
