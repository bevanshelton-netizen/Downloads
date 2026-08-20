export const legal = {
  creatorAgreement: { code: 'creator_agreement', version: '2026-08-20' },
  platformTerms: { code: 'platform_terms', version: '2026-08-20' },
  advertiserTerms: { code: 'advertiser_terms', version: '2026-08-20' },
  privacyNotice: { code: 'privacy_notice', version: '2026-08-20' },
  operatorName: process.env.NEXT_PUBLIC_OPERATOR_NAME || 'KORA operator entity pending legal approval',
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@example.invalid',
  privacyEmail: process.env.NEXT_PUBLIC_PRIVACY_EMAIL || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'privacy@example.invalid',
  rightsEmail: process.env.NEXT_PUBLIC_RIGHTS_EMAIL || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'rights@example.invalid',
} as const;

export function legalApproved() {
  return process.env.KORA_LEGAL_APPROVED === 'true';
}
