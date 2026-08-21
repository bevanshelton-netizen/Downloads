# KORA Production Instance

This file records the confirmed non-secret production coordinates for KORA. It exists to prevent accidental connection to an unrelated Supabase project.

## Confirmed Supabase project

- Project reference: `pcvjxvhyvuqvwjbsusmq`
- Project URL: `https://pcvjxvhyvuqvwjbsusmq.supabase.co`
- Region shown by Supabase: `eu-central-1`
- Status observed at handoff: Healthy

The application readiness gate and production preflight must reject any different Supabase project URL.

## Operator links

- Project dashboard: `https://supabase.com/dashboard/project/pcvjxvhyvuqvwjbsusmq`
- SQL editor: `https://supabase.com/dashboard/project/pcvjxvhyvuqvwjbsusmq/sql/new`
- API settings: `https://supabase.com/dashboard/project/pcvjxvhyvuqvwjbsusmq/settings/api`
- Auth URL configuration: `https://supabase.com/dashboard/project/pcvjxvhyvuqvwjbsusmq/auth/url-configuration`

## Safe production mapping

`NEXT_PUBLIC_SUPABASE_URL` must equal:

`https://pcvjxvhyvuqvwjbsusmq.supabase.co`

For a new Supabase project, prefer:

- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the browser-safe publishable key.
- `SUPABASE_SECRET_KEY` for the privileged server key.

Never commit, paste into issue/PR text, or expose the server secret key to browser code. Legacy anon/service-role keys remain supported only as compatibility fallbacks.

## Database bootstrap

The canonical one-shot schema-14 installer is generated with:

`npm run build:bootstrap-sql`

Output:

`artifacts/kora-production-bootstrap-schema14.sql`

Use it only if this KORA project is still a fresh database. The installer refuses to continue if `public.profiles` already exists, and it ends by asserting schema version 14. Public launch remains disabled after the bootstrap.

After the SQL succeeds, verify:

```sql
select schema_version, release_name, public_launch_enabled
from public.platform_release_state
where singleton = true;
```

Expected result: schema version `14`, release `private_beta`, public launch `false`.

Do not run this installer against Allegro-Vibez, ECD360, or any other Supabase project.
