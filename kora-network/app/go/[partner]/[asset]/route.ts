import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPartnerAccess, normaliseCountry, safeHttpsUrl } from '@/lib/partner-gateway';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ partner: string; asset: string }> }
) {
  const { partner: partnerSlug, asset: externalId } = await context.params;
  const admin = createAdminClient();

  const { data: partner, error: partnerError } = await admin
    .from('media_partners')
    .select('id,slug,status,agreement_state')
    .eq('slug', partnerSlug)
    .maybeSingle();
  if (partnerError || !partner) return NextResponse.json({ error: 'Partner unavailable' }, { status: 404 });

  const { data: asset, error: assetError } = await admin
    .from('partner_assets')
    .select('id,external_id,destination_url,tracking_mode,tracking_param,active')
    .eq('partner_id', partner.id)
    .eq('external_id', externalId)
    .maybeSingle();
  if (assetError || !asset || !asset.active) return NextResponse.json({ error: 'Programme unavailable' }, { status: 404 });

  const country = normaliseCountry(
    request.headers.get('x-vercel-ip-country') ||
    request.headers.get('cf-ipcountry')
  );
  const decision = await getPartnerAccess(asset.id, country);
  if (decision.action !== 'handoff') {
    const fallback = new URL('/partners', request.url);
    fallback.searchParams.set('access', decision.action);
    return NextResponse.redirect(fallback, 302);
  }

  const destination = safeHttpsUrl(asset.destination_url);
  if (!destination) return NextResponse.json({ error: 'Authorised destination unavailable' }, { status: 503 });

  const campaign = String(request.nextUrl.searchParams.get('campaign') || '').trim().slice(0, 100) || null;
  const source = String(request.nextUrl.searchParams.get('from') || request.headers.get('referer') || '').trim().slice(0, 500) || null;
  const { data: referral, error: referralError } = await admin
    .from('partner_referrals')
    .insert({
      partner_id: partner.id,
      asset_id: asset.id,
      campaign_id: campaign,
      source_path: source,
      country_code: country === 'ZZ' ? null : country,
    })
    .select('id')
    .single();

  if (referralError || !referral) {
    return NextResponse.json({ error: 'Attribution temporarily unavailable' }, { status: 503 });
  }

  if (asset.tracking_mode === 'query_param') {
    destination.searchParams.set(asset.tracking_param || 'kora_ref', referral.id);
  }

  const response = NextResponse.redirect(destination, 302);
  response.cookies.set('__kora_referral', referral.id, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
  return response;
}
