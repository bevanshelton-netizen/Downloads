'use client';

import { useState } from 'react';

export default function TicketBuyButton({
  tierId,
  label,
  disabled = false,
}: {
  tierId: string;
  label: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function buy() {
    setBusy(true);
    try {
      const response = await fetch('/api/payfast/ticket', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tierId, quantity: 1 }),
      });
      const checkout = await response.json();

      if (response.status === 401) {
        window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      if (!response.ok) throw new Error(checkout.error || 'Checkout unavailable');

      if (checkout.redirectUrl) {
        window.location.assign(checkout.redirectUrl);
        return;
      }

      if (!checkout.action || !checkout.fields) throw new Error('Checkout unavailable');

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

  return (
    <button className="primary" type="button" disabled={disabled || busy} onClick={buy}>
      {busy ? 'Opening secure checkout…' : label}
    </button>
  );
}
