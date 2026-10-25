'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';

export default function CommercialEnquiryPage() {
  const [status, setStatus] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fields = {
      name: String(form.get('name') || '').trim(),
      company: String(form.get('company') || '').trim(),
      email: String(form.get('email') || '').trim(),
      phone: String(form.get('phone') || '').trim(),
      package: String(form.get('package') || 'Custom').trim(),
      territory: String(form.get('territory') || '').trim(),
      timing: String(form.get('timing') || '').trim(),
      objective: String(form.get('objective') || '').trim(),
    };

    if (!fields.name || !fields.company || !fields.email || !fields.objective) {
      setStatus('Please complete your name, company, email and campaign objective.');
      return;
    }

    const body = [
      `Name: ${fields.name}`,
      `Company: ${fields.company}`,
      `Email: ${fields.email}`,
      `Phone: ${fields.phone || 'Not supplied'}`,
      `Package: ${fields.package}`,
      `Territory: ${fields.territory || 'To be discussed'}`,
      `Timing: ${fields.timing || 'To be discussed'}`,
      '',
      'Campaign objective:',
      fields.objective,
      '',
      'Sent from the KORA commercial enquiry page.',
    ].join('\n');

    const subject = encodeURIComponent(`KORA Commercial Enquiry — ${fields.company}`);
    const mailto = `mailto:info@streamkoraafrica.com?subject=${subject}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
    try {
      await navigator.clipboard.writeText(body);
      setStatus('Your enquiry is prepared. Your email app should open; the enquiry text has also been copied.');
    } catch {
      setStatus('Your enquiry is prepared. Your email app should open with the enquiry details.');
    }
  };

  const packageOptions = useMemo(() => ['STARTER — R7,500/month', 'PREMIUM — R25,000/month', 'GLOBAL — R75,000/month', 'GLOBAL EXCLUSIVE — from R250,000', 'Specialist / custom campaign'], []);

  return (
    <main style={{ minHeight: '100vh', background: '#07080d', color: '#fff' }}>
      <section style={{ width: 'min(900px,92vw)', margin: '0 auto', padding: '72px 0 30px' }}>
        <div style={{ color: '#e6c76b', fontSize: 11, fontWeight: 900, letterSpacing: '.18em' }}>KORA COMMERCIAL DESK</div>
        <h1 style={{ fontSize: 'clamp(2.8rem,7vw,6rem)', lineHeight: .92, letterSpacing: '-.06em', margin: '14px 0 20px' }}>START A<br /><span style={{ color: '#e6c76b' }}>COMMERCIAL CONVERSATION.</span></h1>
        <p style={{ color: '#c7ccd7', fontSize: 18, lineHeight: 1.65, maxWidth: 760 }}>Tell KORA what you want to achieve. We will use the information to shape the appropriate advertising, sponsorship or media-partnership proposal. Prices shown on the rate card are starting points, not guaranteed inventory.</p>
      </section>

      <section style={{ width: 'min(900px,92vw)', margin: '0 auto', paddingBottom: 80 }}>
        <form onSubmit={submit} style={{ display: 'grid', gap: 14, padding: 28, border: '1px solid #ffffff18', borderRadius: 28, background: '#ffffff07' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
            <label>Name<input name="name" required placeholder="Your name" /></label>
            <label>Company<input name="company" required placeholder="Company / organisation" /></label>
            <label>Email<input name="email" type="email" required placeholder="name@company.com" /></label>
            <label>Phone<input name="phone" placeholder="Optional" /></label>
          </div>
          <label>Preferred package<select name="package" defaultValue={packageOptions[0]}>{packageOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
            <label>Territory<input name="territory" placeholder="South Africa, Africa, diaspora, global…" /></label>
            <label>Campaign timing<input name="timing" placeholder="Launch date / campaign period" /></label>
          </div>
          <label>Campaign objective<textarea name="objective" required rows={7} placeholder="What are you promoting, who are you trying to reach, and what outcome matters most?" /></label>
          <button type="submit" style={{ border: 0, borderRadius: 999, padding: '15px 22px', background: 'linear-gradient(135deg,#f1d47b,#c79a3d)', color: '#17130a', fontWeight: 900, cursor: 'pointer' }}>Prepare Commercial Enquiry →</button>
          {status ? <p role="status" style={{ color: '#9ff7e7', lineHeight: 1.5 }}>{status}</p> : null}
          <p style={{ color: '#8f96a4', fontSize: 12, lineHeight: 1.5 }}>The form prepares a direct email to info@streamkoraafrica.com and does not claim that the KORA mailbox is live until the mail acceptance gates are verified.</p>
        </form>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 18 }}><Link href="/advertise/rate-card" style={{ color: '#fff' }}>← View rate card</Link><Link href="/advertise" style={{ color: '#fff' }}>Explore advertising →</Link></div>
      </section>
    </main>
  );
}
