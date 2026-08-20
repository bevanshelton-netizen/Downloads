'use client';

import { useState } from 'react';

export default function PurchaseButton({ productionId, label }: { productionId: string; label: string }) {
  const [busy, setBusy] = useState(false);

  async function purchase() {
    setBusy(true);
    try {
      const response = await fetch('/api/payfast/purchase/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productionId }),
      });
      const checkout = await response.json();
      if (!response.ok) throw new Error(checkout.error || 'Checkout unavailable');

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = checkout.action;
      Object.entries(checkout.fields as Record<string, string>).forEach(([name, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Checkout unavailable');
      setBusy(false);
    }
  }

  return <button className="primary" type="button" onClick={purchase} disabled={busy}>{busy ? 'Opening PayFast…' : label}</button>;
}
