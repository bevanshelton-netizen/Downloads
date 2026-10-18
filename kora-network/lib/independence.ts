export type IndependenceEngine =
  | 'edge'
  | 'dns'
  | 'cdn'
  | 'web_runtime'
  | 'api_gateway'
  | 'media'
  | 'storage'
  | 'data'
  | 'identity'
  | 'payments'
  | 'analytics'
  | 'observability'
  | 'fortress'
  | 'backup'
  | 'provisioner';

export type IndependenceStatus = 'planned' | 'configured' | 'verified';

export type IndependenceEngineState = {
  engine: IndependenceEngine;
  status: IndependenceStatus;
  provider: 'owned' | 'external';
  requiredForKora: boolean;
};

const ENGINE_REQUIREMENTS: Array<{ engine: IndependenceEngine; requiredForKora: boolean }> = [
  { engine: 'edge', requiredForKora: true },
  { engine: 'dns', requiredForKora: true },
  { engine: 'cdn', requiredForKora: true },
  { engine: 'web_runtime', requiredForKora: true },
  { engine: 'api_gateway', requiredForKora: true },
  { engine: 'media', requiredForKora: true },
  { engine: 'storage', requiredForKora: true },
  { engine: 'data', requiredForKora: true },
  { engine: 'identity', requiredForKora: true },
  { engine: 'payments', requiredForKora: true },
  { engine: 'analytics', requiredForKora: true },
  { engine: 'observability', requiredForKora: true },
  { engine: 'fortress', requiredForKora: true },
  { engine: 'backup', requiredForKora: true },
  { engine: 'provisioner', requiredForKora: false },
];

function isVerified(engine: IndependenceEngine): boolean {
  return process.env[`IZAKHONO_ENGINE_${engine.toUpperCase()}_VERIFIED`] === 'true';
}

/**
 * First-party infrastructure status. Environment flags are deliberately
 * explicit: a configured endpoint is never treated as a verified engine.
 */
export function getIndependenceEngines(): IndependenceEngineState[] {
  return ENGINE_REQUIREMENTS.map(({ engine, requiredForKora }) => ({
    engine,
    requiredForKora,
    status: isVerified(engine) ? 'verified' : 'planned',
    provider: isVerified(engine) ? 'owned' : 'external',
  }));
}

export function isKoraInfrastructureIndependent(): boolean {
  return getIndependenceEngines()
    .filter((engine) => engine.requiredForKora)
    .every((engine) => engine.status === 'verified');
}

export function getIndependenceSummary() {
  const engines = getIndependenceEngines();
  const required = engines.filter((engine) => engine.requiredForKora);
  const verified = required.filter((engine) => engine.status === 'verified');
  return {
    independent: verified.length === required.length,
    required: required.length,
    verified: verified.length,
    remaining: required.filter((engine) => engine.status !== 'verified').map((engine) => engine.engine),
  };
}
