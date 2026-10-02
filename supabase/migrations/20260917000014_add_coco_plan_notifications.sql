-- CocoApp Phase 8 follow-up: notification events for the Coco Plan lifecycle.
-- Existing notifications are preserved and existing plans are not backfilled.

alter table public.notifications
  add column if not exists connection_plan_id uuid;

-- A composite foreign key keeps a plan notification tied to the same connection
-- request carried by the notification. MATCH SIMPLE intentionally lets legacy
-- connection notifications keep a null connection_plan_id.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'connection_plans_id_connection_request_key'
      and conrelid = 'public.connection_plans'::regclass
  ) then
    alter table public.connection_plans
      add constraint connection_plans_id_connection_request_key
      unique (id, connection_request_id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'notifications_connection_plan_context_fkey'
      and conrelid = 'public.notifications'::regclass
  ) then
    alter table public.notifications
      add constraint notifications_connection_plan_context_fkey
      foreign key (connection_plan_id, connection_request_id)
      references public.connection_plans (id, connection_request_id)
      on delete cascade;
  end if;
end;
$$;

alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (
    type in (
      'request_received',
      'request_accepted',
      'request_declined',
      'request_cancelled',
      'connection_disconnected',
      'plan_proposed',
      'plan_accepted',
      'plan_declined',
      'plan_cancelled',
      'plan_completed'
    )
  );

alter table public.notifications
  drop constraint if exists notifications_connection_plan_context_check;
alter table public.notifications
  add constraint notifications_connection_plan_context_check check (
    (
      type in (
        'request_received',
        'request_accepted',
        'request_declined',
        'request_cancelled',
        'connection_disconnected'
      )
      and connection_plan_id is null
    )
    or
    (
      type in (
        'plan_proposed',
        'plan_accepted',
        'plan_declined',
        'plan_cancelled',
        'plan_completed'
      )
      and connection_plan_id is not null
    )
  );

-- Connection events dedupe per connection. Plan events dedupe per individual
-- plan so later plans on the same connection still create fresh notifications.
drop index if exists public.notifications_connection_event_idx;
create unique index notifications_connection_event_idx
  on public.notifications (connection_request_id, recipient_id, type)
  where connection_plan_id is null;

drop index if exists public.notifications_plan_event_idx;
create unique index notifications_plan_event_idx
  on public.notifications (connection_plan_id, recipient_id, type)
  where connection_plan_id is not null;

-- The original connection trigger used a conflict target backed by the old
-- non-partial index. Use a target-free conflict handler so connection events
-- remain idempotent with the new partial index.
create or replace function public.create_connection_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  notification_recipient_id uuid;
  notification_actor_id uuid;
  notification_type text;
begin
  if tg_op = 'UPDATE'
    and new.status = 'cancelled'
    and exists (
      select 1
      from public.user_blocks as block
      where (block.blocker_id = new.requester_id and block.blocked_id = new.recipient_id)
         or (block.blocker_id = new.recipient_id and block.blocked_id = new.requester_id)
    ) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    notification_recipient_id := new.recipient_id;
    notification_actor_id := new.requester_id;
    notification_type := 'request_received';
  elsif new.status is not distinct from old.status then
    return new;
  elsif new.status = 'accepted' and old.status = 'pending' then
    notification_recipient_id := old.requester_id;
    notification_actor_id := old.recipient_id;
    notification_type := 'request_accepted';
  elsif new.status = 'declined' and old.status = 'pending' then
    notification_recipient_id := old.requester_id;
    notification_actor_id := old.recipient_id;
    notification_type := 'request_declined';
  elsif new.status = 'cancelled' and old.status = 'pending' then
    notification_recipient_id := old.recipient_id;
    notification_actor_id := old.requester_id;
    notification_type := 'request_cancelled';
  elsif new.status = 'cancelled' and old.status = 'accepted' then
    notification_actor_id := auth.uid();

    if notification_actor_id = old.requester_id then
      notification_recipient_id := old.recipient_id;
    elsif notification_actor_id = old.recipient_id then
      notification_recipient_id := old.requester_id;
    else
      return new;
    end if;

    notification_type := 'connection_disconnected';
  else
    return new;
  end if;

  if notification_actor_id is null
    or notification_recipient_id is null
    or notification_actor_id = notification_recipient_id then
    return new;
  end if;

  insert into public.notifications (
    recipient_id,
    actor_id,
    connection_request_id,
    type
  )
  values (
    notification_recipient_id,
    notification_actor_id,
    new.id,
    notification_type
  )
  on conflict do nothing;

  return new;
end;
$$;

create or replace function public.create_connection_plan_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  notification_recipient_id uuid;
  notification_actor_id uuid := auth.uid();
  notification_type text;
begin
  if tg_op = 'UPDATE' then
    if new.status is not distinct from old.status then
      return new;
    end if;

    -- Disconnect and block cleanup use this transaction-local marker. The
    -- connection event already communicates a manual disconnect, while a block
    -- remains private, so neither path should emit a misleading plan cancel.
    if new.status = 'cancelled'
      and coalesce(
        current_setting('cocoapp.internal_plan_disconnect', true),
        'off'
      ) = 'on'
      and pg_trigger_depth() > 1 then
      return new;
    end if;
  end if;

  if notification_actor_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'proposed'
      or new.proposer_id <> notification_actor_id then
      return new;
    end if;

    notification_type := 'plan_proposed';
  elsif old.status = 'proposed' and new.status = 'accepted' then
    notification_type := 'plan_accepted';
  elsif old.status = 'proposed' and new.status = 'declined' then
    notification_type := 'plan_declined';
  elsif old.status in ('proposed', 'accepted')
    and new.status = 'cancelled' then
    notification_type := 'plan_cancelled';
  elsif old.status = 'accepted' and new.status = 'completed' then
    notification_type := 'plan_completed';
  else
    return new;
  end if;

  select case
      when request.requester_id = notification_actor_id
        then request.recipient_id
      when request.recipient_id = notification_actor_id
        then request.requester_id
      else null
    end
    into notification_recipient_id
  from public.connection_requests as request
  where request.id = new.connection_request_id;

  if notification_recipient_id is null
    or notification_recipient_id = notification_actor_id then
    return new;
  end if;

  insert into public.notifications (
    recipient_id,
    actor_id,
    connection_request_id,
    connection_plan_id,
    type
  )
  values (
    notification_recipient_id,
    notification_actor_id,
    new.connection_request_id,
    new.id,
    notification_type
  )
  on conflict (connection_plan_id, recipient_id, type)
    where connection_plan_id is not null
  do nothing;

  return new;
end;
$$;

drop trigger if exists connection_plans_create_notification
  on public.connection_plans;
create trigger connection_plans_create_notification
after insert or update of status on public.connection_plans
for each row execute function public.create_connection_plan_notification();

create or replace function public.protect_notification_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.recipient_id is distinct from old.recipient_id
    or new.actor_id is distinct from old.actor_id
    or new.connection_request_id is distinct from old.connection_request_id
    or new.connection_plan_id is distinct from old.connection_plan_id
    or new.type is distinct from old.type
    or new.created_at is distinct from old.created_at then
    raise exception 'Notification event fields cannot be changed';
  end if;

  if old.read_at is not null then
    new.read_at := old.read_at;
  else
    new.read_at := now();
  end if;

  return new;
end;
$$;

-- Adding a return column requires recreating the RPC rather than replacing it.
drop function if exists public.get_my_notifications();
create function public.get_my_notifications()
returns table (
  id uuid,
  recipient_id uuid,
  actor_id uuid,
  connection_request_id uuid,
  connection_plan_id uuid,
  type text,
  read_at timestamptz,
  created_at timestamptz,
  actor_full_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    notification.id,
    notification.recipient_id,
    notification.actor_id,
    notification.connection_request_id,
    notification.connection_plan_id,
    notification.type,
    notification.read_at,
    notification.created_at,
    actor.full_name
  from public.notifications as notification
  left join public.profiles as actor
    on actor.id = notification.actor_id
    and not exists (
      select 1
      from public.user_blocks as block
      where (block.blocker_id = auth.uid() and block.blocked_id = actor.id)
         or (block.blocker_id = actor.id and block.blocked_id = auth.uid())
    )
  where auth.uid() is not null
    and notification.recipient_id = auth.uid()
  order by notification.created_at desc, notification.id
  limit 30;
$$;

alter table public.notifications enable row level security;

revoke all on table public.notifications from anon, authenticated;
grant select on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;

revoke all on function public.create_connection_notification()
  from public, anon, authenticated;
revoke all on function public.create_connection_plan_notification()
  from public, anon, authenticated;
revoke all on function public.protect_notification_update()
  from public, anon, authenticated;
revoke all on function public.get_my_notifications()
  from public, anon, authenticated;
grant execute on function public.get_my_notifications() to authenticated;

-- Notifications may already be in the publication. Keep this safe to rerun.
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
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
