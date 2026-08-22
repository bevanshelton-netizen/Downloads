import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

type EventRow = {
  id: string;
  title: string;
  slug: string;
  starts_at: string;
  ends_at: string | null;
  event_mode: string;
  venue_name: string | null;
  venue_city: string | null;
  status: string;
  sales_enabled: boolean;
  artist_share_bps: number;
  settlement_hold_hours: number;
  currency: string;
};

type TierRow = { event_id: string; capacity: number; sold_count: number; reserved_count: number; price: number; name: string };
type SettlementRow = { event_id: string; gross_amount: number; beneficiary_amount: number; platform_amount: number; status: string; available_at: string };

function money(value: number, currency = 'ZAR') {
  return `${currency} ${value.toFixed(2)}`;
}

export default async function CreatorTicketDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/studio/tickets');

  const { data: creator } = await supabase.from('creators').select('id,name,verified').eq('owner_id', user.id).maybeSingle();
  if (!creator) {
    return <main><section className="subHero"><div className="eyebrow">KORA TICKETS</div><h1>Your live-event business starts with a KORA creator profile.</h1><p>Apply first so KORA can connect approved events, ticket settlements and payouts to the correct beneficiary.</p><Link className="primary" href="/creators/apply">Apply to KORA</Link></section></main>;
  }

  const [{ data: events, error: eventError }, { data: settlements, error: settlementError }] = await Promise.all([
    supabase.from('ticket_events').select('id,title,slug,starts_at,ends_at,event_mode,venue_name,venue_city,status,sales_enabled,artist_share_bps,settlement_hold_hours,currency').eq('creator_id', creator.id).order('starts_at', { ascending: false }),
    supabase.from('ticket_settlements').select('event_id,gross_amount,beneficiary_amount,platform_amount,status,available_at').eq('owner_id', user.id),
  ]);

  const eventRows = (events ?? []) as EventRow[];
  const eventIds = eventRows.map(event => event.id);
  let tiers: TierRow[] = [];
  if (eventIds.length) {
    const { data } = await supabase.from('ticket_tiers').select('event_id,capacity,sold_count,reserved_count,price,name').in('event_id', eventIds);
    tiers = (data ?? []) as TierRow[];
  }

  const settlementRows = (settlements ?? []) as SettlementRow[];
  const activeSettlements = settlementRows.filter(item => item.status !== 'reversed');
  const totalGross = activeSettlements.reduce((sum, item) => sum + Number(item.gross_amount), 0);
  const totalBeneficiary = activeSettlements.reduce((sum, item) => sum + Number(item.beneficiary_amount), 0);
  const totalKora = activeSettlements.reduce((sum, item) => sum + Number(item.platform_amount), 0);
  const pending = activeSettlements.filter(item => item.status === 'pending').reduce((sum, item) => sum + Number(item.beneficiary_amount), 0);
  const released = activeSettlements.filter(item => item.status === 'released').reduce((sum, item) => sum + Number(item.beneficiary_amount), 0);
  const now = Date.now();

  return (
    <main>
      <section className="subHero">
        <div className="eyebrow">KORA TICKETS • ARTIST / PROMOTER VIEW</div>
        <h1>See the room. See the money. Keep KORA in control of settlement.</h1>
        <p>This dashboard shows only your event-level commercial data. KORA keeps buyer identity, payment details, refunds, settlement release and payouts inside protected operations.</p>
        <div className="actions"><Link className="primary" href="/perform-live">Propose another live event</Link><Link className="secondary" href="/studio/earnings">Earnings & payouts</Link></div>
      </section>

      <section className="dashMain">
        {(eventError || settlementError) ? <div className="panel"><strong>KORA Tickets reporting is waiting for the production schema/configuration to be activated.</strong></div> : null}
        <div className="kpis">
          <div><small>Cleared ticket sales</small><b>{money(totalGross)}</b></div>
          <div><small>Your event share</small><b>{money(totalBeneficiary)}</b></div>
          <div><small>KORA share</small><b>{money(totalKora)}</b></div>
          <div><small>Your share on hold</small><b>{money(pending)}</b></div>
          <div><small>Your share released</small><b>{money(released)}</b></div>
        </div>

        <div className="panel">
          <div className="sectionHead"><div><h3>Your KORA ticket events</h3><p>Published and completed beneficiary events appear here. Draft setup, checkout controls, refunds and settlement release remain KORA-operated.</p></div><Link className="secondary" href="/tickets">View public marketplace</Link></div>
          {eventRows.length ? eventRows.map(event => {
            const eventTiers = tiers.filter(tier => tier.event_id === event.id);
            const eventSettlements = settlementRows.filter(item => item.event_id === event.id);
            const liveSettlements = eventSettlements.filter(item => item.status !== 'reversed');
            const gross = liveSettlements.reduce((sum, item) => sum + Number(item.gross_amount), 0);
            const beneficiary = liveSettlements.reduce((sum, item) => sum + Number(item.beneficiary_amount), 0);
            const kora = liveSettlements.reduce((sum, item) => sum + Number(item.platform_amount), 0);
            const capacity = eventTiers.reduce((sum, tier) => sum + Number(tier.capacity), 0);
            const sold = eventTiers.reduce((sum, tier) => sum + Number(tier.sold_count), 0);
            const reserved = eventTiers.reduce((sum, tier) => sum + Number(tier.reserved_count), 0);
            const pendingItems = liveSettlements.filter(item => item.status === 'pending');
            const nextRelease = pendingItems.map(item => new Date(item.available_at).getTime()).filter(value => value > now).sort((a,b) => a-b)[0];
            const location = event.event_mode === 'online' ? 'Online' : [event.venue_name, event.venue_city].filter(Boolean).join(' • ') || event.event_mode;
            return <div className="moderationItem" key={event.id}>
              <div>
                <strong>{event.title}</strong>
                <p>{new Date(event.starts_at).toLocaleString('en-ZA')} • {location} • {event.status} • sales {event.sales_enabled ? 'OPEN' : 'LOCKED'}</p>
                <p>Your share {(event.artist_share_bps / 100).toFixed(1)}% • KORA {(100 - event.artist_share_bps / 100).toFixed(1)}% • hold {event.settlement_hold_hours}h after event end/start</p>
                <p>{capacity ? `${sold} sold • ${reserved} reserved • ${capacity} capacity` : 'Ticket tier inventory is available while the event is published.'}</p>
              </div>
              <div>
                <strong>{money(gross, event.currency)} gross</strong>
                <p>You {money(beneficiary, event.currency)} • KORA {money(kora, event.currency)}</p>
                <p>{nextRelease ? `Next release window: ${new Date(nextRelease).toLocaleString('en-ZA')}` : pendingItems.length ? 'Settlement release window reached; KORA operations review required.' : 'No pending settlement.'}</p>
                <Link className="secondary" href={`/tickets/${event.slug}`}>Open event →</Link>
              </div>
            </div>;
          }) : <div><p>No published KORA ticket event is linked to your creator account yet.</p><Link className="primary" href="/perform-live">Apply to perform live</Link></div>}
        </div>

        <div className="panel"><h3>What you can and cannot control</h3><p><strong>You can see:</strong> event status, ticket inventory, gross ticket sales, your contracted event share, KORA's share, hold/release state and your resulting earnings.</p><p><strong>KORA controls:</strong> checkout, PayFast confirmation, ticket issuance, attendee/payment data, refund confirmation, settlement release and payout processing. This protects both the fan and the performer.</p></div>
      </section>
    </main>
  );
}
