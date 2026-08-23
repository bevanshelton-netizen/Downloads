export function assessBehavior({ trades=[], accountBalance=100000, dailyPnl=0 }) {
  const flags=[];
  const today = trades.slice(-20);
  const last5 = trades.slice(-5);
  const recentLosses = last5.filter(t=>Number(t.pnl)<0).length;
  const avgRisk = today.length ? today.reduce((s,t)=>s+(Number(t.risk_pct)||0),0)/today.length : 0;
  const lastRisk = Number(last5.at(-1)?.risk_pct || 0);
  const prevRisk = Number(last5.at(-2)?.risk_pct || 0);

  if (today.length >= 10) flags.push({code:'OVERTRADING',severity:'watch',message:'You have made many practice trades. Slow down and review your journal.'});
  if (recentLosses >= 3 && lastRisk >= Math.max(1, prevRisk*1.5)) flags.push({code:'REVENGE_RISK',severity:'halt',message:'Risk increased after several losses. Pause practice trading and review the losing sequence.'});
  if (avgRisk > 1) flags.push({code:'OVERSIZING',severity:'halt',message:'Average risk per trade is above the practice policy.'});
  if (dailyPnl <= -0.03*accountBalance) flags.push({code:'DAILY_LOSS_LIMIT',severity:'halt',message:'Practice daily loss limit reached.'});

  const halted = flags.some(f=>f.severity==='halt');
  return { halted, flags, recommendation: halted ? 'NO_NEW_PRACTICE_TRADES' : 'CONTINUE_WITH_DISCIPLINE' };
}
