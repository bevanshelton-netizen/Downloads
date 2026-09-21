import 'server-only';
import crypto from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

export const partnerContentTypes = new Set(['programme','film','series','episode','channel','event','sport','other']);

export function normaliseCountry(value: string | null | undefined) {
  const country = String(value || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(country) ? country : 'ZZ';
}

export function safeHttpsUrl(value: unknown) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    if (['localhost','127.0.0.1','0.0.0.0'].includes(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

export function isDirectMediaUrl(url: URL) {
  return /\.(m3u8|mpd)(?:$|\?)/i.test(url.pathname + url.search);
}

export function hashPartnerKey(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export async function getPartnerAccess(assetId: string, countryCode?: string | null) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('partner_asset_access', {
    p_asset_id: assetId,
    p_country_code: normaliseCountry(countryCode),
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    action: String(row?.access_action || 'blocked'),
    reason: String(row?.reason || 'unknown'),
  };
}

export async function isStaffUser(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle();
  return Boolean(data && ['moderator','admin'].includes(String(data.role)));
}
