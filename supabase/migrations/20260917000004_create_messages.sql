-- CocoApp Phase 4C: private messages between accepted connections.
-- Existing browser-local messages are intentionally not backfilled.

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  connection_request_id uuid not null
    references public.connection_requests(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (
    body = btrim(body)
    and char_length(body) between 1 and 1000
  ),
  created_at timestamptz not null default now()
);

create index if not exists messages_connection_created_idx
  on public.messages (connection_request_id, created_at, id);

alter table public.messages enable row level security;

revoke all on table public.messages from anon, authenticated;
grant select on table public.messages to authenticated;
grant insert (id, connection_request_id, sender_id, body)
  on table public.messages to authenticated;

drop policy if exists "Participants can view connection messages"
  on public.messages;
create policy "Participants can view connection messages"
  on public.messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.connection_requests request
      where request.id = messages.connection_request_id
        and (select auth.uid()) in (request.requester_id, request.recipient_id)
    )
  );

drop policy if exists "Participants can message accepted connections"
  on public.messages;
create policy "Participants can message accepted connections"
  on public.messages
  for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1
      from public.connection_requests request
      where request.id = messages.connection_request_id
        and request.status = 'accepted'
        and (select auth.uid()) in (request.requester_id, request.recipient_id)
    )
  );

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;
