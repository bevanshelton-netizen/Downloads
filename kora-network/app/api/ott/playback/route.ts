import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { starterCatalog } from '@/lib/ott/catalog';
import { authorizePlayback } from '@/lib/ott/gateway';
import { entitlementForProduction, type KoraProductionAccessMode } from '@/lib/ott/production';
import type { KoraEntitlement } from '@/lib/ott/entitlements';
import type { KoraPlaybackProtocol } from '@/lib/ott/playback';

const contentTypes = new Set<KoraEntitlement>(['live', 'vod', 'fast', 'sports', 'music', 'kids', 'faith', 'creator']);
const protocols = new Set<KoraPlaybackProtocol>(['hls', 'dash']);
const accessModes = new Set<KoraProductionAccessMode>(['free', 'ad_supported', 'premium', 'pay_per_view']);

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const contentId = String(body.contentId ?? '');
  const productionId = String(body.productionId ?? '');
  const device = String(body.device ?? 'web');
  const protocol = String(body.protocol ?? 'hls') as KoraPlaybackProtocol;
  let contentType = String(body.contentType ?? 'live') as KoraEntitlement;

  if (!contentId && !productionId) return NextResponse.json({ error: 'contentId or productionId is required' }, { status: 400 });
  if (!protocols.has(protocol)) return NextResponse.json({ error: 'Unsupported playback protocol' }, { status: 400 });
  if (contentId && !productionId && !contentTypes.has(contentType)) return NextResponse.json({ error: 'Unsupported content type' }, { status: 400 });

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

  if (productionId) {
    const { data: production } = await supabase
      .from('productions')
      .select('id,access_mode,status')
      .eq('id', productionId)
      .maybeSingle();
    if (!production || production.status !== 'published') return NextResponse.json({ ok: false, reason: 'content_not_found' }, { status: 404 });
    if (!accessModes.has(production.access_mode as KoraProductionAccessMode)) return NextResponse.json({ ok: false, reason: 'content_not_found' }, { status: 404 });
    contentType = entitlementForProduction(production.access_mode as KoraProductionAccessMode);
  }

  if (productionId && contentType === 'vod') {
    const { data: episode } = await supabase
      .from('episodes')
      .select('id,production_id,status,playback_id')
      .eq('id', contentId)
      .eq('production_id', productionId)
      .maybeSingle();
    if (!episode || episode.status !== 'published') return NextResponse.json({ ok: false, reason: 'content_not_found' }, { status: 404 });
    if (!episode.playback_id) return NextResponse.json({ ok: false, reason: 'content_not_found' }, { status: 404 });
  }

  const channelContentId = productionId ? 'kora-live' : contentId;
  const decision = authorizePlayback(
    { catalog: starterCatalog, subscription },
    { contentId: channelContentId, device, protocol, userId: user?.id },
    contentType,
  );

  if (!decision.allowed) return NextResponse.json({ ok: false, reason: decision.reason }, { status: 403 });
  return NextResponse.json({ ok: true, contentId, productionId: productionId || null, playback: decision.playbackSession });
}
