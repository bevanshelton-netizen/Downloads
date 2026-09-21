import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isDirectMediaUrl, isStaffUser, partnerContentTypes, safeHttpsUrl } from '@/lib/partner-gateway';

type Item = {
  externalId?: unknown;
  title?: unknown;
  contentType?: unknown;
  destinationUrl?: unknown;
  artworkUrl?: unknown;
  territories?: unknown;
  minimumAge?: unknown;
  trackingMode?: unknown;
  trackingParam?: unknown;
};

function cleanText(value: unknown, max: number) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';
}

export async function POST(request: NextRequest) {
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const body = await request.json().catch(() => null) as { partnerSlug?: unknown; items?: Item[] } | null;
  const partnerSlug = cleanText(body?.partnerSlug, 64);
  const items = Array.isArray(body?.items) ? body!.items : [];
  if (!partnerSlug || items.length < 1 || items.length > 500) {
    return NextResponse.json({ error: 'partnerSlug and 1-500 catalogue items are required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: partner } = await admin
    .from('media_partners')
    .select('id,status')
    .eq('slug', partnerSlug)
    .maybeSingle();
  if (!partner) return NextResponse.json({ error: 'Partner not found' }, { status: 404 });

  const staff = await isStaffUser(user.id);
  const { data: membership } = await admin
    .from('partner_memberships')
    .select('role')
    .eq('partner_id', partner.id)
    .eq('user_id', user.id)
    .maybeSingle();
  const partnerAdmin = membership?.role === 'admin';
  if (!staff && (!partnerAdmin || !['pilot','active'].includes(partner.status))) {
    return NextResponse.json({ error: 'Not authorised for this catalogue' }, { status: 403 });
  }

  const accepted: Record<string, unknown>[] = [];
  const rejected: { index: number; reason: string }[] = [];

  items.forEach((item, index) => {
    const externalId = cleanText(item.externalId, 160);
    const title = cleanText(item.title, 240);
    const contentType = cleanText(item.contentType, 32) || 'programme';
    const destination = safeHttpsUrl(item.destinationUrl);
    const artwork = item.artworkUrl ? safeHttpsUrl(item.artworkUrl) : null;
    const territories = Array.isArray(item.territories)
      ? item.territories.map(v => cleanText(v, 16).toUpperCase()).filter(v => /^[A-Z]{2}$|^GLOBAL$/.test(v)).slice(0, 100)
      : [];
    const minimumAge = item.minimumAge == null ? null : Number(item.minimumAge);
    const trackingMode = item.trackingMode === 'query_param' ? 'query_param' : 'none';
    const trackingParam = /^[A-Za-z0-9_-]{1,40}$/.test(cleanText(item.trackingParam, 40)) ? cleanText(item.trackingParam, 40) : 'kora_ref';

    if (!externalId || !title) { rejected.push({ index, reason: 'missing_id_or_title' }); return; }
    if (!partnerContentTypes.has(contentType)) { rejected.push({ index, reason: 'invalid_content_type' }); return; }
    if (!destination || isDirectMediaUrl(destination)) { rejected.push({ index, reason: 'unsafe_or_stream_destination' }); return; }
    if (item.artworkUrl && !artwork) { rejected.push({ index, reason: 'unsafe_artwork_url' }); return; }
    if (minimumAge != null && (!Number.isInteger(minimumAge) || minimumAge < 0 || minimumAge > 21)) {
      rejected.push({ index, reason: 'invalid_minimum_age' }); return;
    }

    accepted.push({
      partner_id: partner.id,
      external_id: externalId,
      title,
      content_type: contentType,
      destination_url: destination.toString(),
      artwork_url: artwork?.toString() || null,
      territories,
      minimum_age: minimumAge,
      access_mode: 'handoff',
      tracking_mode: trackingMode,
      tracking_param: trackingParam,
      active: true,
    });
  });

  if (accepted.length) {
    const { error } = await admin
      .from('partner_assets')
      .upsert(accepted, { onConflict: 'partner_id,external_id' });
    if (error) return NextResponse.json({ error: 'Catalogue write failed' }, { status: 500 });
  }

  await admin.from('partner_catalogue_imports').insert({
    partner_id: partner.id,
    submitted_by: user.id,
    item_count: items.length,
    accepted_count: accepted.length,
    rejected_count: rejected.length,
  });

  await admin.from('partner_audit_log').insert({
    actor_user_id: user.id,
    action: 'CATALOGUE_IMPORT',
    subject_table: 'partner_assets',
    subject_id: partner.id,
    after_state: { accepted: accepted.length, rejected: rejected.length },
  });

  return NextResponse.json({ accepted: accepted.length, rejected });
}
