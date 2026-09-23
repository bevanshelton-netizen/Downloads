import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function pct(n:number,d:number) {
  return d > 0 ? ((n/d)*100).toFixed(1) + '%' : '—';
}

export default async function PartnerPilotControlRoom() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/partner/pilot');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const staff = Boolean(profile && ['moderator','admin'].includes(String(profile.role)));

  const { data: memberships } = await supabase
    .from('partner_memberships')
    .select('partner_id,role')
    .eq('user_id', user.id);

  let partnerIds = (memberships || []).map(m => m.partner_id);
  if (staff) {
    const { data: allPartners } = await supabase.from('media_partners').select('id');
    partnerIds = (allPartners || []).map(p => p.id);
  }

  if (!partnerIds.length) {
    return <main><section className="subHero"><div className="eyebrow">KORA PILOT CONTROL ROOM</div><h1>No pilot workspace is assigned to this account.</h1><p>Access is created after KORA approves the commercial relationship.</p><div className="actions"><Link className="secondary" href="/partners/pilot">View the 90-day pilot framework</Link></div></section></main>;
  }

  const { data: pilots, error: pilotError } = await supabase
    .from('partner_pilots')
    .select('id,partner_id,name,status,territory,starts_at,ends_at,attribution_model,commercial_model,success_metrics')
    .in('partner_id', partnerIds)
    .order('created_at', { ascending:false });

  if (pilotError) {
    return <main><section className="subHero"><div className="eyebrow">KORA PILOT CONTROL ROOM</div><h1>Pilot database upgrade required.</h1><p>The partner gateway is available, but migration 024_partner_pilot.sql must be applied before the pilot control room can read live pilot data.</p><div className="actions"><Link className="secondary" href="/partner">Partner Desk</Link><Link className="secondary" href="/partners/pilot">Pilot Framework</Link></div></section></main>;
  }

  const pilotIds = (pilots || []).map(p => p.id);
  if (!pilotIds.length) {
    return <main><section className="subHero"><div className="eyebrow">KORA PILOT CONTROL ROOM</div><h1>No commercial pilot has been activated yet.</h1><p>The control room is ready. A pilot record is created only after KORA and the partner agree the approved journey, territory, attribution and commercial framework.</p><div className="actions"><Link className="secondary" href="/partners/pilot">Review the 90-day framework</Link><Link className="secondary" href="/partner">Partner Desk</Link></div></section></main>;
  }

  const [{ data: referrals }, { data: conversions }, { data: milestones }] = await Promise.all([
    supabase.from('partner_referrals').select('id,pilot_id,partner_id,country_code,occurred_at').in('pilot_id', pilotIds).order('occurred_at',{ascending:false}).limit(5000),
    supabase.from('partner_conversions').select('id,pilot_id,partner_id,event_type,amount,currency,status,occurred_at').in('pilot_id', pilotIds).order('occurred_at',{ascending:false}).limit(5000),
    supabase.from('partner_pilot_milestones').select('id,pilot_id,day_number,review_date,status,decision,completed_at').in('pilot_id', pilotIds).order('day_number'),
  ]);

  return (
    <main>
      <section className="subHero">
        <div className="eyebrow">KORA PILOT CONTROL ROOM</div>
        <h1>Commercial evidence from Day 0 to Day 90.</h1>
        <p>Only attributable KORA hand-offs and partner-reported conversion events are shown. Revenue is counted as verified only after reconciliation.</p>
        <div className="actions"><Link className="secondary" href="/partners/pilot">Public Pilot Framework</Link><Link className="secondary" href="/partner">Partner Desk</Link></div>
      </section>

      <section className="grid two">
        {(pilots || []).map(pilot => {
          const r = (referrals || []).filter(x => x.pilot_id === pilot.id);
          const c = (conversions || []).filter(x => x.pilot_id === pilot.id);
          const verified = c.filter(x => x.status === 'verified');
          const firstPayments = verified.filter(x => x.event_type === 'first_payment');
          const revenue = verified.reduce<Record<string,number>>((sum,x) => {
            const code = String(x.currency || 'ZAR');
            sum[code] = (sum[code] || 0) + Number(x.amount || 0);
            return sum;
          }, {});
          const money = Object.entries(revenue).map(([currency,amount]) =>
            new Intl.NumberFormat('en-ZA',{style:'currency',currency}).format(amount)
          ).join(' + ') || 'R0.00';
          const ms = (milestones || []).filter(x => x.pilot_id === pilot.id);

          return <article className="panel" key={pilot.id}>
            <small>{pilot.status} • {pilot.territory} • {String(pilot.attribution_model).replaceAll('_',' ')}</small>
            <h2 style={{marginBottom:8}}>{pilot.name}</h2>
            <p>{pilot.starts_at ? new Date(pilot.starts_at).toLocaleDateString('en-ZA') : 'Start date pending'} → {pilot.ends_at ? new Date(pilot.ends_at).toLocaleDateString('en-ZA') : 'End date pending'}</p>

            <div className="grid three" style={{marginTop:18}}>
              <div className="productionRow"><strong>{r.length}</strong><span>tracked referrals</span></div>
              <div className="productionRow"><strong>{verified.length}</strong><span>verified conversions</span></div>
              <div className="productionRow"><strong>{pct(firstPayments.length,r.length)}</strong><span>first-payment conversion</span></div>
            </div>
            <div className="productionRow" style={{marginTop:10}}><strong>{money}</strong><span>verified attributable revenue</span></div>

            <div style={{marginTop:22,display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:10}}>
              {[30,60,90].map(day => {
                const m = ms.find(x => x.day_number === day);
                return <div key={day} style={{padding:14,border:'1px solid rgba(255,255,255,.12)',borderRadius:16}}>
                  <small>DAY {day}</small>
                  <div style={{fontWeight:900,marginTop:6}}>{m?.status || 'pending'}</div>
                  <p style={{fontSize:13,opacity:.8}}>{m?.decision || (m?.review_date ? 'Review '+m.review_date : 'Review not scheduled')}</p>
                </div>;
              })}
            </div>
          </article>;
        })}
      </section>
    </main>
  );
}
