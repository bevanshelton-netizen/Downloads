export function assessPracticeRisk({ intent, account, policy }) {
  const blockers=[];
  const warnings=[];
  const balance=Number(account.balance || 0);
  const openPositions=Number(account.open_positions || 0);
  const dailyPnl=Number(account.daily_pnl || 0);
  const entry=intent.order_type==='LIMIT' ? Number(intent.limit_price) : Number(intent.reference_price);
  const qty=Number(intent.quantity);
  const stop=Number(intent.stop_price);
  const riskPerUnit=Math.abs(entry-stop);
  const riskAmount=riskPerUnit*qty;
  const notional=entry*qty;
  const riskPct=balance>0 ? riskAmount/balance*100 : Infinity;
  const notionalPct=balance>0 ? notional/balance*100 : Infinity;
  const dailyLossPct=balance>0 && dailyPnl<0 ? Math.abs(dailyPnl)/balance*100 : 0;

  if (!(balance>0)) blockers.push('invalid_practice_balance');
  if (riskPct>policy.max_risk_per_trade_pct) blockers.push('risk_per_trade_exceeds_policy');
  if (notionalPct>policy.max_position_notional_pct) blockers.push('position_notional_exceeds_policy');
  if (dailyLossPct>=policy.max_daily_loss_pct) blockers.push('daily_loss_limit_reached');
  if (openPositions>=policy.max_open_positions) blockers.push('max_open_positions_reached');
  if (riskPct>policy.max_risk_per_trade_pct*0.8 && riskPct<=policy.max_risk_per_trade_pct) warnings.push('risk_near_limit');

  return { allowed:blockers.length===0, blockers, warnings, metrics:{entry, risk_per_unit:riskPerUnit, risk_amount:riskAmount, risk_pct:riskPct, notional, notional_pct:notionalPct, daily_loss_pct:dailyLossPct} };
}
