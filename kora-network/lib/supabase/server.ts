import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (legacy NEXT_PUBLIC_SUPABASE_ANON_KEY is also supported)'
    );
  }

  const cookieStore = await cookies();
  const schema = process.env.NEXT_PUBLIC_KORA_DB_SCHEMA || 'public';

  return createServerClient(url, publishableKey, {
    db: { schema },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options as any));
        } catch {
          // Server Components cannot always write cookies. Middleware refreshes sessions.
        }
      },
    },
  });
}
