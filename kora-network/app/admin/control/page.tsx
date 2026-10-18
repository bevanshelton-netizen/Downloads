import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getKoraRuntime } from '@/lib/runtime';
import { getIndependenceEngines } from '@/lib/independence';

export default async function ControlPlane() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (!profile || profile.role !== 'admin') redirect('/admin');

  const [{ count: channelCount }, { count: scheduleCount }, { count: productionCount }, { count: applicationCount }, { count: campaignCount }] = await Promise.all([
    supabase.from('live_channels').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('schedule_items').select('*', { count: 'exact', head: true }).gte('ends_at', new Date().toISOString()),
    supabase.from('productions').select('*', { count: 'exact', head: true }),
    supabase.from('creator_applications').select('*', { count: 'exact', head: true }).in('status', ['submitted', 'reviewing', 'waitlisted']),
    supabase.from('campaigns').select('*', { count: 'exact', head: true }),
  ]);

  const runtime = getKoraRuntime();
  const engines = getIndependenceEngines();
  const requiredEngines = engines.filter((engine) => engine.requiredForKora);
  const verifiedEngines = requiredEngines.filter((engine) => engine.status === 'verified');
  const checks = [
    ['Web application', `Primary: ${runtime.primary}`],
    ['Live streaming', runtime.streaming === 'configured' ? 'Configured' : 'Standby'],
    ['EPG / scheduling', 'Ready'],
    ['VOD / productions', 'Ready'],
    ['Database', runtime.database === 'configured' ? 'Configured' : 'Standby'],
    ['Provider independence', `Fallback: ${runtime.fallback}`],
  ];

  return (
    <main>
      <section className="subHero">
        <div className="eyebrow">KORA CONTROL PLANE</div>
        <h1>Network command centre.</h1>
        <p>One protected operations surface for broadcast, content, creators, monetisation and deployment readiness.</p>
      </section>

      <section className="grid three">
        <article className="panel"><span className="eyebrow">ACTIVE CHANNELS</span><h2>{channelCount ?? 0}</h2><p>Channels enabled for the public network.</p><Link className="secondary" href="/admin/schedule">Manage channels</Link></article>
        <article className="panel"><span className="eyebrow">UPCOMING EPG</span><h2>{scheduleCount ?? 0}</h2><p>Programme items still in the broadcast window.</p><Link className="secondary" href="/admin/schedule">Open master control</Link></article>
        <article className="panel"><span className="eyebrow">VOD CATALOGUE</span><h2>{productionCount ?? 0}</h2><p>Productions available to the operator layer.</p><Link className="secondary" href="/admin/moderation">Review content</Link></article>
        <article className="panel"><span className="eyebrow">CREATOR QUEUE</span><h2>{applicationCount ?? 0}</h2><p>Applications waiting for creator-acquisition decisions.</p><Link className="secondary" href="/admin/creators">Creator operations</Link></article>
        <article className="panel"><span className="eyebrow">CAMPAIGNS</span><h2>{campaignCount ?? 0}</h2><p>Advertising campaigns in the commercial layer.</p><Link className="secondary" href="/admin/campaigns">Commercial control</Link></article>
        <article className="panel"><span className="eyebrow">RUNTIME</span><h2>{runtime.primary}</h2><p>Primary runtime with an independent fallback path.</p><Link className="secondary" href="/admin/launch">Launch readiness</Link></article>
      </section>

      <section className="panel">
        <div className="sectionHead"><div><span className="eyebrow">READINESS MATRIX</span><h2>Production control</h2></div><Link className="secondary" href="/api/platform">Platform status API</Link></div>
        <div className="grid three">
          {checks.map(([name, status]) => <div className="productionRow" key={name}><strong>{name}</strong><span>{status}</span></div>)}
        </div>
        <p className="muted">A green control-plane status does not by itself certify content rights, payment credentials, stream health, or public deployment. Those remain explicit release gates.</p>
      </section>

      <section className="panel">
        <div className="sectionHead"><div><span className="eyebrow">IZAKHONO INDEPENDENCE</span><h2>{verifiedEngines.length}/{requiredEngines.length} required engines verified</h2></div><Link className="secondary" href="/api/health">Health API</Link></div>
        <div className="grid three">
          {engines.map((engine) => (
            <div className="productionRow" key={engine.engine}>
              <strong>{engine.engine.replaceAll('_', ' ')}</strong>
              <span>{engine.status} · {engine.provider}</span>
            </div>
          ))}
        </div>
        <p className="muted">Configured endpoints are not treated as independent until the corresponding first-party engine is externally deployed and verified. This dashboard is an operational readiness view, not a public-live claim.</p>
      </section>
    </main>
  );
}
