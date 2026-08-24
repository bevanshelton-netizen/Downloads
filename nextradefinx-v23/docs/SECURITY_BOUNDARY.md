# Security boundary

Allowed in public/client configuration:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY

Never expose publicly:
- Supabase service-role key
- database passwords or privileged database connection strings
- broker secrets
- live trading keys
- OTPs or user passwords

The anon key is intentionally public but is safe only with correctly configured and tested Row Level Security. The service-role key bypasses RLS and must stay privileged/server-side.
