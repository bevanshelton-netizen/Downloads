const required = (value, name) => { const text = typeof value === 'string' ? value.trim() : ''; if (!text) throw new Error(`${name} is required`); return text }
export async function createIzakhonoPaymentIntent({ amountMinor, email, description, metadata = {}, returnUrl, cancelUrl, idempotencyKey }) {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new Error('amountMinor must be a positive integer')
  const baseUrl = required(process.env.IZAKHONO_PAY_URL, 'IZAKHONO_PAY_URL').replace(/\/$/, '')
  const apiKey = required(process.env.IZAKHONO_PAY_API_KEY, 'IZAKHONO_PAY_API_KEY')
  const appSlug = process.env.IZAKHONO_PAY_APP_SLUG || 'doxa-sure'
  const response = await fetch(`${baseUrl}/api/v1/intents`, { method:'POST', redirect:'error', headers:{ accept:'application/json','content-type':'application/json','x-izakhono-key':apiKey,'x-izakhono-app':appSlug,'idempotency-key':required(idempotencyKey,'idempotencyKey') }, body:JSON.stringify({ amount_minor:amountMinor,currency:'ZAR',email,description,provider:'smart',metadata,...(returnUrl?{return_url:returnUrl}:{}),...(cancelUrl?{cancel_url:cancelUrl}:{}) }) })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.ok || !payload?.intent) throw new Error(payload?.error?.message || `IZAKHONO PAY rejected checkout (${response.status})`)
  return payload.intent
}
