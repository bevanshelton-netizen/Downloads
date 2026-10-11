import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAnalyticsEvent, type KoraAnalyticsEventName } from '@/lib/ott/analytics';

const eventNames = new Set<KoraAnalyticsEventName>([
  'app_open', 'catalog_view', 'content_view', 'playback_start', 'playback_pause',
  'playback_complete', 'playback_error', 'search', 'subscription_start',
  'subscription_cancel', 'ad_impression', 'ad_complete',
]);

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? '') as KoraAnalyticsEventName;
  if (!eventNames.has(name)) return NextResponse.json({ error: 'Unsupported analytics event' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const event = createAnalyticsEvent(name, {
    userId: user?.id,
    sessionId: typeof body.sessionId === 'string' ? body.sessionId : undefined,
    contentId: typeof body.contentId === 'string' ? body.contentId : undefined,
    device: typeof body.device === 'string' ? body.device : undefined,
    metadata: typeof body.metadata === 'object' && body.metadata !== null ? body.metadata : undefined,
  });

  console.info('[KORA OTT analytics]', event);
  return NextResponse.json({ ok: true, event });
}
