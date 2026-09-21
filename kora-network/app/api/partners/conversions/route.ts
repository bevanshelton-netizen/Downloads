import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashPartnerKey } from '@/lib/partner-gateway';

function clean(value: unknown, max: number) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';
}

export async function POST(request: NextRequest) {
  const rawKey = request.headers.get('x-kora-partner-key') || '';
  if (rawKey.length < 20 || rawKey.length > 256) {
    return NextResponse.json({ error: 'Invalid partner credential' }, { status: 401 });
  }

  const admin = createAdminClient();
  const keyHash = hashPartnerKey(rawKey);
  const { data: credential } = await admin
    .from('partner_webhook_keys')
    .select('partner_id,active')
    .eq('key_hash', keyHash)
    .eq('active', true)
    .maybeSingle();
  if (!credential) return NextResponse.json({ error: 'Invalid partner credential' }, { status: 401 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const providerReference = clean(body.providerReference, 200);
  const referralId = clean(body.referralId, 80) || null;
  const eventType = clean(body.eventType, 32);
  const currency = clean(body.currency, 3).toUpperCase() || 'ZAR';
  const amount = Number(body.amount ?? 0);
  const occurredAt = new Date(String(body.occurredAt || ''));

  if (!providerReference || !['lead','trial','signup','first_payment','renewal','purchase','other'].includes(eventType)) {
    return NextResponse.json({ error: 'Invalid conversion event' }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount < 0 || amount > 100000000 || !/^[A-Z]{3}$/.test(currency) || Number.isNaN(occurredAt.getTime())) {
    return NextResponse.json({ error: 'Invalid conversion amount, currency or timestamp' }, { status: 400 });
  }

  if (referralId) {
    const { data: referral } = await admin
      .from('partner_referrals')
      .select('id')
      .eq('id', referralId)
      .eq('partner_id', credential.partner_id)
      .maybeSingle();
    if (!referral) return NextResponse.json({ error: 'Referral does not belong to partner' }, { status: 400 });
  }

  const metadata = body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
    ? body.metadata
    : {};
  if (JSON.stringify(metadata).length > 6000) {
    return NextResponse.json({ error: 'Metadata too large' }, { status: 400 });
  }

  const { error } = await admin
    .from('partner_conversions')
    .upsert({
      partner_id: credential.partner_id,
      referral_id: referralId,
      provider_reference: providerReference,
      event_type: eventType,
      amount,
      currency,
      status: 'reported',
      occurred_at: occurredAt.toISOString(),
      metadata,
    }, { onConflict: 'partner_id,provider_reference', ignoreDuplicates: true });

  if (error) return NextResponse.json({ error: 'Conversion could not be recorded' }, { status: 500 });
  return NextResponse.json({ accepted: true, verification: 'reported_pending_reconciliation' });
}
