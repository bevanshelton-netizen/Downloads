import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { legal } from '@/lib/legal';
import { acceptCreatorAgreement } from './actions';

export const dynamic = 'force-dynamic';

export default async function AcceptCreatorAgreement({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { error } = await searchParams;

  const { data: existing } = await supabase.from('agreement_acceptances')
    .select('id,accepted_at')
    .eq('user_id', user.id)
    .eq('document_code', legal.creatorAgreement.code)
    .eq('document_version', legal.creatorAgreement.version)
    .maybeSingle();

  if (existing) redirect('/studio/productions/new');

  return <main>
    <section className="subHero"><div className="eyebrow">CREATOR ONBOARDING</div><h1>Accept the Creator Agreement.</h1><p>KORA records the exact agreement version accepted before a creator can publish a new production.</p></section>
    <section>
      <form action={acceptCreatorAgreement} className="panel formPanel">
        {error ? <p role="alert">{error}</p> : null}
        <p>Current Creator Agreement: <strong>version {legal.creatorAgreement.version}</strong>.</p>
        <p>Please read the full agreement before accepting. It confirms that you retain ownership of creator-owned work while granting KORA the distribution licence needed to operate the service, and that you control the necessary footage, performance, music and likeness rights.</p>
        <div className="actions"><Link className="secondary" href="/legal/creator-agreement">Read full Creator Agreement</Link></div>
        <label className="check"><input type="checkbox" name="confirmed" required /> I have read and accept the KORA Creator Agreement, version {legal.creatorAgreement.version}.</label>
        <button className="primary">Accept & continue to Creator Studio</button>
      </form>
    </section>
  </main>;
}
