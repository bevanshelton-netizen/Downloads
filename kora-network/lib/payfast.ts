import 'server-only';
import { createHash } from 'node:crypto';

export const plans = {
  viewer_monthly: { name: 'KORA Premium Monthly', amount: '79.00', frequency: '3', cycles: '0' },
  viewer_plus: { name: 'KORA Premium Plus', amount: '129.00', frequency: '3', cycles: '0' },
} as const;

export type PlanCode = keyof typeof plans;

function encode(value: string) {
  return encodeURIComponent(value.trim()).replace(/%20/g, '+');
}

export function payFastSignature(fields: Record<string, string>, passphrase?: string) {
  const pairs = Object.entries(fields)
    .filter(([, value]) => value !== '')
    .map(([key, value]) => `${key}=${encode(value)}`);
  if (passphrase) pairs.push(`passphrase=${encode(passphrase)}`);
  return createHash('md5').update(pairs.join('&')).digest('hex');
}

function config(requirePassphrase = false) {
  const merchantId = process.env.PAYFAST_MERCHANT_ID;
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
  const passphrase = process.env.PAYFAST_PASSPHRASE;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (!merchantId || !merchantKey || !appUrl || (requirePassphrase && !passphrase)) {
    throw new Error('Missing PayFast checkout configuration');
  }
  return { merchantId, merchantKey, passphrase, appUrl };
}

function baseCheckoutFields(input: { orderId: string; email: string; returnUrl: string; cancelUrl: string }) {
  const { merchantId, merchantKey, appUrl } = config();
  return {
    merchant_id: merchantId,
    merchant_key: merchantKey,
    return_url: `${appUrl}${input.returnUrl}`,
    cancel_url: `${appUrl}${input.cancelUrl}`,
    notify_url: `${appUrl}/api/payfast/notify`,
    email_address: input.email,
    m_payment_id: input.orderId,
  } as Record<string, string>;
}

function checkoutResponse(fields: Record<string, string>, requirePassphrase = false) {
  const { passphrase } = config(requirePassphrase);
  fields.signature = payFastSignature(fields, passphrase);
  return {
    action: process.env.PAYFAST_SANDBOX === 'false'
      ? 'https://www.payfast.co.za/eng/process'
      : 'https://sandbox.payfast.co.za/eng/process',
    fields,
  };
}

export function buildCheckout(input: { orderId: string; email: string; planCode: PlanCode }) {
  const plan = plans[input.planCode];
  const fields = baseCheckoutFields({
    orderId: input.orderId,
    email: input.email,
    returnUrl: '/account?payment=success',
    cancelUrl: '/account?payment=cancelled',
  });
  Object.assign(fields, {
    amount: plan.amount,
    item_name: plan.name,
    custom_str1: input.planCode,
    custom_str2: 'subscription',
    subscription_type: '1',
    recurring_amount: plan.amount,
    frequency: plan.frequency,
    cycles: plan.cycles,
  });
  return checkoutResponse(fields, true);
}

export function buildPurchaseCheckout(input: {
  orderId: string;
  email: string;
  productionId: string;
  slug: string;
  title: string;
  amount: number;
}) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('Invalid purchase amount');
  const safeSlug = encodeURIComponent(input.slug);
  const fields = baseCheckoutFields({
    orderId: input.orderId,
    email: input.email,
    returnUrl: `/watch/${safeSlug}?payment=success`,
    cancelUrl: `/watch/${safeSlug}?payment=cancelled`,
  });
  Object.assign(fields, {
    amount: input.amount.toFixed(2),
    item_name: `KORA: ${input.title}`.slice(0, 100),
    custom_str1: input.productionId,
    custom_str2: 'purchase',
  });
  return checkoutResponse(fields);
}

export async function validateItn(fields: Record<string, string>) {
  const receivedSignature = fields.signature;
  const unsigned = { ...fields };
  delete unsigned.signature;
  if (!receivedSignature || payFastSignature(unsigned, process.env.PAYFAST_PASSPHRASE) !== receivedSignature) return false;
  if (fields.merchant_id !== process.env.PAYFAST_MERCHANT_ID) return false;

  const body = Object.entries(fields).map(([k, v]) => `${k}=${encode(v)}`).join('&');
  const validateUrl = process.env.PAYFAST_SANDBOX === 'false'
    ? 'https://www.payfast.co.za/eng/query/validate'
    : 'https://sandbox.payfast.co.za/eng/query/validate';
  const response = await fetch(validateUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });
  return (await response.text()).trim() === 'VALID';
}

function payFastApiSignature(fields: Record<string, string>, passphrase: string) {
  const values = { ...fields, passphrase };
  const payload = Object.entries(values)
    .filter(([, value]) => value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${encode(value)}`)
    .join('&');
  return createHash('md5').update(payload).digest('hex');
}

export async function cancelPayFastSubscription(token: string) {
  const { merchantId, passphrase } = config(true);
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00');
  const headersToSign = {
    'merchant-id': merchantId,
    timestamp,
    version: 'v1',
  };
  const signature = payFastApiSignature(headersToSign, passphrase!);
  const testing = process.env.PAYFAST_SANDBOX === 'false' ? '' : '?testing=true';
  const response = await fetch(`https://api.payfast.co.za/subscriptions/${encodeURIComponent(token)}/cancel${testing}`, {
    method: 'PUT',
    headers: {
      ...headersToSign,
      signature,
    },
    cache: 'no-store',
  });

  if (!response.ok) throw new Error('PayFast could not cancel the subscription');
  const payload = await response.json().catch(() => null) as { status?: string } | null;
  if (payload?.status && payload.status !== 'success') throw new Error('PayFast rejected the cancellation');
  return true;
}
