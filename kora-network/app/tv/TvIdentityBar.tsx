'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './tv-identity.module.css';

type Identity = {
  authenticated: boolean;
  user: { id: string; email: string | null } | null;
  profile: { display_name: string | null; role: string; country_code: string | null } | null;
};

export default function TvIdentityBar() {
  const [identity, setIdentity] = useState<Identity | null>(null);

  useEffect(() => {
    fetch('/api/ott/me', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then(setIdentity)
      .catch(() => setIdentity(null));
  }, []);

  if (!identity) return null;

  const name = identity.profile?.display_name || identity.user?.email?.split('@')[0] || 'KORA Guest';
  const initial = name.trim().charAt(0).toUpperCase() || 'K';

  return (
    <div className={styles.bar} aria-label="KORA identity">
      <div className={styles.brand}><span>K</span><strong>KORA</strong></div>
      <div className={styles.identity}>
        <span className={styles.avatar} aria-hidden="true">{initial}</span>
        <div>
          <strong>{name}</strong>
          <small>{identity.authenticated ? `${identity.profile?.role || 'viewer'}${identity.profile?.country_code ? ` · ${identity.profile.country_code}` : ''}` : 'Guest viewing'}</small>
        </div>
      </div>
      <Link href={identity.authenticated ? '/account' : '/login'} className={styles.account}>
        {identity.authenticated ? 'ACCOUNT →' : 'SIGN IN →'}
      </Link>
    </div>
  );
}
