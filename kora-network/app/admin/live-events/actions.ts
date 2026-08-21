'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function requireStaff() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (!profile || !['moderator','admin'].includes(profile.role)) redirect('/');
}

function slugify(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'artist';
}

function optionalUrl(value: FormDataEntryValue | null) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export async function reviewLiveEvent(formData: FormData) {
  await requireStaff();
  const id = String(formData.get('application_id') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const reviewNotes = String(formData.get('review_notes') ?? '').trim().slice(0, 2000) || null;
  if (!id || !['reviewing','rehearsal','waitlisted','approved','declined','cancelled'].includes(decision)) return;

  const admin = createAdminClient();
  const { error } = await admin.from('live_event_applications').update({
    status: decision,
    review_notes: reviewNotes,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) redirect(`/admin/live-events?error=${encodeURIComponent(error.message)}`);

  revalidatePath('/admin/live-events');
  revalidatePath('/perform-live/apply');
}

export async function prepareArtistProfile(formData: FormData) {
  await requireStaff();
  const applicationId = String(formData.get('application_id') ?? '');
  if (!applicationId) return;
  const admin = createAdminClient();
  const { data: app, error } = await admin.from('live_event_applications')
    .select('id,user_id,artist_name,country_code,genre,event_description,portfolio_url,status')
    .eq('id', applicationId)
    .maybeSingle();
  if (error || !app) redirect('/admin/live-events?error=Live%20application%20not%20found');
  if (app.status !== 'approved') redirect('/admin/live-events?error=Approve%20the%20artist%20pilot%20before%20preparing%20a%20public%20profile');

  const { data: creator } = await admin.from('creators').select('id').eq('owner_id', app.user_id).maybeSingle();
  const { data: existing } = await admin.from('artist_profiles').select('id,slug').eq('live_application_id', applicationId).maybeSingle();
  const base = {
    owner_id: app.user_id,
    creator_id: creator?.id ?? null,
    display_name: app.artist_name,
    country_code: app.country_code,
    primary_genre: app.genre,
    bio: app.event_description,
    portfolio_url: app.portfolio_url,
    updated_at: new Date().toISOString(),
  };
  const result = existing
    ? await admin.from('artist_profiles').update(base).eq('id', existing.id)
    : await admin.from('artist_profiles').insert({ ...base, live_application_id: applicationId, slug: `${slugify(app.artist_name)}-${app.id.slice(0, 6)}`, is_published: false });
  if (result.error) redirect(`/admin/live-events?error=${encodeURIComponent(result.error.message)}`);
  revalidatePath('/admin/live-events');
}

export async function updateArtistProfile(formData: FormData) {
  await requireStaff();
  const id = String(formData.get('profile_id') ?? '');
  const displayName = String(formData.get('display_name') ?? '').trim();
  const countryCode = String(formData.get('country_code') ?? '').trim().toUpperCase();
  const genre = String(formData.get('primary_genre') ?? '').trim();
  const bio = String(formData.get('bio') ?? '').trim();
  const booking = String(formData.get('public_booking_email') ?? '').trim() || null;
  if (!id || displayName.length < 2 || !/^[A-Z]{2}$/.test(countryCode) || genre.length < 2 || bio.length < 40) {
    redirect('/admin/live-events?error=Complete%20the%20artist%20profile%20before%20saving');
  }
  if (booking && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(booking)) redirect('/admin/live-events?error=Enter%20a%20valid%20public%20booking%20email');
  const admin = createAdminClient();
  const { error } = await admin.from('artist_profiles').update({
    display_name: displayName,
    country_code: countryCode,
    primary_genre: genre,
    bio,
    portfolio_url: optionalUrl(formData.get('portfolio_url')),
    public_booking_email: booking,
    website_url: optionalUrl(formData.get('website_url')),
    social_url: optionalUrl(formData.get('social_url')),
    updated_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) redirect(`/admin/live-events?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/admin/live-events');
  revalidatePath('/artists');
}

export async function setArtistProfilePublication(formData: FormData) {
  await requireStaff();
  const id = String(formData.get('profile_id') ?? '');
  const publish = String(formData.get('publish') ?? '') === 'true';
  if (!id) return;
  const admin = createAdminClient();
  const { data: profile } = await admin.from('artist_profiles').select('slug,live_application_id').eq('id', id).maybeSingle();
  if (!profile) redirect('/admin/live-events?error=Artist%20profile%20not%20found');
  const { data: app } = await admin.from('live_event_applications').select('status').eq('id', profile.live_application_id).maybeSingle();
  if (publish && app?.status !== 'approved') redirect('/admin/live-events?error=Only%20approved%20artist%20pilots%20can%20be%20published');
  const { error } = await admin.from('artist_profiles').update({
    is_published: publish,
    published_at: publish ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) redirect(`/admin/live-events?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/admin/live-events');
  revalidatePath('/artists');
  revalidatePath(`/artists/${profile.slug}`);
  revalidatePath('/music');
}
