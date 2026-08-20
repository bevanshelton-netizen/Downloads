import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { moderateProduction, resolveContentReport } from './actions';

export default async function Moderation({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (!profile || !['moderator', 'admin'].includes(profile.role)) redirect('/');
  const { error } = await searchParams;

  const { data: queue } = await supabase.from('productions').select('id,title,synopsis,age_rating,status,created_at').eq('status', 'review').order('created_at');
  const { data: reports } = await supabase.from('content_reports').select('id,reason,details,status,created_at,production_id,episode_id').eq('status', 'open').order('created_at');

  return (
    <main>
      <section className="subHero"><div className="eyebrow">KORA OPERATIONS</div><h1>Human moderation.</h1><p>Nothing reaches publication merely because it was uploaded. Review rights, safety, age rating and the no-pornography rule before approval.</p></section>
      <section className="dashMain">
        {error ? <div className="panel"><strong>{error}</strong></div> : null}
        <div className="panel"><h3>Productions awaiting review</h3>{(queue ?? []).length ? (queue ?? []).map((item) => (
          <form action={moderateProduction} className="moderationItem" key={item.id}>
            <input type="hidden" name="production_id" value={item.id} />
            <div><strong>{item.title}</strong><p>{item.synopsis || 'No synopsis'} • Rating {item.age_rating || 'unrated'}</p></div>
            <label>Review note<textarea name="reason" rows={2} placeholder="Reason or changes required" /></label>
            <div className="actions"><button className="primary" name="decision" value="approved">Approve & publish</button><button className="secondary" name="decision" value="needs_changes">Needs changes</button><button className="secondary" name="decision" value="rejected">Reject</button></div>
          </form>
        )) : <p>Moderation queue is clear.</p>}</div>

        <div className="panel"><h3>Open viewer reports</h3>{(reports ?? []).length ? (reports ?? []).map((report) => (
          <form action={resolveContentReport} className="moderationItem" key={report.id}>
            <input type="hidden" name="report_id" value={report.id} />
            <div><strong>{report.reason}</strong><p>{report.details || 'No details'} • {new Date(report.created_at).toLocaleString('en-ZA')}</p><small>{report.production_id ? `Production ${report.production_id}` : ''}{report.episode_id ? ` • Episode ${report.episode_id}` : ''}</small></div>
            <div className="actions"><button className="primary" name="resolution" value="resolved">Mark resolved</button><button className="secondary" name="resolution" value="dismissed">Dismiss</button></div>
          </form>
        )) : <p>No open reports.</p>}</div>
      </section>
    </main>
  );
}
