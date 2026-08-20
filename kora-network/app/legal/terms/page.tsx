import LegalPage from '@/components/LegalPage';
import { legal } from '@/lib/legal';

export default function TermsPage() {
  return <LegalPage eyebrow="LEGAL • PLATFORM" title="KORA Terms of Use" version={legal.platformTerms.version}>
    <h2>1. Who operates KORA</h2><p>KORA is operated by {legal.operatorName}. Final company details, registered address and regulatory particulars must be completed before public launch.</p>
    <h2>2. The service</h2><p>KORA provides live and on-demand entertainment, creator publishing tools, subscriptions, advertising, commerce and selected revenue-funded viewer rewards. Features may vary by country, device, programme and account status.</p>
    <h2>3. Accounts and acceptable use</h2><p>Users must provide accurate account information, protect access credentials and use KORA lawfully. Fraud, automated viewing, device farms, artificial engagement, payment abuse, impersonation, harassment, security interference and attempts to manipulate rewards are prohibited.</p>
    <h2>4. Content standard</h2><p>Pornography and explicit sexual content are prohibited. Content involving sexual exploitation of children, non-consensual intimate material, trafficking or other unlawful sexual exploitation is prohibited. KORA may review, restrict, age-rate, demonetise, remove or preserve content where required for safety or law-enforcement processes.</p>
    <h2>5. Subscriptions and purchases</h2><p>Prices and billing periods are shown before checkout. Paid access becomes effective only after KORA receives valid payment confirmation from the payment provider. Cancellation, refunds and statutory consumer rights remain subject to the purchase terms shown at checkout and applicable South African law.</p>
    <h2>6. Viewer rewards</h2><p>Rewards are promotional or commercial benefits, not employment, wages, an investment product or guaranteed income. A displayed potential reward is payable only when the qualifying activity is independently verified and sufficient cleared campaign funding is available. KORA may reject fraudulent, duplicated or manipulated claims.</p>
    <h2>7. Intellectual property</h2><p>KORA owns or licenses the platform software, branding and platform-created materials. Creators retain rights in creator-owned works subject to the licences they grant under the Creator Agreement. Users may not copy, rebroadcast, scrape or commercially exploit protected content without permission.</p>
    <h2>8. Safety, suspension and termination</h2><p>KORA may restrict or terminate accounts for material or repeated violations, fraud, threats to viewers or creators, intellectual-property abuse, or legal/regulatory requirements. Where appropriate, users may be given a review or appeal route.</p>
    <h2>9. Availability and liability</h2><p>KORA aims for reliable service but does not promise uninterrupted availability or that every programme will remain available. Nothing in these terms excludes rights or liabilities that cannot lawfully be excluded under applicable consumer or other mandatory law.</p>
    <h2>10. Changes and contact</h2><p>Material changes will be versioned and, where required, presented for renewed acceptance. Questions may be sent to {legal.supportEmail}.</p>
  </LegalPage>;
}
