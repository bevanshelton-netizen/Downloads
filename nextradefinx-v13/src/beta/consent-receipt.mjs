export function buildConsentReceipt({ userId, locale = 'en-ZA', termsVersion, privacyVersion, riskVersion, ageOver18, acceptedAt = new Date() }) {
  if (!userId) throw new Error('user_id_required');
  if (!termsVersion || !privacyVersion || !riskVersion) throw new Error('all_document_versions_required');
  if (ageOver18 !== true) throw new Error('age_confirmation_required');
  return Object.freeze({
    user_id: String(userId),
    locale: String(locale).slice(0, 16),
    terms_version: String(termsVersion).slice(0, 32),
    privacy_version: String(privacyVersion).slice(0, 32),
    risk_version: String(riskVersion).slice(0, 32),
    age_over_18_confirmed: true,
    educational_only_acknowledged: true,
    no_profit_promise_acknowledged: true,
    live_execution_off_acknowledged: true,
    accepted_at: new Date(acceptedAt).toISOString()
  });
}
