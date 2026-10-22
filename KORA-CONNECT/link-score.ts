export type KoraLinkType = '5g' | '4g' | 'wifi' | 'ethernet' | 'satellite' | 'ip';

export type KoraLinkState = 'available' | 'probing' | 'healthy' | 'degraded' | 'failed' | 'recovering';

export interface KoraLinkTelemetry {
  id: string;
  type: KoraLinkType;
  state: KoraLinkState;
  latencyMs: number;
  jitterMs: number;
  packetLossPct: number;
  throughputMbps: number;
  signalQuality?: number;
  costPerMb?: number;
}

export interface KoraLinkPolicy {
  maxLatencyMs?: number;
  maxPacketLossPct?: number;
  minThroughputMbps?: number;
  maxCostPerMb?: number;
  priority?: number;
}

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

/**
 * Deterministic health score for transport selection.
 * This is intentionally vendor-neutral; production adapters supply telemetry.
 */
export function scoreKoraLink(link: KoraLinkTelemetry, policy: KoraLinkPolicy = {}): number {
  if (link.state === 'failed') return 0;

  const latency = clamp(100 - link.latencyMs / 5);
  const jitter = clamp(100 - link.jitterMs / 2);
  const loss = clamp(100 - link.packetLossPct * 10);
  const throughput = clamp(link.throughputMbps * 2);
  const signal = link.signalQuality == null ? 70 : clamp(link.signalQuality);

  let score = latency * 0.25 + jitter * 0.10 + loss * 0.30 + throughput * 0.20 + signal * 0.15;

  if (policy.maxLatencyMs != null && link.latencyMs > policy.maxLatencyMs) score -= 20;
  if (policy.maxPacketLossPct != null && link.packetLossPct > policy.maxPacketLossPct) score -= 25;
  if (policy.minThroughputMbps != null && link.throughputMbps < policy.minThroughputMbps) score -= 20;
  if (policy.maxCostPerMb != null && (link.costPerMb ?? 0) > policy.maxCostPerMb) score -= 15;

  return Math.round(clamp(score));
}

export function rankKoraLinks(
  links: KoraLinkTelemetry[],
  policies: Record<string, KoraLinkPolicy> = {}
) {
  return [...links]
    .map(link => ({ link, score: scoreKoraLink(link, policies[link.id]) }))
    .sort((a, b) => b.score - a.score);
}
