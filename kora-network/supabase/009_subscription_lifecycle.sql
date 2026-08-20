-- Preserve paid access through the current period after future recurring billing is cancelled.
alter table public.subscriptions
  add column if not exists cancel_at_period_end boolean not null default false;
