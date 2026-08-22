import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import styles from './tickets.module.css';

type TicketEvent = {
  id: string;
  title: string | null;
  slug: string | null;
  description: string | null;
  starts_at: string | null;
  event_mode: string | null;
  status: string | null;
  sales_enabled: boolean | null;
};

function eventDate(value: string | null) {
  if (!value) return 'Date to be announced';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date to be announced';
  return date.toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' });
}

async function loadTicketEvents() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('ticket_events')
      .select('id,title,slug,description,starts_at,event_mode,status,sales_enabled')
      .in('status', ['published', 'postponed', 'cancelled', 'completed'])
      .order('starts_at');

    if (error) return [];
    return ((data ?? []) as TicketEvent[]).filter((event) => event.id && event.slug && event.title);
  } catch {
    // The public marketplace must remain available while production data services recover.
    return [];
  }
}

export default async function Tickets() {
  const events = await loadTicketEvents();

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.eyebrow}>KORA TICKETS • AFRICA ON STAGE</div>
        <h1>
          Book the room.<br />
          <span>Unlock the stream.</span>
        </h1>
        <p>
          KORA’s own marketplace for African concerts, festivals and cultural events. Event previews can open now; real
          sales remain locked until rights, safety, inventory and production PayFast checks pass.
        </p>
      </section>

      <section className={styles.grid}>
        {events.length ? (
          events.map((event) => {
            const description = event.description?.trim() || 'More event details will be announced soon.';
            const mode = event.event_mode?.trim().toUpperCase() || 'EVENT';
            const status = event.status?.trim().toUpperCase() || 'PREVIEW';

            return (
              <Link className={styles.card} href={`/tickets/${event.slug}`} key={event.id}>
                <div className={styles.poster}>
                  <b>{status}</b>
                  <span>♫</span>
                </div>
                <div className={styles.body}>
                  <div className={styles.meta}>
                    {eventDate(event.starts_at)} • {mode}
                  </div>
                  <h2>{event.title}</h2>
                  <p>
                    {description.slice(0, 160)}
                    {description.length > 160 ? '…' : ''}
                  </p>
                  <strong>{event.sales_enabled ? 'View tickets →' : 'Event preview →'}</strong>
                </div>
              </Link>
            );
          })
        ) : (
          <article className={styles.card}>
            <div className={styles.poster}>
              <b>FOUNDING EVENTS</b>
              <span>♪</span>
            </div>
            <div className={styles.body}>
              <h2>The first KORA stages are being prepared.</h2>
              <p>Artists and venues can apply now. Verified events will appear here with venue and online ticket options.</p>
              <Link className="primary" href="/perform-live">
                Bring your event to KORA
              </Link>
            </div>
          </article>
        )}
      </section>
    </main>
  );
}
