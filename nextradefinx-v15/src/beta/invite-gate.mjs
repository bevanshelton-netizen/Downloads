export function evaluateInviteAccess({ authenticated, emailVerified, ageConfirmed18Plus, inviteStatus, consentVersions, requiredVersions }) {
  const blockers = [];
  if (!authenticated) blockers.push('AUTH_REQUIRED');
  if (!emailVerified) blockers.push('EMAIL_VERIFICATION_REQUIRED');
  if (!ageConfirmed18Plus) blockers.push('BETA_18_PLUS_CONFIRMATION_REQUIRED');
  if (inviteStatus !== 'approved') blockers.push('INVITE_APPROVAL_REQUIRED');
  for (const key of ['terms', 'privacy', 'risk']) {
    if (!requiredVersions?.[key]) blockers.push(`MISSING_REQUIRED_${key.toUpperCase()}_VERSION`);
    if (consentVersions?.[key] !== requiredVersions?.[key]) blockers.push(`${key.toUpperCase()}_CONSENT_REQUIRED`);
  }
  return { allowed: blockers.length === 0, blockers, mode: 'education_and_paper_trading_only' };
}
