import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secretKey) {
    throw new Error(
      'Missing Supabase admin configuration: NEXT_PUBLIC_SUPABASE_URL plus SUPABASE_SECRET_KEY (legacy SUPABASE_SERVICE_ROLE_KEY is also supported)'
    );
  }

  const schema =
    process.env.KORA_DB_SCHEMA ||
    process.env.NEXT_PUBLIC_KORA_DB_SCHEMA ||
    'public';

  return createSupabaseClient(url, secretKey, {
    db: { schema },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
