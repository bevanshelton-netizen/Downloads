'use client';

import { useEffect, useState } from 'react';
import PurchaseButton from './PurchaseButton';

export default function PurchaseGate({
  productionId,
  price,
  paymentStatus,
}: {
  productionId: string;
  price: number;
  paymentStatus?: string;
}) {
  const [waiting, setWaiting] = useState(paymentStatus === 'success');
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (paymentStatus !== 'success') return;
    let cancelled = false;
    let attempts = 0;

    const check = async () => {
      attempts += 1;
      try {
        const response = await fetch(`/api/purchases/entitlement?productionId=${encodeURIComponent(productionId)}`, { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json() as { entitled?: boolean };
          if (data.entitled && !cancelled) {
            window.location.replace(window.location.pathname);
            return;
          }
        }
      } catch {
        // PayFast ITN can arrive shortly after browser return; keep polling briefly.
      }
      if (!cancelled && attempts < 12) window.setTimeout(check, 2500);
      else if (!cancelled) {
        setWaiting(false);
        setTimedOut(true);
      }
    };

    void check();
    return () => { cancelled = true; };
  }, [paymentStatus, productionId]);

  if (waiting) return <div className="panel"><strong>Payment returned successfully.</strong><p>Waiting for PayFast's secure server confirmation before unlocking the programme…</p></div>;

  return <div className="panel formPanel">
    {paymentStatus === 'cancelled' ? <p><strong>Checkout was cancelled.</strong> No entitlement has been granted.</p> : null}
    {timedOut ? <p><strong>We have not received final PayFast confirmation yet.</strong> You can safely check again later; KORA will not unlock or record revenue until the verified ITN arrives.</p> : null}
    <PurchaseButton productionId={productionId} label={`Unlock for R${price.toFixed(2)}`} />
    <small>Price and entitlement are verified server-side. Never enter an Internet-banking password, card PIN, CVV or OTP into KORA itself.</small>
  </div>;
}
