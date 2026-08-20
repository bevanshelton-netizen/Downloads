import LegalPage from '@/components/LegalPage';
import { legal } from '@/lib/legal';

export default function PrivacyPage() {
  return <LegalPage eyebrow="LEGAL • PRIVACY" title="KORA Privacy Notice" version={legal.privacyNotice.version}>
    <h2>1. Responsible party</h2><p>{legal.operatorName} will be the responsible party for personal information processed for KORA unless a separate notice identifies another responsible party.</p>
    <h2>2. Information we process</h2><p>Depending on how KORA is used, information may include account and contact details, age or eligibility information, creator and advertiser business details, viewing and device events, subscriptions and payment references, wallet and payout records, moderation reports, rights declarations, customer-support communications and fraud/security signals. KORA should not store card PINs, CVVs or online-banking credentials.</p>
    <h2>3. Why we process it</h2><p>Purposes include providing the service, authenticating users, personalising lawful recommendations, processing payments and creator earnings, measuring campaigns, verifying rewards, preventing fraud, moderating content, responding to rights and safety complaints, complying with law and improving platform reliability.</p>
    <h2>4. Sharing and processors</h2><p>Information may be shared with contracted infrastructure, video, authentication, analytics, communications, payment, payout, security and professional-service providers only as reasonably necessary for their role. KORA does not treat viewer conversation or account data as a product for sale to advertisers.</p>
    <h2>5. International processing</h2><p>Some technology providers may process information outside South Africa. Before production launch, KORA must document those transfers and put in place the safeguards required by applicable data-protection law.</p>
    <h2>6. Retention and security</h2><p>Information should be retained only as long as reasonably needed for the stated purpose, legal obligations, disputes, fraud prevention and financial records. KORA uses access controls, row-level database security, server-only secrets and audit-oriented financial records, but no system can promise absolute security.</p>
    <h2>7. Children</h2><p>KORA Kids is a viewing experience, not permission to collect unnecessary personal information from children. Child-data processing requires a specifically approved lawful basis and appropriate parental or competent-person controls before those features are enabled.</p>
    <h2>8. Your choices and rights</h2><p>Subject to applicable law, users may request access, correction or deletion, object to certain processing, withdraw consent where consent is the basis, and raise a privacy complaint. Some records may need to be retained where law, fraud prevention or an active dispute requires it.</p>
    <h2>9. Marketing</h2><p>Promotional electronic communications must use appropriate consent or another lawful basis and provide an effective opt-out. Product/service communications necessary to an existing account are handled separately from optional marketing.</p>
    <h2>10. Contact</h2><p>Privacy requests should be sent to {legal.privacyEmail}. The final notice must include the operator's complete statutory and information-officer details before approval.</p>
  </LegalPage>;
}
