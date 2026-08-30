import { buildPayFastCheckout, validatePayFastItn, type PayFastConfig } from './payfast';
interface D1PreparedStatement { bind(...values: unknown[]): D1PreparedStatement; first<T = any>(): Promise<T | null>; all<T = any>(): Promise<{ results?: T[] }>; run(): Promise<unknown>; }
interface D1Database { prepare(query: string): D1PreparedStatement; batch(statements: D1PreparedStatement[]): Promise<unknown>; }
interface R2ObjectBodyLike { body?: ReadableStream; size: number; httpEtag?: string; range?: { offset?: number; length?: number; suffix?: number }; writeHttpMetadata(headers: Headers): void; }
interface R2Bucket { put(key: string, value: ReadableStream | null, options?: any): Promise<unknown>; get(key: string, options?: any): Promise<R2ObjectBodyLike | null>; }
interface Fetcher { fetch(request: Request): Promise<Response>; }

interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  ASSETS: Fetcher;
  ADMIN_SECRET?: string;
  ABUSE_SALT?: string;
  APP_ENV?: string;
  PUBLIC_BASE_URL?: string;
  ALLOWED_ORIGINS?: string;
  PAYFAST_MERCHANT_ID?: string;
  PAYFAST_MERCHANT_KEY?: string;
  PAYFAST_PASSPHRASE?: string;
  PAYFAST_MODE?: string;
  PAYFAST_ALLOWED_CIDRS?: string;
}

type Json = Record<string, unknown>;
const enc = new TextEncoder();
const MAX_UPLOAD_BYTES = 90 * 1024 * 1024;
const MEDIA_HARD_CAP_BYTES = 8 * 1024 * 1024 * 1024;
const SESSION_DAYS = 30;
const INVITE_HOURS = 72;
const QUALIFIED_SECONDS = 30;
const MAX_HEARTBEAT_INCREMENT = 15;
const LEADS_PER_IP_DAY = 10;
const LEADS_PER_EMAIL_DAY = 5;
const TERMS_VERSION = '2026-08-29';
const PRIVACY_VERSION = '2026-08-29';
const LEAD_STATUSES = ['new','contacted','qualified','converted','closed'] as const;
const LEAD_KINDS = ['creator','advertiser','partner','viewer','support'] as const;

function allowedOrigins(req: Request, env: Env) {
  const self = new URL(req.url).origin;
  return new Set([self, ...(env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean)]);
}
function corsHeaders(req: Request, env: Env): HeadersInit {
  const origin = req.headers.get('origin');
  if (!origin || !allowedOrigins(req, env).has(origin)) return { 'vary': 'Origin' };
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization,x-admin-secret,x-upload-bytes',
    'access-control-allow-credentials': 'true',
    'vary': 'Origin',
  };
}
function json(req: Request, env: Env, data: Json | unknown[], status = 200, extra: HeadersInit = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(req, env), ...extra } });
}
function fail(req: Request, env: Env, message: string, status = 400) { return json(req, env, { ok: false, error: message }, status); }
function id(prefix: string) { return `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`; }
function cleanEmail(v: unknown) { return typeof v === 'string' ? v.trim().toLowerCase() : ''; }
function cleanText(v: unknown, max: number) { return typeof v === 'string' ? v.trim().slice(0, max) : ''; }
function validEmail(v: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function futureIso(hours: number) { return new Date(Date.now() + hours * 3600_000).toISOString(); }
function todayUtc() { return new Date().toISOString().slice(0, 10); }
function cookie(req: Request, name: string) {
  const raw = req.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return '';
}
function sessionCookie(name: string, token: string, days: number) {
  return `${name}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${days * 86400}`;
}
function clearCookie(name: string) { return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`; }
function isAdmin(req: Request, env: Env) { return Boolean(env.ADMIN_SECRET && req.headers.get('x-admin-secret') === env.ADMIN_SECRET); }

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(value));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function randomToken(bytes = 32) {
  const a = new Uint8Array(bytes); crypto.getRandomValues(a);
  let s = ''; for (const n of a) s += String.fromCharCode(n);
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
async function body(req: Request): Promise<any> {
  const ct = req.headers.get('content-type') || '';
  if (!ct.includes('application/json')) throw new Error('Expected application/json');
  return req.json();
}
async function platform(env: Env, slug: string) {
  return env.DB.prepare('SELECT id, slug, name, status FROM platforms WHERE slug=?').bind(slug).first<any>();
}
async function creatorFromRequest(req: Request, env: Env) {
  const h = req.headers.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7).trim() : cookie(req, 'vz_creator');
  if (!token) return null;
  const hash = await sha256(token);
  return env.DB.prepare(`SELECT c.id,c.platform_id,c.email,c.display_name,c.handle,c.status
    FROM sessions s JOIN creators c ON c.id=s.creator_id
    WHERE s.token_hash=? AND s.expires_at > CURRENT_TIMESTAMP AND c.status='active'`)
    .bind(hash).first<any>();
}
async function viewerFromRequest(req: Request, env: Env) {
  const token = cookie(req, 'vz_viewer');
  if (!token) return null;
  return env.DB.prepare(`SELECT id,platform_id FROM viewer_sessions WHERE token_hash=? AND expires_at > CURRENT_TIMESTAMP`)
    .bind(await sha256(token)).first<any>();
}
async function audit(env: Env, platformId: string | null, actor: string, action: string, targetType?: string, targetId?: string, metadata?: unknown) {
  await env.DB.prepare('INSERT INTO audit_log(id,platform_id,actor,action,target_type,target_id,metadata) VALUES(?,?,?,?,?,?,?)')
    .bind(id('aud'), platformId, actor, action, targetType || null, targetId || null, metadata ? JSON.stringify(metadata).slice(0,4000) : null).run();
}
async function bumpLimit(env: Env, key: string, limit: number) {
  const day = todayUtc();
  await env.DB.prepare(`INSERT INTO rate_limits(key,window_date,count) VALUES(?,?,1)
    ON CONFLICT(key,window_date) DO UPDATE SET count=count+1`).bind(key, day).run();
  const row = await env.DB.prepare('SELECT count FROM rate_limits WHERE key=? AND window_date=?').bind(key, day).first<any>();
  return Number(row?.count || 0) <= limit;
}
async function enforceLeadRate(req: Request, env: Env, email: string) {
  const salt = env.ABUSE_SALT || env.ADMIN_SECRET || 'bootstrap-no-secret';
  const ip = req.headers.get('cf-connecting-ip') || 'unknown';
  const ipKey = 'lead-ip:' + await sha256(`${salt}:${todayUtc()}:${ip}`);
  const emailKey = 'lead-email:' + await sha256(`${salt}:${todayUtc()}:${email}`);
  const ipOk = await bumpLimit(env, ipKey, LEADS_PER_IP_DAY);
  const emailOk = await bumpLimit(env, emailKey, LEADS_PER_EMAIL_DAY);
  return ipOk && emailOk;
}
async function ensureViewer(req: Request, env: Env, p: any) {
  const existing = await viewerFromRequest(req, env);
  if (existing && existing.platform_id === p.id) return { viewer: existing, cookieHeader: '' };
  const token = await randomToken(24), viewerId = id('vws');
  await env.DB.prepare('INSERT INTO viewer_sessions(id,platform_id,token_hash,expires_at) VALUES(?,?,?,?)')
    .bind(viewerId, p.id, await sha256(token), futureIso(SESSION_DAYS * 24)).run();
  return { viewer: { id: viewerId, platform_id: p.id }, cookieHeader: sessionCookie('vz_viewer', token, SESSION_DAYS) };
}
function csvEscape(value: unknown) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replaceAll('"','""')}"` : s;
}

function payFastConfig(req: Request, env: Env): PayFastConfig | null {
  if (!env.PAYFAST_MERCHANT_ID || !env.PAYFAST_MERCHANT_KEY) return null;
  const mode = env.PAYFAST_MODE === 'live' ? 'live' : 'sandbox';
  return {
    merchantId: env.PAYFAST_MERCHANT_ID,
    merchantKey: env.PAYFAST_MERCHANT_KEY,
    passphrase: env.PAYFAST_PASSPHRASE,
    mode,
    baseUrl: (env.PUBLIC_BASE_URL || new URL(req.url).origin).replace(/\/$/, ''),
    allowedCidrs: env.PAYFAST_ALLOWED_CIDRS,
  };
}

async function adminLeadRows(env: Env, url: URL) {
  const slug = cleanText(url.searchParams.get('platform') || 'videonomy', 60);
  const p = await platform(env, slug); if (!p) return { p: null, rows: [] as any[] };
  const status = cleanText(url.searchParams.get('status') || '', 30);
  const kind = cleanText(url.searchParams.get('kind') || '', 30);
  const limit = Math.max(1, Math.min(250, Number(url.searchParams.get('limit') || 100)));
  let sql = `SELECT id,kind,name,email,phone,message,offer_code,status,admin_notes,created_at FROM leads WHERE platform_id=?`;
  const args: unknown[] = [p.id];
  if (status && LEAD_STATUSES.includes(status as any)) { sql += ' AND status=?'; args.push(status); }
  if (kind && LEAD_KINDS.includes(kind as any)) { sql += ' AND kind=?'; args.push(kind); }
  sql += ' ORDER BY created_at DESC LIMIT ?'; args.push(limit);
  const rows = await env.DB.prepare(sql).bind(...args).all<any>();
  return { p, rows: rows.results || [] };
}

async function handleApi(req: Request, env: Env, url: URL): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req, env) });

  if (url.pathname === '/api/health' && req.method === 'GET') {
    const row = await env.DB.prepare('SELECT 1 AS ok').first<any>();
    return json(req, env, { ok: row?.ok === 1, service: 'IZAKHONO CLOUD ZERO', version: '0.2', env: env.APP_ENV || 'production' });
  }
  if (url.pathname === '/api/public/config' && req.method === 'GET') {
    const slug = url.searchParams.get('platform') || 'videonomy';
    const p = await platform(env, slug); if (!p) return fail(req, env, 'Unknown platform', 404);
    return json(req, env, {
      ok: true, platform: p,
      economics: { watch_ads_creator_pct: 70, subscription_pool_creator_pct: 80, direct_fan_creator_pct: 90, brand_marketplace_creator_pct: 90 },
      qualified_view_seconds: QUALIFIED_SECONDS,
      upload_limit_mb: 90, media_hard_cap_gb: 8,
    });
  }

  if (url.pathname === '/api/commerce/packages' && req.method === 'GET') {
    const slug = url.searchParams.get('platform') || 'videonomy';
    const p = await platform(env, slug); if (!p) return fail(req, env, 'Unknown platform', 404);
    const rows = await env.DB.prepare(`SELECT code,name,kind,amount_minor,currency FROM commerce_packages WHERE platform_id=? AND active=1 ORDER BY amount_minor`).bind(p.id).all<any>();
    return json(req, env, { ok: true, packages: rows.results || [] });
  }
  if (url.pathname === '/api/commerce/payment-intents' && req.method === 'POST') {
    const b = await body(req), p = await platform(env, cleanText(b.platform || 'videonomy', 60)); if (!p) return fail(req, env, 'Unknown platform', 404);
    const packageCode = cleanText(b.package_code, 80), name = cleanText(b.name, 120), email = cleanEmail(b.email);
    if (!packageCode || !name || !validEmail(email)) return fail(req, env, 'Package, name and valid email are required');
    const pkg = await env.DB.prepare('SELECT code,name,amount_minor,currency FROM commerce_packages WHERE code=? AND platform_id=? AND active=1').bind(packageCode,p.id).first<any>();
    if (!pkg) return fail(req, env, 'Package not found', 404);
    const paymentId = id('pay');
    await env.DB.prepare(`INSERT INTO payment_intents(id,platform_id,package_code,payer_name,payer_email,amount_minor,currency,provider,status) VALUES(?,?,?,?,?,?,?,'payfast','pending')`).bind(paymentId,p.id,pkg.code,name,email,pkg.amount_minor,pkg.currency).run();
    await audit(env,p.id,'public','payment_intent.created','payment_intent',paymentId,{package_code:pkg.code});
    return json(req, env, { ok:true, payment_id:paymentId, amount_minor:pkg.amount_minor, currency:pkg.currency, checkout_url:`/api/commerce/payment-intents/${paymentId}/checkout` }, 201);
  }
  const checkoutMatch = url.pathname.match(/^\/api\/commerce\/payment-intents\/([^/]+)\/checkout$/);
  if (checkoutMatch && req.method === 'GET') {
    const paymentId = checkoutMatch[1], row = await env.DB.prepare(`SELECT pi.*,cp.name AS package_name FROM payment_intents pi LEFT JOIN commerce_packages cp ON cp.code=pi.package_code WHERE pi.id=?`).bind(paymentId).first<any>();
    if (!row) return fail(req, env, 'Payment not found', 404); if (row.status === 'paid') return fail(req, env, 'Payment already completed', 409);
    const cfg = payFastConfig(req, env); if (!cfg) return fail(req, env, 'PayFast merchant activation is not configured yet', 503);
    const checkout = buildPayFastCheckout(cfg,{ paymentId:row.id, amountZar:Number(row.amount_minor)/100, itemName:row.package_name || 'VIDEONOMY', email:row.payer_email, firstName:row.payer_name });
    await env.DB.prepare(`UPDATE payment_intents SET status='processing',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'`).bind(row.id).run();
    return json(req, env, { ok:true, ...checkout });
  }
  if (url.pathname === '/api/payfast/itn' && req.method === 'POST') {
    const cfg = payFastConfig(req, env); if (!cfg) return new Response('NOT CONFIGURED',{status:503});
    const raw = await req.text(), params = new URLSearchParams(raw), form: Record<string,string> = {}; for (const [k,v] of params) form[k]=v;
    const paymentId = cleanText(form.m_payment_id, 100); if (!paymentId) return new Response('BAD REQUEST',{status:400});
    const row = await env.DB.prepare('SELECT * FROM payment_intents WHERE id=?').bind(paymentId).first<any>(); if (!row) return new Response('NOT FOUND',{status:404});
    const sourceIp = req.headers.get('cf-connecting-ip') || '';
    const valid = await validatePayFastItn(cfg,{ form, expectedAmountZar:Number(row.amount_minor)/100, sourceIp });
    if (!valid.ok) { await audit(env,row.platform_id,'payfast','payment.itn_rejected','payment_intent',row.id,{reason:valid.reason}); return new Response('INVALID',{status:400}); }
    if (form.payment_status !== 'COMPLETE') { await env.DB.prepare(`UPDATE payment_intents SET status='failed',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status!='paid'`).bind(row.id).run(); return new Response('OK',{status:200}); }
    const providerRef = cleanText(form.pf_payment_id, 100) || null;
    await env.DB.prepare(`UPDATE payment_intents SET status='paid',provider_ref=COALESCE(provider_ref,?),paid_at=COALESCE(paid_at,CURRENT_TIMESTAMP),updated_at=CURRENT_TIMESTAMP WHERE id=? AND status!='paid'`).bind(providerRef,row.id).run();
    await env.DB.prepare(`INSERT INTO email_jobs(id,platform_id,template,recipient,payload_json,status) VALUES(?,?,?,?,?,'queued')`).bind(id('eml'),row.platform_id,'payment_receipt',row.payer_email,JSON.stringify({payment_id:row.id,amount_minor:row.amount_minor,currency:row.currency})).run();
    await audit(env,row.platform_id,'payfast','payment.paid','payment_intent',row.id,{provider_ref:providerRef});
    return new Response('OK',{status:200});
  }
  const statusMatch = url.pathname.match(/^\/api\/commerce\/payment-intents\/([^/]+)$/);
  if (statusMatch && req.method === 'GET') {
    const row = await env.DB.prepare('SELECT id,status,amount_minor,currency,package_code,paid_at FROM payment_intents WHERE id=?').bind(statusMatch[1]).first<any>();
    if (!row) return fail(req, env, 'Payment not found', 404); return json(req, env, {ok:true,payment:row});
  }
  if (url.pathname === '/api/data-requests' && req.method === 'POST') {
    const b=await body(req),p=await platform(env,cleanText(b.platform||'videonomy',60)); if(!p) return fail(req,env,'Unknown platform',404); const email=cleanEmail(b.email),type=cleanText(b.request_type,30);
    if(!validEmail(email)||!['access','correction','deletion','objection'].includes(type)) return fail(req,env,'Valid email and request type required'); const rid=id('dsr');
    await env.DB.prepare('INSERT INTO data_requests(id,platform_id,email,request_type) VALUES(?,?,?,?)').bind(rid,p.id,email,type).run(); await audit(env,p.id,'public','data_request.created','data_request',rid,{type}); return json(req,env,{ok:true,id:rid},201);
  }
  if (url.pathname === '/api/reports' && req.method === 'POST') {
    const b=await body(req),p=await platform(env,cleanText(b.platform||'videonomy',60)); if(!p) return fail(req,env,'Unknown platform',404); const reason=cleanText(b.reason,120),details=cleanText(b.details,2000),email=cleanEmail(b.email),videoId=cleanText(b.video_id,100)||null;
    if(!reason) return fail(req,env,'Reason required'); const rid=id('rpt'); await env.DB.prepare('INSERT INTO content_reports(id,platform_id,video_id,reporter_email,reason,details) VALUES(?,?,?,?,?,?)').bind(rid,p.id,videoId,email||null,reason,details||null).run(); await audit(env,p.id,'public','content_report.created','content_report',rid,{video_id:videoId}); return json(req,env,{ok:true,id:rid},201);
  }

  if (url.pathname === '/api/leads' && req.method === 'POST') {
    const b = await body(req);
    if (cleanText(b.website, 200)) return json(req, env, { ok: true }, 201); // honeypot: pretend success
    const p = await platform(env, cleanText(b.platform || 'videonomy', 60)); if (!p) return fail(req, env, 'Unknown platform', 404);
    const kind = cleanText(b.kind, 30); if (!LEAD_KINDS.includes(kind as any)) return fail(req, env, 'Invalid lead type');
    const name = cleanText(b.name, 120), email = cleanEmail(b.email), phone = cleanText(b.phone, 50), message = cleanText(b.message, 1500), offerCode = cleanText(b.offer_code, 60);
    if (!name || !validEmail(email)) return fail(req, env, 'Name and valid email are required');
    if (b.consent !== true || b.privacy_version !== PRIVACY_VERSION) return fail(req, env, 'Privacy consent is required');
    if (!await enforceLeadRate(req, env, email)) return fail(req, env, 'Too many submissions. Please try again tomorrow.', 429);
    const leadId = id('lead');
    await env.DB.prepare(`INSERT INTO leads(id,platform_id,kind,name,email,phone,message,offer_code,consent,privacy_version)
      VALUES(?,?,?,?,?,?,?,?,1,?)`).bind(leadId, p.id, kind, name, email, phone || null, message || null, offerCode || null, PRIVACY_VERSION).run();
    await audit(env, p.id, `lead:${await sha256(email)}`, 'lead.created', 'lead', leadId, { kind, offer_code: offerCode || null });
    return json(req, env, { ok: true, id: leadId }, 201);
  }

  if (url.pathname === '/api/admin/stats' && req.method === 'GET') {
    if (!isAdmin(req, env)) return fail(req, env, 'Forbidden', 403);
    const slug = url.searchParams.get('platform') || 'videonomy'; const p = await platform(env, slug); if (!p) return fail(req, env, 'Unknown platform', 404);
    const leads = await env.DB.prepare(`SELECT status,kind,COUNT(*) AS total FROM leads WHERE platform_id=? GROUP BY status,kind`).bind(p.id).all<any>();
    const creators = await env.DB.prepare(`SELECT COUNT(*) AS total FROM creators WHERE platform_id=? AND status='active'`).bind(p.id).first<any>();
    const videos = await env.DB.prepare(`SELECT COUNT(*) AS total FROM videos WHERE platform_id=? AND status='published'`).bind(p.id).first<any>();
    const qualified = await env.DB.prepare(`SELECT COUNT(*) AS total FROM watch_sessions WHERE platform_id=? AND qualified=1`).bind(p.id).first<any>();
    return json(req, env, { ok: true, leads: leads.results || [], active_creators: Number(creators?.total || 0), published_videos: Number(videos?.total || 0), qualified_views: Number(qualified?.total || 0) });
  }
  if (url.pathname === '/api/admin/leads' && req.method === 'GET') {
    if (!isAdmin(req, env)) return fail(req, env, 'Forbidden', 403);
    const { p, rows } = await adminLeadRows(env, url); if (!p) return fail(req, env, 'Unknown platform', 404);
    return json(req, env, { ok: true, leads: rows });
  }
  if (url.pathname === '/api/admin/leads.csv' && req.method === 'GET') {
    if (!isAdmin(req, env)) return fail(req, env, 'Forbidden', 403);
    const { p, rows } = await adminLeadRows(env, url); if (!p) return fail(req, env, 'Unknown platform', 404);
    const columns = ['id','kind','name','email','phone','offer_code','status','created_at','message','admin_notes'];
    const out = [columns.join(','), ...rows.map(r => columns.map(c => csvEscape(r[c])).join(','))].join('\n');
    return new Response(out, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="videonomy-leads.csv"', ...corsHeaders(req, env) } });
  }
  const leadStatusMatch = url.pathname.match(/^\/api\/admin\/leads\/([^/]+)\/status$/);
  if (leadStatusMatch && req.method === 'POST') {
    if (!isAdmin(req, env)) return fail(req, env, 'Forbidden', 403);
    const b = await body(req), status = cleanText(b.status, 30), notes = cleanText(b.notes, 1500);
    if (!LEAD_STATUSES.includes(status as any)) return fail(req, env, 'Invalid status');
    const lead = await env.DB.prepare('SELECT id,platform_id FROM leads WHERE id=?').bind(leadStatusMatch[1]).first<any>(); if (!lead) return fail(req, env, 'Lead not found', 404);
    await env.DB.prepare('UPDATE leads SET status=?,admin_notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(status, notes || null, lead.id).run();
    await audit(env, lead.platform_id, 'admin', 'lead.status_changed', 'lead', lead.id, { status });
    return json(req, env, { ok: true, id: lead.id, status });
  }
  if (url.pathname === '/api/admin/invites' && req.method === 'POST') {
    if (!isAdmin(req, env)) return fail(req, env, 'Forbidden', 403);
    const b = await body(req); const p = await platform(env, cleanText(b.platform || 'videonomy', 60)); if (!p) return fail(req, env, 'Unknown platform', 404);
    const invite = await randomToken(18), inviteId = id('inv'), email = cleanEmail(b.email);
    await env.DB.prepare('INSERT INTO creator_invites(id,platform_id,code_hash,email,expires_at) VALUES(?,?,?,?,?)')
      .bind(inviteId, p.id, await sha256(invite), email || null, futureIso(INVITE_HOURS)).run();
    await audit(env, p.id, 'admin', 'invite.created', 'creator_invite', inviteId, { email_hash: email ? await sha256(email) : null });
    return json(req, env, { ok: true, invite, redeem_url: `${new URL(req.url).origin}/creator/?invite=${encodeURIComponent(invite)}`, expires_in_hours: INVITE_HOURS }, 201);
  }

  if (url.pathname === '/api/invites/redeem' && req.method === 'POST') {
    const b = await body(req), code = cleanText(b.code, 200), email = cleanEmail(b.email), displayName = cleanText(b.display_name, 100), handle = cleanText(b.handle, 50).toLowerCase().replace(/[^a-z0-9_-]/g,'');
    if (!code || !validEmail(email) || !displayName || handle.length < 3) return fail(req, env, 'Invite, email, display name and handle are required');
    if (b.accept_terms !== true || b.terms_version !== TERMS_VERSION) return fail(req, env, 'Creator terms must be accepted');
    const inv = await env.DB.prepare(`SELECT * FROM creator_invites WHERE code_hash=? AND redeemed_at IS NULL AND expires_at > CURRENT_TIMESTAMP`).bind(await sha256(code)).first<any>();
    if (!inv) return fail(req, env, 'Invite invalid or expired', 403); if (inv.email && inv.email !== email) return fail(req, env, 'Invite is for another email', 403);
    const existing = await env.DB.prepare('SELECT id FROM creators WHERE platform_id=? AND (email=? OR handle=?)').bind(inv.platform_id,email,handle).first<any>();
    if (existing) return fail(req, env, 'Email or handle already registered', 409);
    const creatorId = id('crt'), sessionId = id('ses'), token = await randomToken(32);
    await env.DB.batch([
      env.DB.prepare('INSERT INTO creators(id,platform_id,email,display_name,handle,terms_version,terms_accepted_at) VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP)').bind(creatorId,inv.platform_id,email,displayName,handle,TERMS_VERSION),
      env.DB.prepare('INSERT INTO sessions(id,creator_id,token_hash,expires_at) VALUES(?,?,?,?)').bind(sessionId,creatorId,await sha256(token),futureIso(SESSION_DAYS*24)),
      env.DB.prepare('UPDATE creator_invites SET redeemed_at=CURRENT_TIMESTAMP WHERE id=?').bind(inv.id),
    ]);
    await audit(env, inv.platform_id, `creator:${creatorId}`, 'creator.created', 'creator', creatorId);
    return json(req, env, { ok:true, creator:{id:creatorId,email,display_name:displayName,handle}, expires_in_days:SESSION_DAYS }, 201, { 'set-cookie': sessionCookie('vz_creator', token, SESSION_DAYS) });
  }
  if (url.pathname === '/api/logout' && req.method === 'POST') {
    const token = cookie(req, 'vz_creator'); if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256(token)).run();
    return json(req, env, { ok: true }, 200, { 'set-cookie': clearCookie('vz_creator') });
  }
  if (url.pathname === '/api/me' && req.method === 'GET') {
    const c = await creatorFromRequest(req,env); if(!c) return fail(req, env, 'Unauthorized',401); return json(req, env, {ok:true,creator:c});
  }
  if (url.pathname === '/api/me/videos' && req.method === 'GET') {
    const c = await creatorFromRequest(req,env); if(!c) return fail(req, env, 'Unauthorized',401);
    const rows = await env.DB.prepare(`SELECT id,title,description,status,visibility,bytes,published_at,created_at FROM videos WHERE creator_id=? ORDER BY created_at DESC LIMIT 100`).bind(c.id).all<any>();
    return json(req, env, { ok:true, videos: rows.results || [] });
  }

  if (url.pathname === '/api/videos' && req.method === 'GET') {
    const slug=url.searchParams.get('platform')||'videonomy'; const p=await platform(env,slug); if(!p) return fail(req, env, 'Unknown platform',404);
    const rows=await env.DB.prepare(`SELECT v.id,v.title,v.description,v.mime_type,v.bytes,v.published_at,c.display_name,c.handle,
      COALESCE((SELECT COUNT(*) FROM watch_sessions w WHERE w.video_id=v.id AND w.qualified=1),0) AS qualified_views
      FROM videos v JOIN creators c ON c.id=v.creator_id WHERE v.platform_id=? AND v.status='published' AND v.visibility='public'
      ORDER BY v.published_at DESC LIMIT 50`).bind(p.id).all<any>();
    const origin = new URL(req.url).origin;
    const videos = (rows.results || []).map(v => ({ ...v, media_url: `${origin}/media/${v.id}` }));
    return json(req, env, {ok:true,videos});
  }
  if (url.pathname === '/api/videos' && req.method === 'POST') {
    const c=await creatorFromRequest(req,env); if(!c) return fail(req, env, 'Unauthorized',401); const b=await body(req); const title=cleanText(b.title,180),description=cleanText(b.description,4000); if(!title) return fail(req, env, 'Title required');
    const videoId=id('vid'); await env.DB.prepare('INSERT INTO videos(id,platform_id,creator_id,title,description,status) VALUES(?,?,?,?,?,\'uploading\')').bind(videoId,c.platform_id,c.id,title,description||null).run();
    return json(req, env, {ok:true,video_id:videoId,upload_url:`/api/videos/${videoId}/media`,max_upload_mb:90},201);
  }
  const mediaMatch=url.pathname.match(/^\/api\/videos\/([^/]+)\/media$/);
  if(mediaMatch && req.method==='PUT'){
    const c=await creatorFromRequest(req,env); if(!c) return fail(req, env, 'Unauthorized',401); const videoId=mediaMatch[1];
    const v=await env.DB.prepare('SELECT * FROM videos WHERE id=? AND creator_id=?').bind(videoId,c.id).first<any>(); if(!v) return fail(req, env, 'Video not found',404);
    const len=Number(req.headers.get('content-length') || req.headers.get('x-upload-bytes') || 0); if(!len || len>MAX_UPLOAD_BYTES) return fail(req, env, 'MP4 upload size must be known and be 90 MB or smaller',413);
    const usage=await env.DB.prepare(`SELECT COALESCE(SUM(bytes),0) AS total FROM videos WHERE status='published'`).first<any>();
    if(Number(usage?.total||0)+len>MEDIA_HARD_CAP_BYTES) return fail(req, env, 'Bootstrap media capacity is full. New uploads are paused until capacity is upgraded.',507);
    const type=(req.headers.get('content-type')||'').split(';')[0].trim().toLowerCase(); if(type!=='video/mp4') return fail(req, env, 'Launch beta accepts video/mp4 only',415);
    const key=`${c.platform_id}/${c.id}/${videoId}.mp4`; await env.MEDIA.put(key,req.body,{httpMetadata:{contentType:'video/mp4',cacheControl:'public, max-age=3600'}});
    await env.DB.prepare(`UPDATE videos SET media_key=?,mime_type='video/mp4',bytes=?,status='published',published_at=CURRENT_TIMESTAMP WHERE id=? AND creator_id=?`).bind(key,len,videoId,c.id).run();
    await audit(env,c.platform_id,`creator:${c.id}`,'video.published','video',videoId,{bytes:len}); return json(req, env, {ok:true,video_id:videoId,status:'published'});
  }
  const streamMatch=url.pathname.match(/^\/media\/([^/]+)$/);
  if(streamMatch && req.method==='GET'){
    const videoId=streamMatch[1]; const v=await env.DB.prepare(`SELECT media_key,mime_type FROM videos WHERE id=? AND status='published' AND visibility='public'`).bind(videoId).first<any>(); if(!v?.media_key) return fail(req, env, 'Not found',404);
    const obj=await env.MEDIA.get(v.media_key,{onlyIf:req.headers,range:req.headers}); if(!obj) return fail(req, env, 'Not found',404);
    const h=new Headers(corsHeaders(req,env)); obj.writeHttpMetadata(h); if(obj.httpEtag) h.set('etag',obj.httpEtag); h.set('accept-ranges','bytes'); h.set('cache-control','public, max-age=3600');
    let status = obj.body ? 200 : 412;
    if (obj.body && req.headers.get('range') && obj.range && typeof obj.range.offset === 'number' && typeof obj.range.length === 'number') {
      status = 206; const end = obj.range.offset + obj.range.length - 1; h.set('content-range',`bytes ${obj.range.offset}-${end}/${obj.size}`); h.set('content-length',String(obj.range.length));
    }
    return new Response(obj.body || null,{status,headers:h});
  }

  if(url.pathname==='/api/viewer/session' && req.method==='POST'){
    const b=await body(req).catch(()=>({})); const p=await platform(env,cleanText(b.platform||'videonomy',60)); if(!p) return fail(req, env, 'Unknown platform',404);
    const ensured = await ensureViewer(req, env, p);
    const headers: HeadersInit = ensured.cookieHeader ? { 'set-cookie': ensured.cookieHeader } : {};
    return json(req, env, {ok:true},200,headers);
  }
  if(url.pathname==='/api/views/heartbeat' && req.method==='POST'){
    const b=await body(req); const videoId=cleanText(b.video_id,100), clientIncrement=Math.max(1,Math.min(MAX_HEARTBEAT_INCREMENT,Number(b.seconds)||0)); if(!videoId) return fail(req, env, 'video_id required');
    const viewer=await viewerFromRequest(req,env); if(!viewer) return fail(req, env, 'Viewer session required',401);
    const v=await env.DB.prepare(`SELECT id,platform_id FROM videos WHERE id=? AND status='published'`).bind(videoId).first<any>(); if(!v||v.platform_id!==viewer.platform_id) return fail(req, env, 'Video not found',404);
    const existing=await env.DB.prepare('SELECT id,watched_seconds,qualified,last_heartbeat_at FROM watch_sessions WHERE video_id=? AND viewer_session_id=?').bind(videoId,viewer.id).first<any>();
    let watched=0,qualified=0;
    if(existing){
      const elapsed = Math.max(0, Math.floor((Date.now() - new Date(existing.last_heartbeat_at).getTime()) / 1000));
      const allowedIncrement = Math.max(0, Math.min(clientIncrement, MAX_HEARTBEAT_INCREMENT, elapsed + 2));
      watched=Math.min(Number(existing.watched_seconds)+allowedIncrement,86400); qualified=watched>=QUALIFIED_SECONDS?1:0;
      await env.DB.prepare('UPDATE watch_sessions SET watched_seconds=?,qualified=?,last_heartbeat_at=CURRENT_TIMESTAMP WHERE id=?').bind(watched,qualified,existing.id).run();
    } else {
      await env.DB.prepare('INSERT INTO watch_sessions(id,platform_id,video_id,viewer_session_id,watched_seconds,qualified) VALUES(?,?,?,?,0,0)').bind(id('wat'),viewer.platform_id,videoId,viewer.id).run();
    }
    return json(req, env, {ok:true,watched_seconds:watched,qualified:Boolean(qualified)});
  }
  return fail(req, env, 'API route not found',404);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url=new URL(req.url);
    try {
      if (url.pathname === '/payment/success' || url.pathname === '/payment/cancel') {
        const success = url.pathname.endsWith('/success');
        const id = (url.searchParams.get('id') || '').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,100);
        return new Response(`<!doctype html><meta name="viewport" content="width=device-width"><title>VIDEONOMY payment</title><body style="font-family:system-ui;background:#071019;color:#fff;padding:8vw"><h1>${success?'Payment submitted':'Payment cancelled'}</h1><p>${success?'We are confirming the payment securely with PayFast.':'No payment was recorded. You can return and try again.'}</p><p><a style="color:#7cf7c9" href="/">Return to VIDEONOMY</a></p><small>Reference: ${id}</small></body>`,{headers:{'content-type':'text/html; charset=utf-8'}});
      }
      if(url.pathname.startsWith('/api/') || url.pathname.startsWith('/media/')) return await handleApi(req,env,url);
      return env.ASSETS.fetch(req);
    } catch (err:any) {
      console.error(err); return fail(req,env,(env.APP_ENV||'production')==='production'?'Request failed':String(err?.message||err),500);
    }
  }
};
