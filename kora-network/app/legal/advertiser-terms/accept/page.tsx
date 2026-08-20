import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { legal } from '@/lib/legal';
import { acceptAdvertiserTerms } from './actions';

export const dynamic = 'force-dynamic';

export default async function AcceptAdvertiserTerms({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { error } = await searchParams;

  const { data: existing } = await supabase.from('agreement_acceptances')
    .select('id')
    .eq('user_id', user.id)
    .eq('document_code', legal.advertiserTerms.code)
    .eq('document_version', legal.advertiserTerms.version)
    .maybeSingle();
  if (existing) redirect('/advertiser');

  return <main>
    <section className="subHero"><div className="eyebrow">ADVERTISER ONBOARDING</div><h1>Accept the Advertiser Terms.</h1><p>Campaign creation is unlocked only after the current commercial terms have been accepted.</p></section>
    <section>
      <form action={acceptAdvertiserTerms} className="panel formPanel">
        {error ? <p role="alert">{error}</p> : null}
        <p>Current Advertiser Terms: <strong>version {legal.advertiserTerms.version}</strong>.</p>
        <div className="actions"><Link className="secondary" href="/legal/advertiser-terms">Read full Advertiser Terms</Link></div>
        <label className="check"><input type="checkbox" name="confirmed" required /> I have read and accept the KORA Advertiser Terms, version {legal.advertiserTerms.version}.</label>
        <button className="primary">Accept & continue to campaigns</button>
      </form>
    </section>
  </main>;
}
