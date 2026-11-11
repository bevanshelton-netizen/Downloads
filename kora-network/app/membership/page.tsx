import type { Metadata } from 'next';
import Link from 'next/link';
import SubscribeButton from '@/components/SubscribeButton';
import styles from './membership.module.css';

export const metadata: Metadata = {
  title: 'Membership',
  description: 'Choose a KORA membership for premium African entertainment.',
};

const benefits = [
  'Ad-light viewing and premium catalogue access',
  'Premium African films, series and original programming',
  'A growing catalogue of music, culture and entertainment',
  'One account for your viewing library and membership',
  'Secure recurring billing with membership management',
];

export default function MembershipPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.eyebrow}>KORA MEMBERSHIP</div>
        <h1>More Africa.<br /><span>More to experience.</span></h1>
        <p>Choose the membership that fits how you watch. Discover African stories, music and entertainment while supporting a platform built to grow the continent’s creative economy.</p>
        <div className={styles.actions}>
          <Link href="/open-africa" className={styles.secondary}>Explore free viewing</Link>
          <Link href="/account" className={styles.secondary}>My KORA account</Link>
        </div>
      </section>

      <section className={styles.plans} aria-label="KORA membership plans">
        <article className={styles.plan}>
          <div className={styles.planTop}>
            <span className={styles.planLabel}>KORA PREMIUM</span>
            <h2>Premium</h2>
            <p>For viewers who want more of the KORA experience.</p>
          </div>
          <div className={styles.price}><strong>R79</strong><span>/ month</span></div>
          <ul>{benefits.map((benefit) => <li key={benefit}>{benefit}</li>)}</ul>
          <SubscribeButton planCode="viewer_monthly" label="Choose Premium" />
          <small className={styles.finePrint}>Recurring monthly subscription. Cancel future renewal through My KORA.</small>
        </article>

        <article className={`${styles.plan} ${styles.featured}`}>
          <div className={styles.planTop}>
            <span className={styles.planLabel}>KORA PREMIUM PLUS</span>
            <h2>Premium Plus</h2>
            <p>For committed viewers who want the fullest membership tier.</p>
          </div>
          <div className={styles.price}><strong>R129</strong><span>/ month</span></div>
          <ul>
            {benefits.map((benefit) => <li key={benefit}>{benefit}</li>)}
            <li>Priority premieres and expanded member benefits as they become available</li>
          </ul>
          <SubscribeButton planCode="viewer_plus" label="Choose Premium Plus" />
          <small className={styles.finePrint}>Recurring monthly subscription. Cancel future renewal through My KORA.</small>
        </article>
      </section>

      <section className={styles.trust}>
        <div><b>Secure checkout</b><span>Payments are processed through PayFast.</span></div>
        <div><b>Manage your membership</b><span>View your membership and cancel future renewal in My KORA.</span></div>
        <div><b>Clear payment confirmation</b><span>Membership access is activated after secure payment confirmation.</span></div>
      </section>
      <p className={styles.legal}>Membership availability and premium catalogue access depend on production rights and platform release status. Subscription charges are recurring until cancelled. Cancellation stops future renewal; access remains available through the paid period. See our <Link href="/legal/terms">Terms</Link> and <Link href="/legal/refunds">Refund Policy</Link>.</p>
    </main>
  );
}
