export function assertPracticeOnlySession(session = {}) {
  const blockers = [];
  if (session.account_mode !== 'paper') blockers.push('paper_account_required');
  if (session.execution_enabled === true) blockers.push('live_execution_forbidden');
  if (session.client_funds_connected === true) blockers.push('client_funds_forbidden');
  if (session.personalized_advice_enabled === true) blockers.push('personalized_advice_forbidden');
  if (session.leverage_enabled === true) blockers.push('leverage_disabled_in_readiness_path');
  return {
    allowed: blockers.length === 0,
    mode: 'paper_only',
    blockers
  };
}

export function nextLearningAction({ readiness, quizResult }) {
  if (readiness.practice_ready) return 'START_GUIDED_PAPER_SESSION';
  if (quizResult && quizResult.score_pct < 80) return 'RELEARN_WEAK_CONCEPTS';
  if (readiness.blockers.includes('insufficient_simulations')) return 'COMPLETE_MORE_SIMULATIONS';
  if (readiness.blockers.some(x => x.includes('discipline') || x.includes('loss') || x.includes('oversized'))) return 'RISK_COACH_REVIEW';
  return 'CONTINUE_CURRICULUM';
}
