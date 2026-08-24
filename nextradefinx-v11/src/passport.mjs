const allowedGoals = new Set(['understand_markets','learn_risk','practice_trading','understand_nexai']);
const allowedExperience = new Set(['beginner','intermediate','experienced']);

export function createPassport({ user_id, language_code = 'en', experience_level = 'beginner', learning_goal = 'understand_markets' }) {
  if (!user_id) throw new Error('user_id_required');
  if (!allowedExperience.has(experience_level)) throw new Error('invalid_experience_level');
  if (!allowedGoals.has(learning_goal)) throw new Error('invalid_learning_goal');
  return {
    user_id,
    language_code,
    experience_level,
    learning_goal,
    current_stage: 0,
    brokerage_account: false,
    kyc_profile: false,
    personalized_advice_profile: false
  };
}

export function advancePassport(passport, stage) {
  const nextStage = Number(stage);
  if (!Number.isInteger(nextStage) || nextStage < 0 || nextStage > 5) throw new Error('invalid_stage');
  if (nextStage < passport.current_stage) return { ...passport };
  return { ...passport, current_stage: nextStage };
}
