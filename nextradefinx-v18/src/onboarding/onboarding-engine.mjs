export const requiredConsents = ['terms', 'privacy', 'risk'];

export function evaluateFirstLearner(input = {}) {
  const blockers = [];

  if (!input.inviteApproved) blockers.push('invite_not_approved');
  if (!input.emailVerified) blockers.push('email_not_verified');
  if (!input.age18Confirmed) blockers.push('age_18_not_confirmed');

  const consents = input.consents || {};
  for (const name of requiredConsents) {
    if (!consents[name]) blockers.push(`${name}_not_accepted`);
  }

  if (!String(input.language || '').trim()) blockers.push('language_required');
  if (!['beginner','intermediate','experienced'].includes(input.experienceLevel)) {
    blockers.push('experience_level_required');
  }
  if (!String(input.learningGoal || '').trim()) blockers.push('learning_goal_required');
  if (!input.paperOnlyAcknowledged) blockers.push('paper_only_ack_required');
  if (!input.noProfitPromiseAcknowledged) blockers.push('no_profit_promise_ack_required');

  return {
    readyForLearningPassport: blockers.length === 0,
    blockers,
    next: blockers.length === 0 ? 'create_learning_passport' : 'complete_onboarding',
    productBoundary: {
      liveExecution: false,
      clientFunds: false,
      leverage: false,
      personalizedAdvice: false,
      brokerConnectivity: false
    }
  };
}

export function firstSessionPlan(profile = {}) {
  const level = profile.experienceLevel || 'beginner';
  const language = profile.language || 'en';

  if (level === 'experienced') {
    return {
      language,
      path: ['platform_boundaries', 'risk_diagnostics', 'nexai_explainability', 'paper_simulation'],
      tone: 'concise'
    };
  }

  if (level === 'intermediate') {
    return {
      language,
      path: ['market_refresh', 'orders_and_risk', 'nexai_explainability', 'paper_simulation'],
      tone: 'guided'
    };
  }

  return {
    language,
    path: ['what_is_a_market', 'what_is_an_asset', 'risk_before_return', 'guided_paper_trade'],
    tone: 'plain_language'
  };
}
