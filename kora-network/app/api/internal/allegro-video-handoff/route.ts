import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createDirectVideoUpload } from '@/lib/video';

const TYPES = new Set([
  'music_video','live_session','concert_film','artist_documentary',
  'revival_documentary','tour_diary','behind_the_scenes','music_biopic',
  'music_movie','launch_film','interview_special'
]);

function clean(v: unknown, max=500) {
  return typeof v === 'string' ? v.trim().slice(0,max) : '';
}

function rightsGate(type: string, rights: Record<string, unknown>) {
  const blockers: string[] = [];
  if (rights.identity_and_authority_confirmed !== true) blockers.push('identity_and_authority');
  if (rights.music_rights_cleared !== true) blockers.push('music_rights');
  if (rights.master_rights_cleared !== true) blockers.push('master_rights');
  if (rights.performer_consents_complete !== true) blockers.push('performer_consents');
  if (rights.visual_material_rights_cleared !== true) blockers.push('visual_material_rights');

  const docTypes = new Set([
    'artist_documentary','revival_documentary','tour_diary',
    'behind_the_scenes','music_biopic','interview_special'
  ]);
  if (docTypes.has(type)) {
    if (rights.interview_releases_complete !== true) blockers.push('interview_releases');
    if (rights.archive_footage_cleared !== true) blockers.push('archive_footage');
    if (rights.stills_and_photography_cleared !== true) blockers.push('stills_and_photography');
  }

  if (type === 'music_movie' || type === 'music_biopic') {
    if (rights.script_rights_cleared !== true) blockers.push('script_rights');
    if (rights.cast_releases_complete !== true) blockers.push('cast_releases');
    if (rights.location_rights_complete !== true) blockers.push('location_rights');
  }

  if (rights.active_dispute === true) blockers.push('active_dispute');
  return { status: blockers.length ? 'blocked' : 'review', blockers };
}

export async function POST(request: Request) {
  const expected = process.env.ALLEGRO_KORA_INTEGRATION_KEY || '';
  const provided = request.headers.get('x-allegro-kora-key') || '';
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: 'Integration authentication failed' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const allegroRef = clean(body.allegro_creator_ref, 200);
  const title = clean(body.title, 180);
  const synopsis = clean(body.synopsis, 3000);
  const contentType = clean(body.content_type, 80);
  const sourceReference = clean(body.source_reference, 500);
  const rights = body.rights && typeof body.rights === 'object' ? body.rights as Record<string, unknown> : {};

  if (!allegroRef || !title || !TYPES.has(contentType)) {
    return NextResponse.json({ error: 'allegro_creator_ref, title and supported content_type are required' }, { status: 422 });
  }

  const gate = rightsGate(contentType, rights);
  if (gate.status === 'blocked') {
    return NextResponse.json({ error: 'Rights clearance incomplete', blockers: gate.blockers }, { status: 409 });
  }

  const admin = createAdminClient();
  const { data: link } = await admin.from('allegro_creator_links')
    .select('kora_creator_id,status')
    .eq('allegro_creator_ref', allegroRef)
    .maybeSingle();

  if (!link || link.status !== 'active') {
    return NextResponse.json({ error: 'Artist must link ALLEGRO to KORA first' }, { status: 409 });
  }

  const slugBase = title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,70) || 'allegro-screen';
  const slug = `${slugBase}-${crypto.randomUUID().slice(0,8)}`;

  const { data: production, error: prodError } = await admin.from('productions').insert({
    creator_id: link.kora_creator_id,
    title,
    slug,
    synopsis: synopsis || null,
    genre: 'Music',
    primary_language: clean(body.primary_language,80) || null,
    age_rating: clean(body.age_rating,20) || null,
    status: 'draft',
    content_type: contentType,
    source_platform: 'allegro',
    source_reference: sourceReference || allegroRef,
    rights_clearance_status: 'review',
    explicit_sexual_content: false
  }).select('id,title,slug,status').single();

  if (prodError || !production) {
    return NextResponse.json({ error: prodError?.message || 'Could not create KORA production' }, { status: 400 });
  }

  const { data: episode, error: episodeError } = await admin.from('episodes').insert({
    production_id: production.id,
    episode_number: 1,
    title,
    duration_seconds: 0,
    status: 'draft'
  }).select('id').single();

  if (episodeError || !episode) {
    await admin.from('productions').delete().eq('id', production.id);
    return NextResponse.json({ error: episodeError?.message || 'Could not create KORA video item' }, { status: 400 });
  }

  const upload = await createDirectVideoUpload(4 * 60 * 60);

  const { error: assetError } = await admin.from('upload_assets').insert({
    episode_id: episode.id,
    provider: upload.provider,
    provider_asset_id: upload.assetId,
    upload_status: 'created',
    moderation_status: 'pending'
  });
  if (assetError) {
    return NextResponse.json({ error: assetError.message }, { status: 400 });
  }

  const handoffId = crypto.randomUUID();
  const { error: handoffError } = await admin.from('allegro_video_handoffs').insert({
    id: handoffId,
    allegro_creator_ref: allegroRef,
    kora_creator_id: link.kora_creator_id,
    production_id: production.id,
    episode_id: episode.id,
    content_type: contentType,
    rights_manifest: rights,
    rights_status: 'review',
    source_title: title,
    source_reference: sourceReference || null
  });

  if (handoffError) {
    return NextResponse.json({ error: handoffError.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    handoff_id: handoffId,
    production,
    episode_id: episode.id,
    moderation_status: 'pending',
    rights_status: 'review',
    upload
  }, { status: 201 });
}
