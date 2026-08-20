import LegalPage from '@/components/LegalPage';
import { legal } from '@/lib/legal';

export default function ContentPolicyPage() {
  return <LegalPage eyebrow="TRUST & SAFETY" title="KORA Content Policy" version={legal.platformTerms.version}>
    <h2>Core standard</h2><p>KORA is a family-safe African entertainment network. Pornography and explicit sexual content are prohibited across public programmes, creator uploads, live streams, thumbnails, promotional materials and linked monetised experiences.</p>
    <h2>Always prohibited</h2><p>Sexual content involving children, child sexual abuse material, grooming, sexual exploitation or trafficking, non-consensual intimate material, sexual extortion, explicit sexual acts presented for arousal, and attempts to redirect users to prohibited sexual-content services are not allowed.</p>
    <h2>Contextual mature themes</h2><p>Non-explicit romance, relationships, kissing, health education, documentary/news context, culturally relevant storytelling and mature dramatic themes may be eligible when they are not pornographic, are appropriately classified and comply with applicable law and KORA's safety review.</p>
    <h2>Other unsafe or unlawful content</h2><p>KORA may reject or restrict material involving credible threats, exploitation, unlawful hate or incitement, dangerous criminal instruction, fraud, rights infringement, deceptive advertising, or other material that creates unacceptable legal or safety risk.</p>
    <h2>Moderation</h2><p>Creators self-declare and propose ratings, but KORA retains final publishing and monetisation control. Automated signals can assist review; high-risk and flagged material requires human moderation. Viewer reports can trigger re-review after publication.</p>
    <h2>Enforcement</h2><p>Possible actions include edits requested, age restrictions, recommendation limits, demonetisation, temporary removal, permanent removal, strikes, account termination and preservation/escalation where law or child-safety procedures require it.</p>
  </LegalPage>;
}
