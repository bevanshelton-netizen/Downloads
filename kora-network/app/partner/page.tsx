import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function PartnerDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/partner');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const staff = Boolean(profile && ['moderator','admin'].includes(String(profile.role)));
  const { data: memberships } = await supabase
    .from('partner_memberships')
    .select('partner_id,role')
    .eq('user_id', user.id);

  let partnerIds = (memberships || []).map(m => m.partner_id);
  let partners: any[] = [];
  if (staff) {
    const { data } = await supabase.from('media_partners').select('id,name,slug,status,agreement_state,integration_mode,territories').order('name');
    partners = data || [];
    partnerIds = partners.map(p => p.id);
  } else if (partnerIds.length) {
    const { data } = await supabase.from('media_partners').select('id,name,slug,status,agreement_state,integration_mode,territories').in('id', partnerIds);
    partners = data || [];
  }

  if (!partnerIds.length) {
    return <main><section className="subHero"><div className="eyebrow">KORA PARTNER DESK</div><h1>No partner workspace is assigned to this account.</h1><p>Partner access is created only after KORA approves the commercial relationship.</p><div className="actions"><Link className="secondary" href="/partners">Partner Gateway</Link></div></section></main>;
  }

  const [{ data: referrals }, { data: conversions }] = await Promise.all([
    supabase.from('partner_referrals').select('id,partner_id,country_code,occurred_at').in('partner_id', partnerIds).order('occurred_at', { ascending:false }).limit(1000),
    supabase.from('partner_conversions').select('id,partner_id,event_type,amount,currency,status,occurred_at').in('partner_id', partnerIds).order('occurred_at', { ascending:false }).limit(1000),
  ]);

  const verified = (conversions || []).filter(c => c.status === 'verified');
  const revenueByCurrency = verified.reduce<Record<string,number>>((sum,c) => {
    const code=String(c.currency || 'ZAR'); sum[code]=(sum[code]||0)+Number(c.amount||0); return sum;
  }, {});
  const money = Object.entries(revenueByCurrency).map(([currency,amount]) =>
    new Intl.NumberFormat('en-ZA',{style:'currency',currency}).format(amount)
  ).join(' + ') || 'R0.00';

  return (
    <main>
      <section className="subHero">
        <div className="eyebrow">KORA PARTNER DESK</div>
        <h1>Acquisition evidence, without surrendering platform control.</h1>
        <p>Referrals are first-party KORA events. Partner conversion callbacks remain reported until reconciliation verifies them.</p>
        <div className="actions"><Link className="secondary" href="/partners">Public Partner Gateway</Link></div>
      </section>

      <section className="grid three">
        <article className="panel"><small>Tracked handoffs</small><h3>{(referrals || []).length}</h3><p>Latest 1,000 visible events.</p></article>
        <article className="panel"><small>Reported conversions</small><h3>{(conversions || []).length}</h3><p>Partner callbacks, not automatically treated as cleared revenue.</p></article>
        <article className="panel"><small>Verified attributable revenue</small><h3>{money}</h3><p>Only conversions whose reconciliation status is verified.</p></article>
      </section>

      <section className="grid two">
        {partners.map(partner => {
          const partnerReferrals=(referrals || []).filter(r=>r.partner_id===partner.id);
          const partnerConversions=(conversions || []).filter(c=>c.partner_id===partner.id);
          const partnerVerified=partnerConversions.filter(c=>c.status==='verified');
          return <article className="panel" key={partner.id}>
            <small>{partner.status} • {partner.agreement_state}</small>
            <h3>{partner.name}</h3>
            <p>{partner.integration_mode.replaceAll('_',' ')} • {(partner.territories || []).join(', ') || 'territories controlled per asset'}</p>
            <div className="productionRow"><strong>{partnerReferrals.length}</strong><span>tracked handoffs</span></div>
            <div className="productionRow"><strong>{partnerConversions.length}</strong><span>reported conversions</span></div>
            <div className="productionRow"><strong>{partnerVerified.length}</strong><span>verified conversions</span></div>
          </article>;
        })}
      </section>
    </main>
  );
}
