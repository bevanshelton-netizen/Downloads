export function appendProgressEvent(events, event) {
  if (!event?.type) throw new Error('event_type_required');
  const record = {
    id: event.id || `evt_${events.length + 1}`,
    type: event.type,
    payload: event.payload || {},
    occurred_at: event.occurred_at || new Date().toISOString()
  };
  return [...events, record];
}

export function summarizeProgress(events) {
  const summary = {
    lessons_completed: 0,
    quiz_attempts: 0,
    paper_sessions: 0,
    no_trade_decisions: 0,
    journal_entries: 0
  };
  for (const event of events) {
    if (event.type === 'LESSON_COMPLETED') summary.lessons_completed += 1;
    if (event.type === 'QUIZ_ATTEMPT') summary.quiz_attempts += 1;
    if (event.type === 'PAPER_SESSION') summary.paper_sessions += 1;
    if (event.type === 'NO_TRADE_DECISION') summary.no_trade_decisions += 1;
    if (event.type === 'JOURNAL_ENTRY') summary.journal_entries += 1;
  }
  return summary;
}

export function redactPublicPassport(passport) {
  return {
    language_code: passport.language_code,
    experience_level: passport.experience_level,
    learning_goal: passport.learning_goal,
    current_stage: passport.current_stage,
    brokerage_account: false,
    personalized_advice_profile: false
  };
}
