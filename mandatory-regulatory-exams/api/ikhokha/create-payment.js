const crypto = require('crypto');
const {
  IKHOKHA_API,
  ORIGIN,
  PRODUCTS,
  credentials,
  signatureFor
} = require('../../lib/ikhokha');

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body); } catch { return {}; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { appId, appSecret, configured } = credentials();
  if (!configured) {
    return res.status(503).json({
      error: 'Payment gateway is not yet connected to this deployment.',
      code: 'IKHOKHA_NOT_CONFIGURED'
    });
  }

  const { productId } = parseBody(req);
  const product = PRODUCTS[productId];
  if (!product) return res.status(400).json({ error: 'Invalid product.' });

  const tx = `${product.prefix}-${crypto.randomUUID()}`;
  const successUrl = `${ORIGIN}/pdeready/payment-success?ref=${encodeURIComponent(tx)}`;
  const failureUrl = `${ORIGIN}/pdeready/payment-failed?ref=${encodeURIComponent(tx)}`;
  const cancelUrl = `${ORIGIN}/pdeready/payment-cancelled?ref=${encodeURIComponent(tx)}`;
  const callbackUrl = `${ORIGIN}/api/ikhokha/webhook`;

  const payload = {
    entityID: appId,
    externalEntityID: 'IZAKHONO-AFRICA-PDEREADY',
    amount: product.amount,
    currency: 'ZAR',
    requesterUrl: `${ORIGIN}/pdeready/premium`,
    description: product.label,
    paymentReference: tx,
    mode: process.env.IKHOKHA_MODE === 'test' ? 'test' : 'live',
    externalTransactionID: tx,
    urls: {
      callbackUrl,
      successPageUrl: successUrl,
      failurePageUrl: failureUrl,
      cancelUrl
    }
  };

  const body = JSON.stringify(payload);
  const signature = signatureFor(IKHOKHA_API, body, appSecret);

  let response;
  try {
    response = await fetch(IKHOKHA_API, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'IK-APPID': appId,
        'IK-SIGN': signature
      },
      body
    });
  } catch (error) {
    console.error('iKhokha create-payment network error', error && error.message);
    return res.status(502).json({ error: 'Could not reach payment provider.' });
  }

  const raw = await response.text();
  let data = {};
  try { data = JSON.parse(raw); } catch { data = { message: raw }; }

  if (!response.ok || data.responseCode !== '00' || !data.paylinkUrl) {
    console.error('iKhokha create-payment rejected', response.status, data.responseCode, data.message);
    return res.status(502).json({
      error: 'Payment link could not be created.',
      providerCode: data.responseCode || null
    });
  }

  return res.status(200).json({
    checkoutUrl: data.paylinkUrl,
    paylinkID: data.paylinkID,
    externalTransactionID: tx,
    product: { id: product.id, label: product.label, amount: product.amount, days: product.days }
  });
};
