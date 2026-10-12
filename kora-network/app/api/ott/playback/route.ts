import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { starterCatalog } from '@/lib/ott/catalog';
import { authorizePlayback } from '@/lib/ott/gateway';
import { isSupportedDevice, preferredProtocol, supportedDevices, type KoraDevice } from '@/lib/ott/devices';
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
  const deviceValue = String(body.device ?? 'web');
  if (!isSupportedDevice(deviceValue)) return NextResponse.json({ error: 'Unsupported KORA device' }, { status: 400 });
  const device = deviceValue as KoraDevice;
  const requestedProtocol = String(body.protocol ?? preferredProtocol(device)) as KoraPlaybackProtocol;
  const protocol = protocols.has(requestedProtocol) ? requestedProtocol : preferredProtocol(device);
  let contentType = String(body.contentType ?? 'live') as KoraEntitlement;

  if (!contentId && !productionId) return NextResponse.json({ error: 'contentId or productionId is required' }, { status: 400 });
  if (!contentTypes.has(contentType) && !productionId) return NextResponse.json({ error: 'Unsupported content type' }, { status: 400 });
  if (!supportedDevices[device].playback.includes(protocol)) return NextResponse.json({ error: 'Playback protocol is not supported by this device' }, { status: 400 });

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

  let resolvedContent: { id: string; active: boolean } | undefined;

  if (productionId) {
    const { data: production } = await supabase
      .from('productions')
      .select('id,access_mode,status')
      .eq('id', productionId)
      .maybeSingle();
    if (!production || production.status !== 'published') return NextResponse.json({ ok: false, reason: 'content_not_found' }, { status: 404 });
    if (!accessModes.has(production.access_mode as KoraProductionAccessMode)) return NextResponse.json({ ok: false, reason: 'content_not_found' }, { status: 404 });
    contentType = entitlementForProduction(production.access_mode as KoraProductionAccessMode);

    if (contentType === 'vod') {
      const { data: episode } = await supabase
        .from('episodes')
        .select('id,production_id,status,playback_id')
        .eq('id', contentId)
        .eq('production_id', productionId)
        .maybeSingle();
      if (!episode || episode.status !== 'published' || !episode.playback_id) return NextResponse.json({ ok: false, reason: 'content_not_found' }, { status: 404 });
      resolvedContent = { id: episode.id, active: true };
    }
  }

  const decision = authorizePlayback(
    { catalog: starterCatalog, subscription, content: resolvedContent },
    { contentId, device, protocol, userId: user?.id },
    contentType,
  );

  if (!decision.allowed) return NextResponse.json({ ok: false, reason: decision.reason }, { status: 403 });
  return NextResponse.json({
    ok: true,
    contentId,
    productionId: productionId || null,
    device: { id: device, ...supportedDevices[device] },
    playback: decision.playbackSession,
  });
}
