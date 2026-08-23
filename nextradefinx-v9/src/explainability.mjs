const LEVELS = new Set(['beginner','intermediate','experienced']);

export function buildExplanation({ forecast, level='beginner', language='en' }) {
  if (!LEVELS.has(level)) throw new Error('invalid_experience_level');
  if (!forecast || typeof forecast !== 'object') throw new Error('forecast_required');
  for (const k of ['symbol','decision','confidence','why','could_be_wrong']) {
    if (forecast[k] === undefined) throw new Error(`missing_${k}`);
  }
  if (!['UP','DOWN','NO_FORECAST'].includes(forecast.decision)) throw new Error('invalid_decision');
  const hasProb = Number.isFinite(forecast.probability_up) && Number.isFinite(forecast.probability_down);
  if (forecast.decision !== 'NO_FORECAST' && !hasProb) throw new Error('validated_probabilities_required');

  const base = {
    schema:'nexai-explanation-v1', language, level, symbol:forecast.symbol,
    decision:forecast.decision, confidence:forecast.confidence,
    probability_up: hasProb ? forecast.probability_up : null,
    probability_down: hasProb ? forecast.probability_down : null,
    why:[...forecast.why], could_be_wrong:[...forecast.could_be_wrong],
    personalized_advice:false, live_execution:false, profit_promise:false
  };

  if (level === 'beginner') {
    base.lesson = forecast.decision === 'NO_FORECAST'
      ? 'The model does not have enough evidence. Choosing not to trade is a valid decision.'
      : 'A probability is not a promise. It describes uncertainty, not certainty.';
    base.next_action = 'Practise with virtual money and review the risk before deciding anything.';
  } else if (level === 'intermediate') {
    base.lesson = 'Compare the model view with volatility, invalidation conditions and position risk.';
    base.next_action = 'Use the practice risk gate before any simulated order.';
  } else {
    base.lesson = 'Inspect calibration, regime fit, model health and invalidation before acting.';
    base.next_action = 'Review model evidence and scenario sensitivity in the research layer.';
  }
  return base;
}
