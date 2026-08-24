export const CURRENT_POLICY = Object.freeze({
  terms_version: '2026-08-24',
  privacy_version: '2026-08-24',
  risk_version: '2026-08-24',
  minimum_age_confirmation: 18,
  product_mode: 'education_and_paper_trading_only'
});

export function evaluateBetaEligibility(input = {}, policy = CURRENT_POLICY) {
  const blockers = [];
  if (!input.authenticated) blockers.push('authentication_required');
  if (!input.email_verified) blockers.push('verified_email_required');
  if (!input.invite_approved) blockers.push('beta_invite_required');
  if (input.age_over_18 !== true) blockers.push('age_confirmation_required');
  if (input.terms_version !== policy.terms_version) blockers.push('current_terms_required');
  if (input.privacy_version !== policy.privacy_version) blockers.push('current_privacy_notice_required');
  if (input.risk_version !== policy.risk_version) blockers.push('current_risk_acknowledgement_required');
  return {
    eligible: blockers.length === 0,
    blockers,
    mode: policy.product_mode,
    live_execution_enabled: false,
    client_funds_enabled: false,
    personalized_advice_enabled: false
  };
}
