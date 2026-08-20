import LegalPage from '@/components/LegalPage';
import { legal } from '@/lib/legal';

export default function RefundsPage() {
  return <LegalPage eyebrow="LEGAL • BILLING" title="Cancellation & Refund Policy" version={legal.platformTerms.version}>
    <h2>Subscriptions</h2><p>Users can cancel recurring KORA subscriptions through the account/billing route made available for the payment method. Cancellation stops future renewals once processed but normally does not erase access already paid for during the current billing period.</p>
    <h2>Duplicate or incorrect charges</h2><p>Report suspected duplicate, unauthorised or incorrect charges promptly to {legal.supportEmail}. KORA will investigate against payment-provider and platform records and apply any refund or reversal required by the payment agreement or applicable law.</p>
    <h2>Digital purchases</h2><p>Refund eligibility for premium episode/season unlocks, event access and other digital purchases depends on the nature of the product, whether access was used, the reason for the request and mandatory consumer rights. The final checkout flow must display product-specific terms before payment.</p>
    <h2>Service failure</h2><p>If KORA fails to supply paid access because of a confirmed platform or entitlement error, KORA may restore access, extend access, credit the account or refund the affected purchase as appropriate and as required by law.</p>
    <h2>Fraud and abuse</h2><p>KORA may withhold discretionary credits or rewards linked to fraud, chargebacks, automated viewing, manipulated engagement or other abuse. This does not remove rights that cannot lawfully be excluded.</p>
  </LegalPage>;
}
