export type PayFastMode = 'sandbox' | 'live';

export interface PayFastConfig {
  merchantId: string;
  merchantKey: string;
  passphrase?: string;
  mode: PayFastMode;
  baseUrl: string;
  allowedCidrs?: string;
}

export interface CheckoutInput {
  paymentId: string;
  amountZar: number;
  itemName: string;
  itemDescription?: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

const DEFAULT_ITN_CIDRS = [
  '197.97.145.144/28',
  '41.74.179.192/27',
  '102.216.36.0/28',
  '102.216.36.128/28',
  '144.126.193.139/32',
];

function rotl(x: number, c: number) { return ((x << c) | (x >>> (32 - c))) >>> 0; }
function add32(a: number, b: number) { return (a + b) >>> 0; }

// PayFast requires MD5. The signed parameter string is URL-encoded ASCII, so this
// implementation deliberately accepts ASCII only and rejects ambiguous input.
export function md5Ascii(input: string): string {
  for (let i = 0; i < input.length; i++) if (input.charCodeAt(i) > 0x7f) throw new Error('md5Ascii expects ASCII input');
  const bytes = Array.from(input, c => c.charCodeAt(0));
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) bytes.push(0);
  const lo = bitLen >>> 0;
  const hi = Math.floor(bitLen / 0x100000000) >>> 0;
  for (let i = 0; i < 4; i++) bytes.push((lo >>> (8 * i)) & 0xff);
  for (let i = 0; i < 4; i++) bytes.push((hi >>> (8 * i)) & 0xff);

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  const s = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
  const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0);
  for (let off = 0; off < bytes.length; off += 64) {
    const M = new Array<number>(16).fill(0);
    for (let i = 0; i < 64; i++) M[i >>> 2] |= bytes[off + i] << (8 * (i % 4));
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F: number, g: number;
      if (i < 16) { F = (B & C) | ((~B) & D); g = i; }
      else if (i < 32) { F = (D & B) | ((~D) & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | (~D)); g = (7 * i) % 16; }
      F = add32(add32(add32(F >>> 0, A), K[i]), M[g] >>> 0);
      A = D; D = C; C = B; B = add32(B, rotl(F, s[i]));
    }
    a0 = add32(a0, A); b0 = add32(b0, B); c0 = add32(c0, C); d0 = add32(d0, D);
  }
  const hex32 = (n: number) => [0,8,16,24].map(s => ((n >>> s) & 0xff).toString(16).padStart(2,'0')).join('');
  return hex32(a0) + hex32(b0) + hex32(c0) + hex32(d0);
}

export function pfUrlencode(value: string): string {
  return encodeURIComponent(value.trim())
    .replace(/[!'()*~]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%20/g, '+');
}

export function payFastParamString(entries: Record<string, string | number | undefined | null>, passphrase?: string): string {
  const pairs: string[] = [];
  for (const [key, raw] of Object.entries(entries)) {
    if (key === 'signature' || raw === undefined || raw === null || String(raw) === '') continue;
    pairs.push(`${key}=${pfUrlencode(String(raw))}`);
  }
  if (passphrase) pairs.push(`passphrase=${pfUrlencode(passphrase)}`);
  return pairs.join('&');
}

export function signPayFast(entries: Record<string, string | number | undefined | null>, passphrase?: string): string {
  return md5Ascii(payFastParamString(entries, passphrase));
}

export function buildPayFastCheckout(cfg: PayFastConfig, input: CheckoutInput) {
  if (!Number.isFinite(input.amountZar) || input.amountZar < 5) throw new Error('PayFast amount must be at least ZAR 5.00');
  const origin = cfg.baseUrl.replace(/\/$/, '');
  const fields: Record<string, string> = {
    merchant_id: cfg.merchantId,
    merchant_key: cfg.merchantKey,
    return_url: `${origin}/payment/success?id=${encodeURIComponent(input.paymentId)}`,
    cancel_url: `${origin}/payment/cancel?id=${encodeURIComponent(input.paymentId)}`,
    notify_url: `${origin}/api/payfast/itn`,
    m_payment_id: input.paymentId,
    amount: input.amountZar.toFixed(2),
    item_name: input.itemName.slice(0, 100),
    item_description: (input.itemDescription || input.itemName).slice(0, 255),
    email_address: input.email.slice(0, 100),
  };
  if (input.firstName) fields.name_first = input.firstName.slice(0, 100);
  if (input.lastName) fields.name_last = input.lastName.slice(0, 100);
  fields.signature = signPayFast(fields, cfg.passphrase);
  return {
    action: cfg.mode === 'sandbox' ? 'https://sandbox.payfast.co.za/eng/process' : 'https://www.payfast.co.za/eng/process',
    fields,
  };
}

function ipv4ToInt(ip: string): number | null {
  const p = ip.split('.'); if (p.length !== 4) return null;
  const n = p.map(x => Number(x)); if (n.some(x => !Number.isInteger(x) || x < 0 || x > 255)) return null;
  return (((n[0] << 24) >>> 0) + (n[1] << 16) + (n[2] << 8) + n[3]) >>> 0;
}
export function ipInCidr(ip: string, cidr: string): boolean {
  const [base, bitsRaw = '32'] = cidr.split('/'); const bits = Number(bitsRaw);
  const a = ipv4ToInt(ip), b = ipv4ToInt(base); if (a === null || b === null || bits < 0 || bits > 32) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (a & mask) === (b & mask);
}
export function validPayFastSourceIp(ip: string, overrideCidrs?: string): boolean {
  const cidrs = (overrideCidrs ? overrideCidrs.split(',').map(x => x.trim()).filter(Boolean) : DEFAULT_ITN_CIDRS);
  return cidrs.some(c => ipInCidr(ip, c));
}

export interface ItnValidationInput {
  form: Record<string, string>;
  expectedAmountZar: number;
  sourceIp: string;
}
export async function validatePayFastItn(cfg: PayFastConfig, input: ItnValidationInput): Promise<{ ok: boolean; reason?: string }> {
  const signature = input.form.signature || '';
  if (!signature || signature !== signPayFast(input.form, cfg.passphrase)) return { ok: false, reason: 'invalid_signature' };
  if (!validPayFastSourceIp(input.sourceIp, cfg.allowedCidrs)) return { ok: false, reason: 'invalid_source_ip' };
  const amountGross = Number(input.form.amount_gross || 'NaN');
  if (!Number.isFinite(amountGross) || Math.abs(amountGross - input.expectedAmountZar) > 0.001) return { ok: false, reason: 'amount_mismatch' };
  const validateUrl = cfg.mode === 'sandbox' ? 'https://sandbox.payfast.co.za/eng/query/validate' : 'https://www.payfast.co.za/eng/query/validate';
  const paramString = payFastParamString(input.form);
  const res = await fetch(validateUrl, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: paramString });
  const text = (await res.text()).trim();
  if (!res.ok || text !== 'VALID') return { ok: false, reason: 'payfast_validation_failed' };
  return { ok: true };
}
