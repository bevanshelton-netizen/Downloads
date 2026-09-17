const { PRODUCTS, credentials } = require('../../lib/ikhokha');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { configured } = credentials();
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    gateway: 'iKhokha',
    configured,
    currency: 'ZAR',
    products: Object.values(PRODUCTS).map(({ id, label, amount, days }) => ({ id, label, amount, days }))
  });
};
