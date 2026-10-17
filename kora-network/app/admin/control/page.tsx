import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getKoraRuntime } from '@/lib/runtime';

export default async function ControlPlane() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (!profile || profile.role !== 'admin') redirect('/admin');

  const [{ count: channelCount }, { count: scheduleCount }, { count: productionCount }, { count: creatorCount }, { count: campaignCount }] = await Promise.all([
    supabase.from('live_channels').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('schedule_items').select('*', { count: 'exact', head: true }).gte('ends_at', new Date().toISOString()),
    supabase.from('productions').select('*', { count: 'exact', head: true }),
    supabase.from('creators').select('*', { count: 'exact', head: true }),
    supabase.from('ad_campaigns').select('*', { count: 'exact', head: true }),
  ]);

  const runtime = getKoraRuntime();
  const checks = [
    ['Web application', 'Ready'],
    ['Live TV / HLS', runtime.videoProvider === 'mock' ? 'Provider configured as mock' : 'Provider configured'],
    ['EPG / scheduling', 'Ready'],
    ['VOD / productions', 'Ready'],
    ['Monetisation', 'Payment adapters configured'],
    ['Provider independence', runtime.runtimeMode === 'dual' ? 'Dual runtime' : runtime.runtimeMode],
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
        <article className="panel"><span className="eyebrow">CREATORS</span><h2>{creatorCount ?? 0}</h2><p>Creator records connected to the network.</p><Link className="secondary" href="/admin/creators">Creator operations</Link></article>
        <article className="panel"><span className="eyebrow">CAMPAIGNS</span><h2>{campaignCount ?? 0}</h2><p>Advertising campaigns in the commercial layer.</p><Link className="secondary" href="/admin/campaigns">Commercial control</Link></article>
        <article className="panel"><span className="eyebrow">RUNTIME</span><h2>{runtime.runtimeMode}</h2><p>Provider-independent application runtime configuration.</p><Link className="secondary" href="/admin/launch">Launch readiness</Link></article>
      </section>

      <section className="panel">
        <div className="sectionHead"><div><span className="eyebrow">READINESS MATRIX</span><h2>Production control</h2></div><Link className="secondary" href="/api/platform">Platform status API</Link></div>
        <div className="grid three">
          {checks.map(([name, status]) => <div className="productionRow" key={name}><strong>{name}</strong><span>{status}</span></div>)}
        </div>
        <p className="muted">A green control-plane status does not by itself certify content rights, payment credentials, stream health, or public deployment. Those remain explicit release gates.</p>
      </section>
    </main>
  );
}
