import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getLaunchReadiness } from '@/lib/launch-readiness';
import { getPlatformReleaseState } from '@/lib/platform-state';
import { updateReleaseState } from './actions';

const labels: Record<string,string> = {
  appUrl: 'Production HTTPS domain',
  supabaseConfigured: 'Supabase credentials configured',
  databaseReachable: 'Production database reachable',
  schemaCurrent: 'Database migrations current',
  adminBootstrapped: 'At least one KORA administrator',
  channelSeeded: 'Live-channel seed present',
  payfastCredentials: 'PayFast credentials configured',
  payfastLive: 'PayFast switched to live mode',
  cloudflareStream: 'Cloudflare Stream configured',
  rewardVerifierSecret: 'Reward verification secret hardened',
  operatorIdentity: 'Operating entity published',
  supportContacts: 'Support/privacy/rights contacts published',
  legalApproved: 'Legal review signed off',
  regulatoryApproved: 'Regulatory position signed off',
  childSafetyApproved: 'Child-safety operations signed off',
  payoutOperationsApproved: 'Payout/KYC operations signed off',
  backupOperationsApproved: 'Backup/restore operations signed off',
  incidentResponseApproved: 'Incident response process signed off',
  publicLaunchEnabled: 'Public launch switch enabled',
};

export default async function LaunchControl({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/admin/launch');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') redirect('/');

  const [{ error, saved }, readiness, release] = await Promise.all([
    searchParams,
    getLaunchReadiness(),
    getPlatformReleaseState(),
  ]);

  return (
    <main>
      <section className="subHero">
        <div className="eyebrow">KORA LAUNCH CONTROL</div>
        <h1>Nothing goes public by accident.</h1>
        <p>This console is the final operational gate. Infrastructure, money, legal, child-safety, backup and incident-response checks must pass before the public launch switch can be enabled.</p>
      </section>
      <section className="dashMain">
        {error ? <div className="panel"><strong>{error}</strong></div> : null}
        {saved ? <div className="panel"><strong>Release controls saved.</strong></div> : null}
        <div className="kpis">
          <div><small>Production readiness</small><b>{readiness.productionReady ? 'READY' : 'BLOCKED'}</b></div>
          <div><small>Release stage</small><b>{release.release_name.replaceAll('_',' ')}</b></div>
          <div><small>Schema</small><b>v{readiness.details.schemaVersion}</b></div>
          <div><small>Administrators</small><b>{readiness.details.adminCount}</b></div>
        </div>

        <div className="panel">
          <h3>Go-live preflight</h3>
          <div className="productionList">
            {Object.entries(readiness.checks).map(([name, ok]) => (
              <div className="productionRow" key={name}><strong>{labels[name] || name}</strong><span>{ok ? 'PASS' : 'BLOCKING'}</span></div>
            ))}
          </div>
        </div>

        <form action={updateReleaseState} className="panel formPanel">
          <h3>Release switches</h3>
          <p>These controls fail closed. If migration 013 is missing or the database is unavailable, public activation remains off.</p>
          <label>Release stage<select name="release_name" defaultValue={release.release_name}><option value="private_beta">Private beta</option><option value="public_beta">Public beta</option><option value="general_availability">General availability</option></select></label>
          <label className="check"><input type="checkbox" name="public_launch_enabled" defaultChecked={release.public_launch_enabled} /> Enable public launch</label>
          <label className="check"><input type="checkbox" name="public_signups_enabled" defaultChecked={release.public_signups_enabled} /> Allow public viewer account creation</label>
          <label className="check"><input type="checkbox" name="creator_applications_enabled" defaultChecked={release.creator_applications_enabled} /> Accept new creator applications</label>
          <label className="check"><input type="checkbox" name="advertiser_campaigns_enabled" defaultChecked={release.advertiser_campaigns_enabled} /> Allow advertisers to create campaigns</label>
          <label className="check"><input type="checkbox" name="maintenance_mode" defaultChecked={release.maintenance_mode} /> Maintenance mode</label>
          <label>Maintenance message<textarea name="maintenance_message" rows={2} maxLength={500} defaultValue={release.maintenance_message || ''} /></label>
          <label>Operations note<textarea name="note" rows={2} maxLength={500} placeholder="Reason for this release-state change" /></label>
          <button className="primary">Save guarded release state</button>
        </form>
      </section>
    </main>
  );
}
