export function createLearnerProfile({ learner_id, language = 'en', experience = 'beginner' }) {
  if (!learner_id) throw new Error('learner_id_required');
  return {
    learner_id,
    language,
    experience,
    lesson_completion_pct: 0,
    quiz_average_pct: 0,
    simulations_completed: 0,
    journal_completion_pct: 0,
    discipline_score: 100,
    daily_loss_breaches: 0,
    oversized_trade_attempts: 0,
    updated_at: new Date().toISOString()
  };
}

export function applyLearningEvent(profile, event) {
  const next = { ...profile };
  switch (event.type) {
    case 'LESSON_PROGRESS': next.lesson_completion_pct = event.value; break;
    case 'QUIZ_AVERAGE': next.quiz_average_pct = event.value; break;
    case 'SIMULATION_COMPLETED': next.simulations_completed += 1; break;
    case 'JOURNAL_COMPLETION': next.journal_completion_pct = event.value; break;
    case 'DISCIPLINE_SCORE': next.discipline_score = event.value; break;
    case 'DAILY_LOSS_BREACH': next.daily_loss_breaches += 1; break;
    case 'OVERSIZED_TRADE_ATTEMPT': next.oversized_trade_attempts += 1; break;
    default: throw new Error(`unknown_learning_event:${event.type}`);
  }
  next.updated_at = new Date().toISOString();
  return next;
}
