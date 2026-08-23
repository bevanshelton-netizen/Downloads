export function evaluateCircuitBreaker({ state = {}, cycle = {}, policy, now = new Date() }) {
  const cfg = policy.circuit_breaker;
  const next = {
    consecutive_provider_failures: Number(state.consecutive_provider_failures || 0),
    consecutive_data_quality_failures: Number(state.consecutive_data_quality_failures || 0),
    halted_until: state.halted_until || null,
    last_reason: state.last_reason || null
  };

  const activeHalt = next.halted_until && Date.parse(next.halted_until) > now.getTime();
  if (activeHalt) return { allow_cycle: false, state: next, reason: 'cooldown_active' };

  if (cycle.ledger_valid === false && cfg.halt_on_ledger_integrity_failure) {
    next.halted_until = new Date(now.getTime() + cfg.cooldown_seconds * 1000).toISOString();
    next.last_reason = 'ledger_integrity_failure';
    return { allow_cycle: false, state: next, reason: next.last_reason };
  }

  next.consecutive_provider_failures = cycle.provider_ok === false ? next.consecutive_provider_failures + 1 : 0;
  next.consecutive_data_quality_failures = cycle.data_quality_ok === false ? next.consecutive_data_quality_failures + 1 : 0;

  let reason = null;
  if (next.consecutive_provider_failures >= cfg.max_consecutive_provider_failures) reason = 'provider_failure_threshold';
  if (next.consecutive_data_quality_failures >= cfg.max_consecutive_data_quality_failures) reason = 'data_quality_failure_threshold';

  if (reason) {
    next.halted_until = new Date(now.getTime() + cfg.cooldown_seconds * 1000).toISOString();
    next.last_reason = reason;
    return { allow_cycle: false, state: next, reason };
  }

  next.halted_until = null;
  next.last_reason = null;
  return { allow_cycle: true, state: next, reason: null };
}
