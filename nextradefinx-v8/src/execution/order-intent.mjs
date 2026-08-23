const sides = new Set(['BUY','SELL']);
const types = new Set(['MARKET','LIMIT']);
export function normalizeOrderIntent(input = {}) {
  const intent = {
    account_mode: input.account_mode || 'practice',
    symbol: String(input.symbol || '').trim().toUpperCase(),
    side: String(input.side || '').trim().toUpperCase(),
    quantity: Number(input.quantity),
    reference_price: Number(input.reference_price),
    stop_price: Number(input.stop_price),
    order_type: String(input.order_type || 'MARKET').trim().toUpperCase(),
    limit_price: input.limit_price == null ? null : Number(input.limit_price),
    client_visible_explanation: String(input.client_visible_explanation || '').slice(0,1000)
  };
  const errors=[];
  if (intent.account_mode !== 'practice') errors.push('only_practice_mode_supported');
  if (!intent.symbol) errors.push('symbol_required');
  if (!sides.has(intent.side)) errors.push('invalid_side');
  if (!types.has(intent.order_type)) errors.push('invalid_order_type');
  if (!(intent.quantity > 0)) errors.push('quantity_must_be_positive');
  if (!(intent.reference_price > 0)) errors.push('reference_price_must_be_positive');
  if (!(intent.stop_price > 0)) errors.push('stop_price_must_be_positive');
  if (intent.order_type === 'LIMIT' && !(intent.limit_price > 0)) errors.push('limit_price_required');
  return { ok: errors.length===0, intent, errors };
}
