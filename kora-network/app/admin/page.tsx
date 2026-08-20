import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function AdminHub() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (!profile || !['moderator','admin'].includes(profile.role)) redirect('/');

  return (
    <main>
      <section className="subHero"><div className="eyebrow">KORA OPERATIONS</div><h1>Network control.</h1><p>Moderation, broadcast scheduling, creator acquisition and money controls stay separated from public creator and viewer workflows.</p></section>
      <section className="grid three">
        <article className="panel"><h3>Content moderation</h3><p>Review productions, assign separate Kids approval and handle viewer reports.</p><Link className="primary" href="/admin/moderation">Open moderation</Link></article>
        <article className="panel"><h3>Master control</h3><p>Connect live channel feeds and programme the electronic guide.</p><Link className="primary" href="/admin/schedule">Open schedule</Link></article>
        <article className="panel"><h3>Creator acquisition</h3><p>Review filmmakers and issue transparent creator deal offers.</p><Link className="primary" href="/admin/creators">Open creator queue</Link></article>
        {profile.role === 'admin' ? <><article className="panel"><h3>Commercial operations</h3><p>Confirm cleared advertiser money and create funded reward pools.</p><Link className="primary" href="/admin/campaigns">Open campaigns</Link></article><article className="panel"><h3>Creator revenue</h3><p>Allocate reconciled eligible revenue using each creator's accepted deal.</p><Link className="primary" href="/admin/revenue">Open revenue control</Link></article><article className="panel"><h3>Payout operations</h3><p>Verify payout onboarding and resolve held payout requests.</p><Link className="primary" href="/admin/payouts">Open payouts</Link></article></> : null}
      </section>
    </main>
  );
}
