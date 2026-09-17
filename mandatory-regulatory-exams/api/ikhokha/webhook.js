const {
  ORIGIN,
  credentials,
  signatureFor,
  readRequestBody
} = require('../../lib/ikhokha');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method not allowed');
  const { appId, appSecret, configured } = credentials();
  if (!configured) return res.status(503).end('Gateway not configured');

  const body = await readRequestBody(req);
  const incomingAppId = String(req.headers['ik-appid'] || '').trim();
  const incomingSignature = String(req.headers['ik-sign'] || '').trim().toLowerCase();
  const callbackUrl = `${ORIGIN}/api/ikhokha/webhook`;
  const expected = signatureFor(callbackUrl, body, appSecret).toLowerCase();

  if (!incomingAppId || incomingAppId !== appId || !incomingSignature || incomingSignature !== expected) {
    console.warn('Rejected iKhokha webhook signature');
    return res.status(403).end('Forbidden');
  }

  let event = {};
  try { event = JSON.parse(body); } catch { return res.status(400).end('Invalid JSON'); }

  const safeEvent = {
    paylinkID: event.paylinkID || null,
    status: event.status || null,
    externalTransactionID: event.externalTransactionID || null,
    responseCode: event.responseCode || null
  };
  console.log('Verified iKhokha webhook', JSON.stringify(safeEvent));
  return res.status(200).json({ received: true });
};
