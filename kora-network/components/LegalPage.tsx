import type { ReactNode } from 'react';
import { legalApproved } from '@/lib/legal';

export default function LegalPage({ eyebrow, title, version, children }: { eyebrow: string; title: string; version: string; children: ReactNode }) {
  const approved = legalApproved();
  return (
    <main>
      <section className="subHero">
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>Version {version}. {approved ? 'Current published version.' : 'Draft for South African legal/compliance review before public launch.'}</p>
      </section>
      <section className="legalCopy">{!approved ? <div className="panel legalDraft"><strong>Not yet approved for production use.</strong><p>KORA's production readiness gate remains closed until the operator deliberately marks the legal pack approved.</p></div> : null}{children}</section>
    </main>
  );
}
