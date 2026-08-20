import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getProductionReadiness } from '@/lib/readiness';

const labels: Record<string,string> = {
  appUrl: 'Production HTTPS domain',
  supabaseConfigured: 'Supabase credentials configured',
  databaseReachable: 'Production database reachable',
  databaseSchemaCurrent: 'Production database schema current',
  payfastCredentials: 'PayFast credentials configured',
  payfastLive: 'PayFast live mode enabled',
  cloudflareStream: 'Cloudflare Stream configured',
  rewardVerifierSecret: 'Trusted reward verifier secret configured',
  operatorIdentity: 'Approved public operating entity',
  supportContacts: 'Support / privacy / rights contacts',
  legalApproved: 'Professional legal review approved',
  regulatoryApproved: 'Regulatory/compliance approval complete',
  childSafetyApproved: 'Child-safety acceptance complete',
  payoutOperationsApproved: 'Payout/KYC operations accepted',
  paymentAcceptanceApproved: 'Payment sandbox/live acceptance tests passed',
  streamingAcceptanceApproved: 'Streaming/upload/live-TV acceptance tests passed',
  adOperationsApproved: 'Advertising/reward operations acceptance tests passed',
  monitoringApproved: 'Production monitoring/error handling accepted',
  backupApproved: 'Database backup/restore process accepted',
};

export default async function LaunchControl() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/admin/launch');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (!profile || profile.role !== 'admin') redirect('/');

  const readiness = await getProductionReadiness();
  const entries = Object.entries(readiness.checks);
  const passed = entries.filter(([,value]) => value).length;

  return <main>
    <section className="subHero">
      <div className="eyebrow">KORA LAUNCH CONTROL</div>
      <h1>{readiness.productionReady ? 'Production gate is green.' : 'Production launch remains locked.'}</h1>
      <p>{passed} of {entries.length} launch checks currently pass. A red check is a blocker, not a warning to bypass.</p>
      <div className="actions"><Link className="secondary" href="/admin">← Operations</Link><Link className="secondary" href="/api/readiness">Readiness JSON</Link></div>
    </section>
    <section className="dashMain">
      <div className="kpis"><div><small>Checks passed</small><b>{passed}/{entries.length}</b></div><div><small>Required DB schema</small><b>v{readiness.details.requiredSchemaVersion}</b></div><div><small>Detected DB schema</small><b>{readiness.details.detectedSchemaVersion ?? '—'}</b></div></div>
      <div className="panel">
        <h3>Go-live gates</h3>
        {entries.map(([key,value]) => <div className="productionRow" key={key}><strong>{labels[key] || key}</strong><span>{value ? '✓ PASS' : '✕ BLOCKED'}</span></div>)}
      </div>
      <div className="panel"><h3>Production modes</h3><p>PayFast: <strong>{readiness.details.payfastMode}</strong> • Video: <strong>{readiness.details.videoProvider}</strong></p><p>KORA should be publicly marketed as live only when every check above passes and the end-to-end production smoke tests have been repeated against the real domain.</p></div>
    </section>
  </main>;
}
