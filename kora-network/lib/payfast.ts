import 'server-only';
import { createHash } from 'node:crypto';

export const plans = {
  viewer_monthly: { name: 'KORA Premium Monthly', amount: '79.00' },
  viewer_plus: { name: 'KORA Premium Plus', amount: '129.00' },
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

export function buildCheckout(input: { orderId: string; email: string; planCode: PlanCode }) {
  const merchantId = process.env.PAYFAST_MERCHANT_ID;
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!merchantId || !merchantKey || !appUrl) throw new Error('Missing PayFast checkout configuration');

  const plan = plans[input.planCode];
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
  };
  fields.signature = payFastSignature(fields, process.env.PAYFAST_PASSPHRASE);

  return {
    action: process.env.PAYFAST_SANDBOX === 'false'
      ? 'https://www.payfast.co.za/eng/process'
      : 'https://sandbox.payfast.co.za/eng/process',
    fields,
  };
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
