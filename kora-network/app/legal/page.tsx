import Link from 'next/link';

export default function Legal() {
  return (
    <main>
      <section className="subHero">
        <div className="eyebrow">KORA LEGAL & TRUST</div>
        <h1>Clear rules for viewers, creators and brands.</h1>
        <p>These launch terms explain how KORA accounts, payments, content, rewards, advertising, creator rights and privacy are handled.</p>
      </section>

      <section className="dashMain legalCopy">
        <article className="panel" id="terms">
          <h2>Terms of use</h2>
          <p>By creating an account or using KORA, you agree to use the service lawfully, respect intellectual-property rights, avoid fraud or platform manipulation, and follow KORA content and community rules. Accounts may be restricted or suspended for abuse, payment fraud, automated viewing, reward manipulation, rights violations, unlawful conduct or serious safety violations.</p>
          <p>KORA may change catalogue availability, channel schedules, features and pricing. Paid access applies only to the product, period or title stated at checkout. Service interruptions may occur for maintenance, provider outages, security work or circumstances outside KORA's reasonable control.</p>
        </article>

        <article className="panel" id="privacy">
          <h2>Privacy notice</h2>
          <p>KORA processes account details, authentication data, viewing activity, creator and advertiser records, payment status, moderation records, device or session signals used for security, and wallet or reward records needed to operate the platform. Payment card details are handled by the payment provider rather than stored by KORA.</p>
          <p>Data is used to deliver accounts and content, secure the service, prevent fraud, measure campaigns, calculate eligible rewards, administer creator earnings, process support and payouts, and comply with lawful obligations. Access to sensitive operational data is restricted by role and server-side controls. Users may contact KORA to request appropriate access, correction or deletion subject to legal, accounting, fraud-prevention and contractual retention requirements.</p>
        </article>

        <article className="panel" id="creator-agreement">
          <h2>Creator agreement</h2>
          <p>Creators retain ownership of their original intellectual property unless a separate written agreement states otherwise. By submitting content, the creator grants KORA the rights necessary to host, encode, stream, promote, schedule and monetise approved content on the platform for the period it remains authorised for distribution.</p>
          <p>Creators must control the rights they submit, including music, performances, trademarks, footage and releases. Pornography and explicit sexual content are prohibited. All content is subject to moderation, age rating, rights checks and removal where required. Creator earnings become available only when tied to cleared platform revenue and an authorised allocation; projected or uncleared revenue is not withdrawable income.</p>
        </article>

        <article className="panel" id="advertiser-terms">
          <h2>Advertiser terms</h2>
          <p>Advertisers are responsible for lawful, accurate and appropriately substantiated claims. KORA may reject campaigns that conflict with brand-safety, child-safety, content, legal or platform integrity requirements. Campaign budgets and viewer reward allocations are separate controls: a planned reward amount does not become payable until advertiser funds have cleared and KORA has funded an eligible reward pool.</p>
          <p>Campaign measurement may include verified impressions, clicks and completions. Invalid, automated, duplicated or manipulated events may be excluded. Advertisers may not require or encourage viewers to create false activity, multiple accounts or deceptive engagement.</p>
        </article>

        <article className="panel" id="refunds">
          <h2>Refund and cancellation policy</h2>
          <p>Subscription cancellation stops future recurring billing once cancellation is processed by the payment provider; access already paid for may remain available through the current paid period unless law or a specific offer requires otherwise. Pay-per-view purchases are normally final once paid access has been successfully delivered.</p>
          <p>If a duplicate charge, technical failure or incorrect charge is confirmed, KORA will investigate and, where appropriate, issue a correction or refund through the original payment channel. Nothing in this policy removes rights that cannot legally be excluded.</p>
        </article>

        <article className="panel" id="content-policy">
          <h2>Content and safety policy</h2>
          <p>KORA is a creator-first entertainment network with a family-safe operating standard. Pornography and explicit sexual content are prohibited. Content involving exploitation, non-consensual sexual material, sexual content involving minors, incitement to violence, illegal exploitation, deliberate rights infringement or fraudulent commercial activity is not permitted.</p>
          <p>Non-explicit mature themes may be considered where lawful, contextually justified, correctly age-rated and approved through moderation. Viewers can report content for review and KORA may restrict, edit metadata, age-gate, demonetise, unpublish or remove content when required.</p>
          <p><Link href="/">Return to KORA</Link></p>
        </article>
      </section>
    </main>
  );
}
