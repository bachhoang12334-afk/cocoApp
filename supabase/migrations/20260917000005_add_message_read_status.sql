-- CocoApp Phase 4D: unread state for private messages.
-- Messages created before this migration are treated as already read.

alter table public.messages
  add column if not exists read_at timestamptz default now();

alter table public.messages
  alter column read_at drop default;

create index if not exists messages_unread_connection_idx
  on public.messages (connection_request_id, created_at, id)
  where read_at is null;

create or replace function public.protect_message_read_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.connection_request_id is distinct from old.connection_request_id
    or new.sender_id is distinct from old.sender_id
    or new.body is distinct from old.body
    or new.created_at is distinct from old.created_at then
    raise exception 'Message content and ownership fields cannot be changed';
  end if;

  if old.read_at is null then
    new.read_at := now();
  else
    new.read_at := old.read_at;
  end if;

  return new;
end;
$$;

drop trigger if exists messages_protect_read_update on public.messages;
create trigger messages_protect_read_update
before update on public.messages
for each row execute function public.protect_message_read_update();

revoke all on table public.messages from anon, authenticated;
grant select on table public.messages to authenticated;
grant insert (id, connection_request_id, sender_id, body)
  on table public.messages to authenticated;
grant update (read_at) on table public.messages to authenticated;

drop policy if exists "Recipients can mark received messages as read"
  on public.messages;
create policy "Recipients can mark received messages as read"
  on public.messages
  for update
  to authenticated
  using (
    read_at is null
    and sender_id <> (select auth.uid())
    and exists (
      select 1
      from public.connection_requests request
      where request.id = messages.connection_request_id
        and (select auth.uid()) in (request.requester_id, request.recipient_id)
    )
  )
  with check (
    sender_id <> (select auth.uid())
    and exists (
      select 1
      from public.connection_requests request
      where request.id = messages.connection_request_id
        and (select auth.uid()) in (request.requester_id, request.recipient_id)
    )
  );

revoke all on function public.protect_message_read_update() from public;

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
