import { createClient } from '@supabase/supabase-js';

const email = String(process.argv[2] || '').trim().toLowerCase();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
  console.error('Usage: npm run bootstrap:admin -- admin@example.com');
  process.exit(1);
}
if (!url || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) are required.');
  process.exit(1);
}
if (process.env.KORA_BOOTSTRAP_CONFIRM !== 'BOOTSTRAP_FIRST_ADMIN') {
  console.error('Set KORA_BOOTSTRAP_CONFIRM=BOOTSTRAP_FIRST_ADMIN for this one-time privileged operation.');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { count, error: countError } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin');
if (countError) throw countError;
if ((count ?? 0) > 0) {
  console.error('An administrator already exists. Use normal staff administration instead of bootstrap.');
  process.exit(1);
}

let page = 1;
let target = null;
while (!target && page <= 20) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
  if (error) throw error;
  target = data.users.find(user => user.email?.toLowerCase() === email) || null;
  if (data.users.length < 100) break;
  page += 1;
}
if (!target) {
  console.error('No existing Supabase Auth user matches that email. Create the owner account in Supabase Auth first.');
  process.exit(1);
}

const { error } = await admin.from('profiles').upsert({ id: target.id, role: 'admin', display_name: target.user_metadata?.display_name || email.split('@')[0] }, { onConflict: 'id' });
if (error) throw error;
console.log(`KORA administrator bootstrapped for ${email}. Remove KORA_BOOTSTRAP_CONFIRM from the environment now.`);
