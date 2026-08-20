import LegalPage from '@/components/LegalPage';
import { legal } from '@/lib/legal';

export default function CopyrightPage() {
  return <LegalPage eyebrow="LEGAL • RIGHTS" title="Copyright & Rights Complaints" version={legal.creatorAgreement.version}>
    <h2>Respect for ownership</h2><p>KORA requires creators to own or control the rights necessary for distribution. A rights declaration is recorded when a creator creates a production, and KORA may request supporting licences, releases and source material.</p>
    <h2>How to send a complaint</h2><p>Send a rights complaint to {legal.rightsEmail}. Include your full name and contact details, identification of the protected work or right, the KORA programme/episode or URL complained of, the basis on which you own or represent the right, enough evidence for KORA to assess the claim, and a good-faith statement that the disputed use is not authorised by you, your agent or law.</p>
    <h2>What KORA may do</h2><p>KORA may acknowledge the complaint, preserve relevant records, temporarily restrict the content, request more evidence from either party, notify the creator, restore content where a claim is not supported, or remove/restrict content where appropriate. Money directly connected to a credible unresolved rights dispute may be held from payout until the dispute is resolved.</p>
    <h2>Urgent safety material</h2><p>Copyright reporting is not the route for child sexual abuse material, sexual exploitation, threats or other urgent safety matters. Those reports are escalated under KORA's safety process and, where required, to the appropriate authorities.</p>
    <h2>False claims</h2><p>Do not knowingly submit false ownership claims or fabricated evidence. KORA may restrict accounts that abuse the complaints process and may preserve information required for legal proceedings.</p>
  </LegalPage>;
}
