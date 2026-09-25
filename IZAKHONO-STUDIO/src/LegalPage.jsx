import React from 'react';

const PAGE_TITLES = {
  terms: 'Terms of Use',
  privacy: 'Privacy',
  refunds: 'Refunds & Cancellation',
  pricing: 'Pricing & Billing',
};

function BackLink() {
  return <a className="legal-back" href="/">← Back to IZAKHONO Creative Suite</a>;
}

function Pricing() {
  return (
    <>
      <h2>Clear pricing before checkout.</h2>
      <div className="legal-price-grid">
        <article><span>CREATIVE</span><strong>$5</strong><b>USD / 30-day access period</b><p>Core Creative Suite tools, excluding Gamer Studio.</p></article>
        <article><span>GAMER</span><strong>$15</strong><b>USD / 30-day access period</b><p>Includes the Creative Suite plus Gamer Studio and local-first Gamer Clip Lab.</p></article>
      </div>
      <p>The USD amounts above are the approved global list-price references. IZAKHONO PAY is currently ZAR-first. A local settlement amount must be explicitly approved and shown at checkout before a South African transaction is enabled. We do not hard-code an invented exchange rate.</p>
      <p><strong>Recurring billing is not yet verified.</strong> Until it is, a successful checkout will represent a 30-day access purchase that requires a new verified checkout for the next period. We will not silently auto-renew a customer.</p>
      <p>Expensive remote AI generation, remote rendering or unusually large hosted storage may use separate allowances, top-ups or future higher plans. Local-first editing and supported local rendering are designed to remain inside the base plan.</p>
    </>
  );
}

function Terms() {
  return (
    <>
      <h2>Use the suite to create. Keep responsibility for what you create.</h2>
      <p>IZAKHONO Creative Suite is provided by <strong>IZAKHONO AFRICA (PTY) LTD</strong>. The service includes browser-based creative tools and, on the Gamer plan, gaming creator workflows.</p>
      <h3>Access</h3>
      <p>Access starts only after a verified purchase or other authorised entitlement. Until recurring billing is technically and commercially verified, plan purchases are treated as 30-day renewable access periods rather than automatic recurring subscriptions.</p>
      <h3>Your content</h3>
      <p>You retain ownership of content you lawfully own. You are responsible for having the rights to upload, edit, publish, stream or distribute source media, music, logos, game footage, sponsor marks and other material.</p>
      <h3>Local-first workflows</h3>
      <p>Supported photo, gamer-project and gameplay-clip workflows are designed to process locally in the browser by default. Browser/device capability can affect codec support, export quality and performance.</p>
      <h3>Third-party services</h3>
      <p>External social networks, payment providers, AI providers and storage services remain separate services with their own terms. IZAKHONO does not promise that a third-party platform will accept every export format forever.</p>
      <h3>Abuse</h3>
      <p>Do not use the service to violate law, intellectual-property rights, platform rules, privacy rights or security controls, or to distribute malware or harmful content.</p>
    </>
  );
}

function Privacy() {
  return (
    <>
      <h2>Local-first where practical. Explicit when network services are used.</h2>
      <p>Core editor functions are designed to work locally where practical. Gamer Clip Lab v1 does not require gameplay footage to be uploaded in order to mark moments or perform supported browser-local exports.</p>
      <h3>Data we may need</h3>
      <p>When account and checkout are activated, we may need account identifiers, contact details, entitlement status and transaction references necessary to operate access, support and payment reconciliation.</p>
      <h3>Payments</h3>
      <p>IZAKHONO PAY routes supported online purchases to hosted iKhokha checkout. IZAKHONO Creative Suite does not need to capture card numbers, CVVs, banking passwords or OTPs.</p>
      <h3>Creative files</h3>
      <p>Local project files and local browser storage remain on the user device unless the user deliberately exports, shares or later enables an optional sync/storage feature.</p>
      <h3>Analytics and advertising identifiers</h3>
      <p>Behavioural advertising identifiers are not required for the core editor to function. Any future analytics or advertising integration must be disclosed before it is relied on for customer tracking.</p>
    </>
  );
}

function Refunds() {
  return (
    <>
      <h2>Cancellation must be understandable and lawful.</h2>
      <p>Nothing in this policy removes rights that cannot legally be waived under applicable consumer law.</p>
      <h3>Current billing mode</h3>
      <p>Recurring billing is not yet verified. Until it is, the intended commercial flow is a verified 30-day access purchase. A new purchase is required for a further period; there is no silent automatic renewal.</p>
      <h3>Refund requests</h3>
      <p>Refund requests will be assessed against applicable law, payment status, whether access was successfully delivered, material service faults and the extent of digital service use. A failed or duplicate verified payment must not be treated as a successful sale.</p>
      <h3>Future recurring billing</h3>
      <p>If recurring billing is introduced, the checkout and account experience must clearly state renewal terms and provide a cancellation path that stops future charges. Those terms are not treated as active until the recurring flow is verified end to end.</p>
    </>
  );
}

export default function LegalPage({ page }) {
  const key = PAGE_TITLES[page] ? page : 'terms';
  return (
    <main className="legal-page">
      <BackLink />
      <span className="suite-eyebrow">IZAKHONO CREATIVE SUITE • COMMERCIAL TRANSPARENCY</span>
      <h1>{PAGE_TITLES[key]}</h1>
      <div className="legal-content">
        {key === 'terms' && <Terms />}
        {key === 'privacy' && <Privacy />}
        {key === 'refunds' && <Refunds />}
        {key === 'pricing' && <Pricing />}
      </div>
      <nav className="legal-nav" aria-label="Commercial and legal pages">
        <a href="/terms">Terms</a>
        <a href="/privacy">Privacy</a>
        <a href="/refunds">Refunds & Cancellation</a>
        <a href="/pricing">Pricing & Billing</a>
      </nav>
      <p className="legal-merchant">Legal merchant: IZAKHONO AFRICA (PTY) LTD.</p>
    </main>
  );
}
