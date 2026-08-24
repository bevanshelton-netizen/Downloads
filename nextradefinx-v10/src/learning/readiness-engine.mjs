const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, Number(n) || 0));

export function calculateReadiness(metrics, policy) {
  const lesson = clamp(metrics.lesson_completion_pct);
  const quiz = clamp(metrics.quiz_average_pct);
  const discipline = clamp(metrics.discipline_score);
  const journal = clamp(metrics.journal_completion_pct);
  const simulations = Math.max(0, Number(metrics.simulations_completed) || 0);
  const simulationScore = clamp((simulations / Math.max(1, policy.min_simulations_completed)) * 100);

  const score = Number((
    lesson * 0.20 +
    quiz * 0.30 +
    discipline * 0.25 +
    journal * 0.15 +
    simulationScore * 0.10
  ).toFixed(2));

  const blockers = [];
  if (lesson < policy.min_lesson_completion_pct) blockers.push('lesson_completion_below_threshold');
  if (quiz < policy.min_quiz_average_pct) blockers.push('quiz_mastery_below_threshold');
  if (discipline < policy.min_discipline_score) blockers.push('discipline_score_below_threshold');
  if (journal < policy.min_journal_completion_pct) blockers.push('journal_completion_below_threshold');
  if (simulations < policy.min_simulations_completed) blockers.push('insufficient_simulations');
  if ((Number(metrics.daily_loss_breaches) || 0) > policy.max_daily_loss_breaches) blockers.push('daily_loss_limit_breach');
  if ((Number(metrics.oversized_trade_attempts) || 0) > policy.max_oversized_trade_attempts) blockers.push('repeated_oversized_trade_attempts');
  if (policy.execution_mode !== 'paper_only') blockers.push('invalid_execution_mode');

  const practiceReady = score >= policy.min_readiness_score && blockers.length === 0;
  return {
    readiness_score: score,
    practice_ready: practiceReady,
    status: practiceReady ? 'PRACTICE_READY' : 'LEARNING_IN_PROGRESS',
    blockers,
    execution_mode: 'paper_only',
    legal_status: 'internal_educational_competency_only'
  };
}

export function determineStage(metrics, stages) {
  let achieved = stages[0];
  for (const stage of stages) {
    const passes =
      clamp(metrics.quiz_average_pct) >= stage.min_quiz &&
      clamp(metrics.lesson_completion_pct) >= stage.min_completion &&
      (Number(metrics.simulations_completed) || 0) >= stage.min_simulations;
    if (passes) achieved = stage;
  }
  return achieved;
}
