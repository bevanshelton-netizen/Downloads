import { createClient } from '@supabase/supabase-js';

const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) are required.');
  process.exit(1);
}
if (process.env.KORA_BOOTSTRAP_CONFIRM !== 'BOOTSTRAP_FIRST_ADMIN') {
  console.error('KORA_BOOTSTRAP_CONFIRM=BOOTSTRAP_FIRST_ADMIN is required for administrator activation.');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { count, error: countError } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin');
if (countError) throw countError;
if ((count ?? 0) > 0) {
  console.log(`KORA administrator already exists (${count}); bootstrap is already satisfied.`);
  process.exit(0);
}

const email = String(process.env.KORA_OWNER_EMAIL || '').trim().toLowerCase();
if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
  console.error('KORA_OWNER_EMAIL must identify an existing Supabase Auth user when no KORA administrator exists yet.');
  process.exit(1);
}

let page = 1;
let target = null;
while (!target && page <= 20) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
  if (error) throw error;
  target = data.users.find((user) => user.email?.toLowerCase() === email) || null;
  if (data.users.length < 100) break;
  page += 1;
}
if (!target) {
  console.error('No existing Supabase Auth user matches KORA_OWNER_EMAIL. The owner must exist in Supabase Auth before admin bootstrap.');
  process.exit(1);
}

const { error } = await admin.from('profiles').upsert(
  {
    id: target.id,
    role: 'admin',
    display_name: target.user_metadata?.display_name || email.split('@')[0],
  },
  { onConflict: 'id' },
);
if (error) throw error;

const { count: verifiedCount, error: verifyError } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin');
if (verifyError) throw verifyError;
if ((verifiedCount ?? 0) < 1) throw new Error('KORA administrator bootstrap could not be verified');

console.log(`KORA first administrator is ready for ${email}.`);
