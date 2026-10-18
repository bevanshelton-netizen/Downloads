export type KoraRuntime = {
  primary: 'vercel' | 'owned' | 'other';
  fallback: 'vercel' | 'owned' | 'other';
  streaming: 'configured' | 'standby';
  database: 'configured' | 'standby';
};

/**
 * KORA is IZAKHONO-owned-first. External providers remain replaceable
 * resilience paths and are never treated as the primary deployment authority.
 * Never expose secrets or provider credentials to the browser.
 */
export function getKoraRuntime(): KoraRuntime {
  const primary = process.env.KORA_PRIMARY_RUNTIME === 'vercel' ? 'vercel' : 'owned';
  const fallback = process.env.KORA_FALLBACK_RUNTIME === 'vercel' ? 'vercel' : 'owned';
  const streaming = process.env.KORA_STREAMING_READY === 'true' ? 'configured' : 'standby';
  const database = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? 'configured' : 'standby';

  return { primary, fallback, streaming, database };
}
