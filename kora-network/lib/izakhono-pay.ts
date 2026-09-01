import 'server-only';

type CheckoutIntent = {
  id: string;
  reference: string;
  status: string;
  routed_provider?: string | null;
  checkout_method?: string | null;
  checkout_url?: string | null;
  form_fields?: Record<string, string>;
};

type IntentResponse = { ok?: boolean; intent?: CheckoutIntent; error?: { message?: string; code?: string } };

function config() {
  const baseUrl = process.env.IZAKHONO_PAY_URL?.trim().replace(/\/$/, '');
  const apiKey = process.env.IZAKHONO_PAY_API_KEY?.trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '');
  if (!baseUrl || !apiKey || !appUrl) throw new Error('IZAKHONO PAY is not configured');
  let portal: URL;
  let app: URL;
  try {
    portal = new URL(baseUrl);
    app = new URL(appUrl);
  } catch {
    throw new Error('IZAKHONO PAY URLs are invalid');
  }
  if (portal.protocol !== 'https:' || app.protocol !== 'https:' || portal.username || portal.password || app.username || app.password) {
    throw new Error('IZAKHONO PAY and KORA must use HTTPS');
  }
  return { baseUrl: portal.origin, apiKey, appUrl: app.origin };
}

function merchantReturnUrl(appUrl: string, path: string) {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Invalid KORA payment return path');
  const url = new URL(path, appUrl);
  if (url.origin !== appUrl) throw new Error('Unsafe KORA payment return path');
  return url.toString();
}

export function useIzakhonoPay() {
  return process.env.KORA_PAYMENT_ORCHESTRATOR === 'izakhono';
}

export async function buildIzakhonoPayCheckout(input: {
  orderId: string;
  email: string;
  amount: number;
  description: string;
  kind: 'purchase' | 'ticket';
  returnPath: string;
  cancelPath: string;
  metadata?: Record<string, string | number | boolean | null>;
}) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('Invalid payment amount');
  const { baseUrl, apiKey, appUrl } = config();
  const idempotencyKey = `kora:${input.kind}:${input.orderId}`;
  const response = await fetch(`${baseUrl}/api/v1/intents`, {
    method: 'POST',
    cache: 'no-store',
    redirect: 'error',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      'x-izakhono-key': apiKey,
      'x-izakhono-app': 'kora',
      'idempotency-key': idempotencyKey,
    },
    body: JSON.stringify({
      amount_minor: Math.round(input.amount * 100),
      currency: 'ZAR',
      email: input.email,
      description: input.description.slice(0, 180),
      // First KORA rollout deliberately preserves the already-proven PayFast
      // completion contract. Smart routing follows after cross-provider ledger tests.
      provider: 'payfast',
      return_url: merchantReturnUrl(appUrl, input.returnPath),
      cancel_url: merchantReturnUrl(appUrl, input.cancelPath),
      metadata: {
        kind: input.kind,
        order_id: input.orderId,
        ...input.metadata,
      },
    }),
  });

  const payload = await response.json().catch(() => null) as IntentResponse | null;
  if (!response.ok || !payload?.ok || !payload.intent) {
    throw new Error(payload?.error?.message || `IZAKHONO PAY checkout failed (${response.status})`);
  }

  const intent = payload.intent;
  if (intent.routed_provider !== 'payfast' || intent.checkout_method !== 'form_post' || !intent.checkout_url || !intent.form_fields) {
    throw new Error('IZAKHONO PAY returned an unsupported KORA checkout method');
  }
  if (!intent.checkout_url.startsWith('https://')) throw new Error('Unsafe IZAKHONO PAY checkout URL');

  return {
    action: intent.checkout_url,
    fields: intent.form_fields,
    izakhonoIntentId: intent.id,
    izakhonoReference: intent.reference,
  };
}
