const {
  IKHOKHA_STATUS_EXTERNAL,
  credentials,
  signatureFor,
  productFromReference,
  issueEntitlement
} = require('../../lib/ikhokha');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { appId, appSecret, configured } = credentials();
  if (!configured) return res.status(503).json({ error: 'Payment gateway is not configured.', code: 'IKHOKHA_NOT_CONFIGURED' });

  const ref = String(req.query.externalReference || '').trim();
  if (!/^(PDE4|PDE5|PDEB)-[0-9a-f-]{36}$/i.test(ref)) {
    return res.status(400).json({ error: 'Invalid payment reference.' });
  }

  const product = productFromReference(ref);
  if (!product) return res.status(400).json({ error: 'Unknown product reference.' });

  const statusUrl = `${IKHOKHA_STATUS_EXTERNAL}?externalReference=${encodeURIComponent(ref)}`;
  const signature = signatureFor(statusUrl, '', appSecret);

  let response;
  try {
    response = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'IK-APPID': appId,
        'IK-SIGN': signature
      }
    });
  } catch (error) {
    console.error('iKhokha status network error', error && error.message);
    return res.status(502).json({ error: 'Could not verify payment with provider.' });
  }

  const raw = await response.text();
  let data = {};
  try { data = JSON.parse(raw); } catch { data = { message: raw }; }
  if (!response.ok) return res.status(502).json({ error: 'Payment status lookup failed.' });

  const providerStatus = String(data.status || '').toUpperCase();
  if (providerStatus !== 'PAID' && providerStatus !== 'SUCCESS') {
    return res.status(200).json({ paid: false, status: providerStatus || 'PENDING' });
  }

  const expectedAmount = product.amount;
  if (Number.isFinite(Number(data.amount)) && Number(data.amount) !== expectedAmount) {
    console.error('iKhokha amount mismatch', ref, data.amount, expectedAmount);
    return res.status(409).json({ error: 'Paid amount does not match the selected product.' });
  }

  const token = issueEntitlement(product, ref, appSecret);
  return res.status(200).json({
    paid: true,
    status: providerStatus,
    token,
    product: { id: product.id, label: product.label, days: product.days }
  });
};
