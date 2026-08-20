create unique index if not exists revenue_events_source_unique
on public.revenue_events(source_type, source_id)
where source_id is not null;
