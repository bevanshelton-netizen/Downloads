export interface IKhokhaConfig {
  appId: string;
  appSecret: string;
  baseUrl: string;
  mode?: 'live' | 'test';
}

export interface IKhokhaPaymentInput {
  paymentId: string;
  amountMinor: number;
  currency: 'ZAR';
  description: string;
  externalEntityId?: string;
}

const ENDPOINT = 'https://api.ikhokha.com/public-api/v1/api/payment';
const ENDPOINT_PATH = '/public-api/v1/api/payment';

function escapeForIKhokha(value: string): string {
  return value.replace(/[\\"']/g, '\\$&').replace(/\u0000/g, '\\0');
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret.trim()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function signIKhokha(path: string, body: string, appSecret: string): Promise<string> {
  return hmacSha256Hex(appSecret, escapeForIKhokha(path + body));
}

export async function createIKhokhaPaymentLink(cfg: IKhokhaConfig, input: IKhokhaPaymentInput) {
  if (!Number.isInteger(input.amountMinor) || input.amountMinor < 1000) {
    throw new Error('iKhokha amount must be at least ZAR 10.00');
  }
  const origin = cfg.baseUrl.replace(/\/$/, '');
  const payload = {
    entityID: cfg.appId,
    externalEntityID: input.externalEntityId || 'videonomy',
    amount: input.amountMinor,
    currency: input.currency,
    requesterUrl: origin,
    mode: cfg.mode === 'test' ? 'test' : 'live',
    description: input.description.slice(0, 180),
    paymentReference: input.paymentId,
    externalTransactionID: input.paymentId,
    urls: {
      callbackUrl: `${origin}/api/ikhokha/webhook`,
      successPageUrl: `${origin}/payment/success?id=${encodeURIComponent(input.paymentId)}`,
      failurePageUrl: `${origin}/payment/failure?id=${encodeURIComponent(input.paymentId)}`,
      cancelUrl: `${origin}/payment/cancel?id=${encodeURIComponent(input.paymentId)}`,
    },
  };
  const rawBody = JSON.stringify(payload);
  const signature = await signIKhokha(ENDPOINT_PATH, rawBody, cfg.appSecret);
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      'IK-APPID': cfg.appId.trim(),
      'IK-SIGN': signature,
    },
    body: rawBody,
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || data?.responseCode !== '00' || !data?.paylinkUrl || !data?.paylinkID) {
    throw new Error(`iKhokha payment link failed: ${data?.message || res.status}`);
  }
  return {
    checkoutUrl: String(data.paylinkUrl),
    providerRef: String(data.paylinkID),
    externalTransactionId: String(data.externalTransactionID || input.paymentId),
  };
}

export async function verifyIKhokhaWebhook(
  cfg: IKhokhaConfig,
  callbackPath: string,
  rawBody: string,
  appIdHeader: string,
  signatureHeader: string,
): Promise<boolean> {
  if (!appIdHeader || appIdHeader.trim() !== cfg.appId.trim() || !signatureHeader) return false;
  const expected = await signIKhokha(callbackPath, rawBody, cfg.appSecret);
  const a = expected.toLowerCase();
  const b = signatureHeader.trim().toLowerCase();
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
