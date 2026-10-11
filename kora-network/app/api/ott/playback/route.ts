import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { starterCatalog } from '@/lib/ott/catalog';
import { authorizePlayback } from '@/lib/ott/gateway';
import type { KoraEntitlement } from '@/lib/ott/entitlements';
import type { KoraPlaybackProtocol } from '@/lib/ott/playback';

const contentTypes = new Set<KoraEntitlement>(['live', 'vod', 'fast', 'sports', 'music', 'kids', 'faith', 'creator']);
const protocols = new Set<KoraPlaybackProtocol>(['hls', 'dash']);

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const contentId = String(body.contentId ?? '');
  const device = String(body.device ?? 'web');
  const protocol = String(body.protocol ?? 'hls') as KoraPlaybackProtocol;
  const contentType = String(body.contentType ?? 'live') as KoraEntitlement;

  if (!contentId) return NextResponse.json({ error: 'contentId is required' }, { status: 400 });
  if (!protocols.has(protocol)) return NextResponse.json({ error: 'Unsupported playback protocol' }, { status: 400 });
  if (!contentTypes.has(contentType)) return NextResponse.json({ error: 'Unsupported content type' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let subscription;

  if (user) {
    const { data } = await supabase
      .from('subscriptions')
      .select('user_id,status,current_period_end,plan')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .gt('current_period_end', new Date().toISOString())
      .limit(1)
      .maybeSingle();

    if (data) {
      const plan = String(data.plan ?? 'premium');
      const allowedPlans = new Set(['free', 'premium', 'sports', 'family', 'enterprise']);
      subscription = {
        userId: user.id,
        plan: (allowedPlans.has(plan) ? plan : 'premium') as 'free' | 'premium' | 'sports' | 'family' | 'enterprise',
        active: true,
        startsAt: new Date().toISOString(),
        endsAt: data.current_period_end ?? undefined,
      };
    }
  }

  const decision = authorizePlayback(
    { catalog: starterCatalog, session: user ? undefined : undefined, subscription },
    { contentId, device, protocol, userId: user?.id },
    contentType,
  );

  if (!decision.allowed) return NextResponse.json({ ok: false, reason: decision.reason }, { status: 403 });
  return NextResponse.json({ ok: true, playback: decision.playbackSession });
}
