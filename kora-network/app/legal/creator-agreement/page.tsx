import Link from 'next/link';
import LegalPage from '@/components/LegalPage';
import { legal } from '@/lib/legal';

export default function CreatorAgreementPage() {
  return <LegalPage eyebrow="LEGAL • CREATORS" title="KORA Creator Agreement" version={legal.creatorAgreement.version}>
    <h2>1. Creator ownership</h2><p>You keep ownership of creator-owned intellectual property. Uploading content does not transfer ownership to KORA. Unless a separate written Originals, commissioning or exclusivity agreement says otherwise, the platform licence is non-exclusive.</p>
    <h2>2. Licence to operate the service</h2><p>You grant KORA the rights reasonably necessary to host, encode, reproduce, stream, display, promote, clip for trailers/previews, subtitle, format for devices and distribute the submitted content through KORA and agreed promotional channels for as long as the content is available under this agreement.</p>
    <h2>3. Rights you must control</h2><p>You must own or have sufficient written authority for the script, footage, performances, music, artwork, trademarks, locations, archive material, likenesses and other protected elements used in the production. You must retain supporting releases and licences and provide evidence when reasonably requested.</p>
    <h2>4. People appearing in content</h2><p>You are responsible for appropriate performer, contributor and location permissions. Additional safeguards and documented authority are required when children participate in a production.</p>
    <h2>5. Music</h2><p>Uploading a song, beat or soundtrack requires both the relevant composition/publishing rights and recording/master rights unless an applicable licence clearly covers KORA distribution and monetisation.</p>
    <h2>6. Content policy</h2><p>Pornography and explicit sexual content are prohibited. Sexual exploitation, child sexual abuse material, non-consensual intimate material and trafficking content are prohibited. Creators must also comply with applicable classification, consumer, advertising, copyright and other laws.</p>
    <h2>7. Moderation and classification</h2><p>Submission does not guarantee publication. KORA may screen, classify, request edits, reject, restrict, demonetise or remove material for policy, rights, advertiser-safety or legal/regulatory reasons. Creators remain responsible for the accuracy of their initial content and age-rating declarations.</p>
    <h2>8. Monetisation</h2><p>Eligible creators may earn from revenue sources shown in Creator Studio or a separate commercial schedule, which can include advertising, subscriptions, premium unlocks, sponsorship, tips, commerce and licensing. No revenue level is guaranteed. Only cleared, attributable revenue is available for distribution according to the applicable commercial schedule.</p>
    <h2>9. Takedowns and disputes</h2><p>KORA may temporarily disable material while a credible ownership, safety or legal complaint is investigated. Creators may be asked for licences, releases or source files. Knowingly false rights declarations can result in removal, withheld disputed amounts and account enforcement.</p>
    <h2>10. Originals and exclusivity</h2><p>KORA Originals, advances, production funding, exclusivity, first-look rights and commissioned productions require a separate written deal. They are not created merely by joining the standard Creator programme.</p>
    <h2>11. Ending participation</h2><p>Subject to active licences, disputes, payment obligations and reasonable technical processing time, a creator may request removal of creator-owned content. KORA may retain records required for financial, fraud, legal or audit purposes.</p>
    <h2>12. Acceptance</h2><p>The platform records the version accepted by the creator. Material changes may require acceptance of a newer version before further publishing.</p>
    <div className="actions"><Link className="primary" href="/legal/creator-agreement/accept">Review & accept for Creator Studio</Link></div>
  </LegalPage>;
}
