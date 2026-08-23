function barTimestamp(bar) {
  return bar?.timestamp ?? bar?.ts ?? bar?.datetime ?? bar?.date ?? null;
}

function orderedBars(bars) {
  return [...bars].sort((a, b) => new Date(barTimestamp(a)) - new Date(barTimestamp(b)));
}

export function resolveForecastOutcome({ forecast, bars, now = new Date() }) {
  if (!forecast || forecast.record_type === 'OUTCOME') throw new Error('invalid_forecast_record');
  if (!Array.isArray(bars) || bars.length < 2) return null;
  if (!forecast.last_market_timestamp || !Number.isFinite(Number(forecast.last_close))) return null;

  const ordered = orderedBars(bars);
  const forecastTs = new Date(forecast.last_market_timestamp).getTime();
  const next = ordered.find(bar => new Date(barTimestamp(bar)).getTime() > forecastTs);
  if (!next) return null;

  const nextClose = Number(next.close);
  const lastClose = Number(forecast.last_close);
  if (!Number.isFinite(nextClose) || !Number.isFinite(lastClose) || lastClose <= 0) return null;

  const observedUp = nextClose > lastClose ? 1 : 0;
  const probabilityUp = Number(forecast.probability_up);
  const direction = observedUp ? 'UP' : nextClose < lastClose ? 'DOWN' : 'FLAT';
  const directionalHit = forecast.decision === 'UP' || forecast.decision === 'DOWN'
    ? forecast.decision === direction
    : null;
  const brierScore = Number.isFinite(probabilityUp)
    ? Number(((probabilityUp - observedUp) ** 2).toFixed(8))
    : null;

  return {
    schema_version: 'shadow-outcome-0.5',
    record_type: 'OUTCOME',
    outcome_id: `${forecast.forecast_id}:next-bar`,
    forecast_id: forecast.forecast_id,
    symbol: forecast.symbol,
    scored_at: now.toISOString(),
    forecast_created_at: forecast.created_at,
    forecast_market_timestamp: forecast.last_market_timestamp,
    outcome_market_timestamp: String(barTimestamp(next)),
    forecast_decision: forecast.decision,
    probability_up: probabilityUp,
    observed_direction: direction,
    directional_hit: directionalHit,
    brier_score: brierScore,
    forecast_close: lastClose,
    outcome_close: nextClose,
    realized_return: Number((nextClose / lastClose - 1).toFixed(8)),
    provider: forecast.provider,
    execution_enabled: false,
    client_visible: false,
    claim_boundary: 'Shadow scoring only. No client trading decision should depend on this record.'
  };
}

export function scoreLedgerSnapshot({ records, barsBySymbol, now = new Date() }) {
  const outcomes = new Set(records.filter(r => r.record_type === 'OUTCOME').map(r => r.forecast_id));
  const forecasts = records.filter(r => r.record_type !== 'OUTCOME' && r.forecast_id);
  const newOutcomes = [];

  for (const forecast of forecasts) {
    if (outcomes.has(forecast.forecast_id)) continue;
    const bars = barsBySymbol[forecast.symbol];
    if (!bars) continue;
    const outcome = resolveForecastOutcome({ forecast, bars, now });
    if (outcome) newOutcomes.push(outcome);
  }
  return newOutcomes;
}

export function summarizeTrackRecord(records) {
  const forecasts = records.filter(r => r.record_type !== 'OUTCOME' && r.forecast_id);
  const outcomes = records.filter(r => r.record_type === 'OUTCOME');
  const directional = outcomes.filter(r => typeof r.directional_hit === 'boolean');
  const scoredProbabilities = outcomes.filter(r => Number.isFinite(Number(r.brier_score)));
  const correct = directional.filter(r => r.directional_hit).length;
  const brier = scoredProbabilities.length
    ? scoredProbabilities.reduce((sum, r) => sum + Number(r.brier_score), 0) / scoredProbabilities.length
    : null;
  const calls = forecasts.filter(r => r.decision === 'UP' || r.decision === 'DOWN').length;

  return {
    forecasts: forecasts.length,
    outcomes: outcomes.length,
    pending: Math.max(0, forecasts.length - outcomes.length),
    directional_calls: calls,
    no_forecast: forecasts.filter(r => r.decision === 'NO_FORECAST').length,
    abstention_rate: forecasts.length ? Number((1 - calls / forecasts.length).toFixed(6)) : null,
    directional_accuracy: directional.length ? Number((correct / directional.length).toFixed(6)) : null,
    brier_score: brier == null ? null : Number(brier.toFixed(6)),
    execution_enabled: false,
    client_visible: false
  };
}
