function wilsonLowerBound(successes, trials, z = 1.96) {
  if (!Number.isFinite(successes) || !Number.isFinite(trials) || trials <= 0) return null;
  const p = successes / trials;
  const z2 = z * z;
  const denom = 1 + z2 / trials;
  const centre = p + z2 / (2 * trials);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * trials)) / trials);
  return (centre - margin) / denom;
}

export function evaluateEvidenceGate({ trackRecord, policy }) {
  const cfg = policy.evidence_gate;
  const blockers = [];
  const total = Number(trackRecord.forecasts || 0);
  const calls = Number(trackRecord.directional_calls || 0);
  const hits = Number(trackRecord.directional_hits ?? Math.round(calls * Number(trackRecord.directional_accuracy || 0)));
  const days = Number(trackRecord.observation_days || 0);
  const brier = Number(trackRecord.brier_score);
  const naiveBrier = Number(trackRecord.naive_brier_score);
  const ece = Number(trackRecord.calibration_ece);
  const lower = wilsonLowerBound(hits, calls);
  const brierImprovement = Number.isFinite(brier) && Number.isFinite(naiveBrier) && naiveBrier > 0
    ? (naiveBrier - brier) / naiveBrier
    : null;

  if (days < cfg.minimum_observation_days) blockers.push('insufficient_observation_days');
  if (total < cfg.minimum_total_forecasts) blockers.push('insufficient_total_forecasts');
  if (calls < cfg.minimum_directional_calls) blockers.push('insufficient_directional_calls');
  if (brierImprovement === null || brierImprovement < cfg.minimum_brier_improvement_vs_naive) blockers.push('insufficient_probability_edge_vs_naive');
  if (!Number.isFinite(ece) || ece > cfg.maximum_calibration_ece) blockers.push('calibration_not_good_enough');
  if (cfg.require_directional_wilson_lower_bound_above_random && (lower === null || lower <= cfg.directional_random_baseline)) blockers.push('directional_edge_not_statistically_supported');

  return {
    eligible_for_internal_review: blockers.length === 0,
    blockers,
    diagnostics: {
      observation_days: days,
      total_forecasts: total,
      directional_calls: calls,
      directional_hits: hits,
      directional_wilson_lower_95: lower,
      brier_score: Number.isFinite(brier) ? brier : null,
      naive_brier_score: Number.isFinite(naiveBrier) ? naiveBrier : null,
      brier_improvement_vs_naive: brierImprovement,
      calibration_ece: Number.isFinite(ece) ? ece : null
    },
    boundaries: policy.boundaries
  };
}

export { wilsonLowerBound };
