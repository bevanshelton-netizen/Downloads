'use client';

import { useState } from 'react';

export default function SubscribeButton({ planCode, label }: { planCode: string; label: string }) {
  const [busy, setBusy] = useState(false);

  async function subscribe() {
    setBusy(true);
    try {
      const response = await fetch('/api/payfast/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ planCode }),
      });
      const checkout = await response.json();
      if (response.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent('/membership')}`;
        return;
      }
      if (response.status === 409) {
        window.location.href = '/account?message=You%20already%20have%20an%20active%20membership';
        return;
      }
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

  return <button className="primary" type="button" onClick={subscribe} disabled={busy}>{busy ? 'Opening PayFast…' : label}</button>;
}
