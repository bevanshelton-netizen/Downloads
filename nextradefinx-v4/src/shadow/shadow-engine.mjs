import { buildFeatures } from '../../../nextradefinx-v3/src/research/indicators.mjs';
import { ensembleProbability } from '../../../nextradefinx-v3/src/research/models.mjs';
import { assessModelHealth } from '../../../nextradefinx-v3/src/research/health.mjs';

function confidenceFromProbability(p) {
  return Math.min(1, Math.abs(p - 0.5) * 2);
}

export function createShadowForecast({ symbol, bars, researchMetrics, providerName, now = new Date() }) {
  if (!Array.isArray(bars) || bars.length < 80) throw new Error(`insufficient_shadow_history:${symbol}`);
  const index = bars.length - 1;
  const features = buildFeatures(bars, index);
  const ensemble = ensembleProbability(features);
  const probabilityUp = Number(ensemble.bullish.toFixed(6));
  const probabilityDown = Number((1 - probabilityUp).toFixed(6));
  const confidence = Number(confidenceFromProbability(probabilityUp).toFixed(6));
  const researchHealth = researchMetrics ? assessModelHealth(researchMetrics) : { status: 'halted', reasons: ['missing_research_health'] };
  const healthAllowsShadow = researchHealth.status === 'normal';
  const edgeAllowsShadow = confidence >= 0.12;
  const decision = healthAllowsShadow && edgeAllowsShadow ? (probabilityUp >= 0.5 ? 'UP' : 'DOWN') : 'NO_FORECAST';

  return {
    schema_version: 'shadow-forecast-0.4',
    forecast_id: `${symbol}-${now.toISOString()}-${Math.random().toString(36).slice(2, 10)}`,
    created_at: now.toISOString(),
    symbol,
    provider: providerName,
    data_mode: providerName === 'fixture-synthetic' ? 'DEVELOPMENT_FIXTURE' : 'LIVE_OR_LICENSED_PROVIDER',
    model_family: 'transparent_baseline_ensemble_v0.4',
    horizon: 'NEXT_BAR',
    decision,
    probability_up: probabilityUp,
    probability_down: probabilityDown,
    confidence,
    model_health: researchHealth.status,
    model_health_reasons: researchHealth.reasons || [],
    last_market_timestamp: bars.at(-1).timestamp,
    last_close: bars.at(-1).close,
    feature_snapshot: {
      trend: Number(features.trend.toFixed(8)),
      momentum5: Number(features.momentum5.toFixed(8)),
      momentum20: Number(features.momentum20.toFixed(8)),
      volatility20: Number(features.volatility20.toFixed(8)),
      z20: Number(features.z20.toFixed(6)),
      volumeRatio: Number(features.volumeRatio.toFixed(6))
    },
    execution_enabled: false,
    client_visible: false,
    claim_boundary: 'Shadow research only. No client trading decision should depend on this record.'
  };
}
