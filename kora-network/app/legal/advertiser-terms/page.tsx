import LegalPage from '@/components/LegalPage';
import { legal } from '@/lib/legal';

export default function AdvertiserTermsPage() {
  return <LegalPage eyebrow="LEGAL • BRANDS" title="KORA Advertiser Terms" version={legal.advertiserTerms.version}>
    <h2>1. Campaign authority</h2><p>The advertiser confirms it has authority to buy the campaign and all rights required for supplied logos, video, music, claims, promotions, landing pages and other creative materials.</p>
    <h2>2. Budgets and activation</h2><p>A saved campaign budget is a plan, not proof of payment. KORA activates paid delivery and any viewer reward pool only against money that has cleared through an approved commercial process. Cumulative funded amounts may not exceed the approved campaign budget or reward allocation.</p>
    <h2>3. Viewer rewards</h2><p>If a campaign includes rewards, the advertiser may set an approved reward allocation and per-verified-completion amount. KORA independently verifies qualifying events and applies anti-fraud controls. Advertisers do not receive authority to pay arbitrary users directly through the KORA wallet.</p>
    <h2>4. Advertising standards</h2><p>Advertising must be lawful, accurate and not misleading. Prohibited or restricted categories, unsafe products, unlawful discrimination, exploitation of children, sexual services and creative that conflicts with KORA's family-safety standard may be rejected.</p>
    <h2>5. Placement and brand safety</h2><p>KORA may apply genre, age, content and placement exclusions. Sponsorship of a programme does not give the advertiser editorial control unless a written production agreement expressly provides it.</p>
    <h2>6. Measurement</h2><p>Campaign reports are based on KORA's measurement systems and verified provider events, subject to reasonable invalid-traffic filtering and corrections. Estimates and forecasts are not guaranteed delivery unless a signed order expressly states a guarantee and remedy.</p>
    <h2>7. Creator and product placement deals</h2><p>Creator sponsorship, wardrobe/product placement, branded entertainment and commissioned content may require a separate agreement covering creative approvals, disclosures, usage rights and fees.</p>
    <h2>8. Suspension and refunds</h2><p>KORA may pause campaigns for suspected fraud, rights issues, unsafe creative, payment problems or legal requirements. Any credits or refunds are determined by the applicable insertion order, campaign order and mandatory consumer/business law.</p>
    <h2>9. Contact</h2><p>Commercial and support queries may be sent to {legal.supportEmail}. Final advertiser terms require South African legal review before production approval.</p>
  </LegalPage>;
}
