export function assessModelHealth(metrics) {
  const reasons = [];
  if (metrics.observations < 500) reasons.push('insufficient_evaluation_sample');
  if (metrics.brier_score > 0.26) reasons.push('poor_probability_quality');
  if (metrics.tradable_accuracy < 0.52) reasons.push('weak_high_confidence_accuracy');
  if (metrics.coverage < 0.08) reasons.push('too_few_actionable_forecasts');
  if (metrics.research_max_drawdown > 0.20) reasons.push('research_drawdown_too_high');

  let status = 'normal';
  if (reasons.length >= 2) status = 'halted';
  else if (reasons.length === 1) status = 'watch';

  return {
    status,
    real_money_eligible: false,
    reasons,
    rule: status === 'normal'
      ? 'Research pipeline passes current synthetic-data guardrails. This is not evidence of live market edge.'
      : 'Research output must not progress toward live use until failed guardrails are resolved.'
  };
}
