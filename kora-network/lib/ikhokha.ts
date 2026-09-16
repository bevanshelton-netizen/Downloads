import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

const IKHOKHA_PAYMENT_ENDPOINT = 'https://api.ikhokha.com/public-api/v1/api/payment';

type PaymentKind = 'purchase' | 'ticket';

type CreatePaymentLinkResponse = {
  responseCode?: string;
  message?: string;
  paylinkUrl?: string;
  paylinkID?: string;
  externalTransactionID?: string;
};

function credentials() {
  const appId = process.env.IKHOKHA_APP_ID?.trim();
  const appSecret = process.env.IKHOKHA_APP_SECRET?.trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '');

  if (!appId || !appSecret || !appUrl) {
    throw new Error('iKhokha checkout is not configured');
  }

  const parsedAppUrl = new URL(appUrl);
  if (parsedAppUrl.protocol !== 'https:' || parsedAppUrl.username || parsedAppUrl.password) {
    throw new Error('KORA public URL must use HTTPS for iKhokha');
  }

  return { appId, appSecret, appUrl: parsedAppUrl.origin };
}

function escapeForIkhokhaSignature(value: string) {
  return value.replace(/[\\\"']/g, '\\$&').replace(/\u0000/g, '\\0');
}

function signatureFor(path: string, body: string, secret: string) {
  const payload = escapeForIkhokhaSignature(path + body);
  return createHmac('sha256', secret.trim()).update(payload).digest('hex');
}

export function useIkhokha() {
  return Boolean(process.env.IKHOKHA_APP_ID?.trim() && process.env.IKHOKHA_APP_SECRET?.trim());
}

export async function createIkhokhaPaymentLink(input: {
  orderId: string;
  amount: number;
  description: string;
  kind: PaymentKind;
  successPath: string;
  failurePath: string;
  cancelPath: string;
}) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('Invalid payment amount');
  }

  const { appId, appSecret, appUrl } = credentials();
  const endpoint = new URL(IKHOKHA_PAYMENT_ENDPOINT);
  const callback = new URL('/api/ikhokha/webhook', appUrl);
  callback.searchParams.set('kind', input.kind);
  callback.searchParams.set('order', input.orderId);

  const success = new URL(input.successPath, appUrl);
  const failure = new URL(input.failurePath, appUrl);
  const cancel = new URL(input.cancelPath, appUrl);

  for (const url of [success, failure, cancel]) {
    if (url.origin !== appUrl) throw new Error('Unsafe iKhokha return URL');
  }

  const request = {
    entityID: appId,
    amount: Math.round(input.amount * 100),
    currency: 'ZAR',
    requesterUrl: appUrl,
    description: input.description.slice(0, 180),
    paymentReference: input.orderId,
    mode: 'live',
    externalTransactionID: input.orderId,
    urls: {
      callbackUrl: callback.toString(),
      successPageUrl: success.toString(),
      failurePageUrl: failure.toString(),
      cancelUrl: cancel.toString(),
    },
  };

  const body = JSON.stringify(request);
  const signature = signatureFor(endpoint.pathname, body, appSecret);
  const response = await fetch(endpoint, {
    method: 'POST',
    cache: 'no-store',
    redirect: 'error',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'IK-APPID': appId,
      'IK-SIGN': signature,
    },
    body,
  });

  const payload = await response.json().catch(() => null) as CreatePaymentLinkResponse | null;
  if (!response.ok || payload?.responseCode !== '00' || !payload.paylinkUrl || !payload.paylinkID) {
    throw new Error(payload?.message || `iKhokha checkout failed (${response.status})`);
  }

  const paylink = new URL(payload.paylinkUrl);
  if (paylink.protocol !== 'https:') throw new Error('Unsafe iKhokha payment URL');

  return {
    redirectUrl: paylink.toString(),
    paylinkId: payload.paylinkID,
    externalTransactionId: payload.externalTransactionID || input.orderId,
  };
}

export function verifyIkhokhaWebhook(input: {
  requestUrl: string;
  rawBody: string;
  appIdHeader: string | null;
  signatureHeader: string | null;
}) {
  const { appId, appSecret } = credentials();
  if (!input.appIdHeader || input.appIdHeader.trim() !== appId) return false;
  if (!input.signatureHeader) return false;

  const url = new URL(input.requestUrl);
  const expected = signatureFor(url.pathname + url.search, input.rawBody, appSecret);
  const received = input.signatureHeader.trim().toLowerCase();

  if (!/^[0-9a-f]{64}$/.test(received) || expected.length !== received.length) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'));
}
