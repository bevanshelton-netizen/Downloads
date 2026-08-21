'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const eventTypes = new Set(['concert','festival','gospel','dj_set','comedy','spoken_word','cultural','other']);
const setups = new Set(['professional_crew','obs_ready','phone_only','need_support']);
const venueStatuses = new Set(['confirmed','in_progress','not_started','not_applicable']);

function optionalHttps(value: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function submitLiveEventApplication(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/perform-live/apply');

  const artistName = String(formData.get('artist_name') ?? '').trim();
  const contactEmail = String(formData.get('contact_email') ?? '').trim().toLowerCase();
  const countryCode = String(formData.get('country_code') ?? 'ZA').trim().toUpperCase();
  const genre = String(formData.get('genre') ?? '').trim();
  const eventType = String(formData.get('event_type') ?? '');
  const proposedDate = String(formData.get('proposed_date') ?? '') || null;
  const venueName = String(formData.get('venue_name') ?? '').trim().slice(0, 160) || null;
  const venueCity = String(formData.get('venue_city') ?? '').trim().slice(0, 120) || null;
  const audienceInput = String(formData.get('expected_audience') ?? '');
  const expectedAudience = audienceInput ? Number(audienceInput) : null;
  const broadcastSetup = String(formData.get('broadcast_setup') ?? '');
  const portfolioInput = String(formData.get('portfolio_url') ?? '').trim();
  const portfolioUrl = optionalHttps(portfolioInput);
  const eventDescription = String(formData.get('event_description') ?? '').trim().slice(0, 3000);
  const venuePermissionStatus = String(formData.get('venue_permission_status') ?? '');
  const rightsConfirmed = formData.get('rights_confirmed') === 'on';
  const familySafeConfirmed = formData.get('family_safe_confirmed') === 'on';

  if (artistName.length < 2 || !/^[A-Z]{2}$/.test(countryCode) || genre.length < 2 || !eventTypes.has(eventType)) {
    redirect('/perform-live/apply?error=Complete%20the%20artist%2C%20country%2C%20genre%20and%20event%20fields');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) redirect('/perform-live/apply?error=Enter%20a%20valid%20contact%20email');
  if (!setups.has(broadcastSetup) || !venueStatuses.has(venuePermissionStatus)) redirect('/perform-live/apply?error=Complete%20the%20venue%20and%20broadcast%20readiness%20fields');
  if (portfolioInput && !portfolioUrl) redirect('/perform-live/apply?error=Portfolio%20links%20must%20use%20HTTPS');
  if (expectedAudience !== null && (!Number.isInteger(expectedAudience) || expectedAudience < 0)) redirect('/perform-live/apply?error=Expected%20audience%20must%20be%20a%20whole%20number');
  if (eventDescription.length < 40) redirect('/perform-live/apply?error=Tell%20us%20more%20about%20the%20proposed%20performance');
  if (!rightsConfirmed || !familySafeConfirmed) redirect('/perform-live/apply?error=Rights%20and%20family-safe%20confirmations%20are%20required');

  const { data: existing, error: readError } = await supabase.from('live_event_applications').select('id,status').eq('user_id', user.id).maybeSingle();
  if (readError) redirect('/perform-live/apply?error=Live%20applications%20are%20being%20prepared.%20Please%20try%20again%20after%20the%20database%20update');
  if (existing && !['submitted','waitlisted'].includes(existing.status)) redirect(`/perform-live/apply?status=${existing.status}`);

  const payload = {
    user_id: user.id,
    artist_name: artistName,
    contact_email: contactEmail,
    country_code: countryCode,
    genre,
    event_type: eventType,
    proposed_date: proposedDate,
    venue_name: venueName,
    venue_city: venueCity,
    expected_audience: expectedAudience,
    broadcast_setup: broadcastSetup,
    portfolio_url: portfolioUrl,
    event_description: eventDescription,
    rights_confirmed: true,
    venue_permission_status: venuePermissionStatus,
    family_safe_confirmed: true,
    updated_at: new Date().toISOString(),
  };

  const result = existing
    ? await supabase.from('live_event_applications').update(payload).eq('id', existing.id)
    : await supabase.from('live_event_applications').insert({ ...payload, status: 'submitted' });
  if (result.error) redirect(`/perform-live/apply?error=${encodeURIComponent(result.error.message)}`);

  revalidatePath('/perform-live/apply');
  revalidatePath('/admin/live-events');
  redirect('/perform-live/apply?submitted=1');
}
