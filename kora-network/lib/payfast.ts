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

function checkoutConfig(requirePassphrase = false) {
  const merchantId = process.env.PAYFAST_MERCHANT_ID;
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
  const passphrase = process.env.PAYFAST_PASSPHRASE;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!merchantId || !merchantKey || !appUrl || (requirePassphrase && !passphrase)) {
    throw new Error('Missing PayFast checkout configuration');
  }
  return { merchantId, merchantKey, passphrase, appUrl: appUrl.replace(/\/$/, '') };
}

function actionUrl() {
  return process.env.PAYFAST_SANDBOX === 'false'
    ? 'https://www.payfast.co.za/eng/process'
    : 'https://sandbox.payfast.co.za/eng/process';
}

export function buildCheckout(input: { orderId: string; email: string; planCode: PlanCode }) {
  const { merchantId, merchantKey, passphrase, appUrl } = checkoutConfig(true);
  const plan = plans[input.planCode];

  // Field insertion order follows PayFast Custom Integration ordering. Subscriptions
  // require subscription_type, frequency and cycles as well as a passphrase.
  const fields: Record<string, string> = {
    merchant_id: merchantId,
    merchant_key: merchantKey,
    return_url: `${appUrl}/account?payment=success`,
    cancel_url: `${appUrl}/account?payment=cancelled`,
    notify_url: `${appUrl}/api/payfast/notify`,
    email_address: input.email,
    m_payment_id: input.orderId,
    amount: plan.amount,
    item_name: plan.name,
    custom_str1: input.planCode,
    custom_str2: 'subscription',
    subscription_type: '1',
    recurring_amount: plan.amount,
    frequency: plan.frequency,
    cycles: plan.cycles,
  };
  fields.signature = payFastSignature(fields, passphrase);

  return { action: actionUrl(), fields };
}

export function buildPurchaseCheckout(input: {
  orderId: string;
  email: string;
  title: string;
  amount: number;
}) {
  const { merchantId, merchantKey, passphrase, appUrl } = checkoutConfig();
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('Invalid purchase amount');

  const fields: Record<string, string> = {
    merchant_id: merchantId,
    merchant_key: merchantKey,
    return_url: `${appUrl}/account?purchase=success`,
    cancel_url: `${appUrl}/account?purchase=cancelled`,
    notify_url: `${appUrl}/api/payfast/notify`,
    email_address: input.email,
    m_payment_id: input.orderId,
    amount: input.amount.toFixed(2),
    item_name: input.title.slice(0, 100),
    custom_str2: 'purchase',
  };
  fields.signature = payFastSignature(fields, passphrase);

  return { action: actionUrl(), fields };
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
