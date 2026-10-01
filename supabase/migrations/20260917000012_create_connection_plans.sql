-- CocoApp Phase 8: turn an accepted connection into one concrete next step.
-- Existing connections are intentionally not backfilled with plans.

create table if not exists public.connection_plans (
  id uuid primary key default gen_random_uuid(),
  connection_request_id uuid not null
    references public.connection_requests(id) on delete cascade,
  proposer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  mode text not null,
  location_note text,
  status text not null default 'proposed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  constraint connection_plans_title_valid check (
    title = btrim(title)
    and char_length(title) between 4 and 120
  ),
  constraint connection_plans_mode_allowed check (
    mode in ('online', 'campus', 'public_place')
  ),
  constraint connection_plans_location_note_valid check (
    location_note is null
    or (
      location_note = btrim(location_note)
      and char_length(location_note) between 1 and 160
    )
  ),
  constraint connection_plans_status_allowed check (
    status in ('proposed', 'accepted', 'declined', 'cancelled', 'completed')
  )
);

create unique index if not exists connection_plans_one_active_per_connection_idx
  on public.connection_plans (connection_request_id)
  where status in ('proposed', 'accepted');

create index if not exists connection_plans_connection_created_idx
  on public.connection_plans (connection_request_id, created_at desc, id);

create or replace function public.can_access_connection_plan(
  target_connection_request_id uuid,
  require_accepted boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.connection_requests as request
    where request.id = target_connection_request_id
      and auth.uid() in (request.requester_id, request.recipient_id)
      and (not require_accepted or request.status = 'accepted')
      and not exists (
        select 1
        from public.user_blocks as block
        where (block.blocker_id = request.requester_id and block.blocked_id = request.recipient_id)
           or (block.blocker_id = request.recipient_id and block.blocked_id = request.requester_id)
      )
  );
$$;

create or replace function public.validate_connection_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_record public.connection_requests%rowtype;
  actor_id uuid := auth.uid();
  pair_is_blocked boolean;
  is_disconnect_cancellation boolean := false;
begin
  if tg_op = 'UPDATE' then
    is_disconnect_cancellation := coalesce(
      current_setting('cocoapp.internal_plan_disconnect', true),
      'off'
    ) = 'on'
      and pg_trigger_depth() > 1
      and old.status in ('proposed', 'accepted')
      and new.status = 'cancelled';
  end if;

  if actor_id is null and not is_disconnect_cancellation then
    raise exception 'Authentication is required for connection plans';
  end if;

  select request.*
    into request_record
  from public.connection_requests as request
  where request.id = new.connection_request_id;

  if request_record.id is null then
    raise exception 'Connection was not found';
  end if;

  if not is_disconnect_cancellation
    and actor_id not in (request_record.requester_id, request_record.recipient_id) then
    raise exception 'Only connection participants can manage a plan';
  end if;

  select exists (
    select 1
    from public.user_blocks as block
    where (block.blocker_id = request_record.requester_id and block.blocked_id = request_record.recipient_id)
       or (block.blocker_id = request_record.recipient_id and block.blocked_id = request_record.requester_id)
  ) into pair_is_blocked;

  if tg_op = 'INSERT' then
    if request_record.status <> 'accepted' then
      raise exception 'Connection plans require an accepted connection';
    end if;

    if pair_is_blocked then
      raise exception 'Connection plans are unavailable while either participant is blocked';
    end if;

    if new.proposer_id <> actor_id then
      raise exception 'Only the proposer can create a connection plan';
    end if;

    if new.status <> 'proposed' then
      raise exception 'New connection plans must be proposed';
    end if;

    new.title := btrim(new.title);
    new.location_note := nullif(btrim(new.location_note), '');

    if new.starts_at <= now() then
      raise exception 'Connection plan time must be in the future';
    end if;

    new.created_at := now();
    new.updated_at := new.created_at;
    new.responded_at := null;
    new.completed_at := null;
    new.cancelled_at := null;
    return new;
  end if;

  if new.id is distinct from old.id
    or new.connection_request_id is distinct from old.connection_request_id
    or new.proposer_id is distinct from old.proposer_id
    or new.title is distinct from old.title
    or new.starts_at is distinct from old.starts_at
    or new.mode is distinct from old.mode
    or new.location_note is distinct from old.location_note
    or new.created_at is distinct from old.created_at then
    raise exception 'Connection plan details cannot be changed';
  end if;

  if new.status is not distinct from old.status then
    new.updated_at := old.updated_at;
    new.responded_at := old.responded_at;
    new.completed_at := old.completed_at;
    new.cancelled_at := old.cancelled_at;
    return new;
  end if;

  if request_record.status <> 'accepted' then
    raise exception 'Connection plans require an accepted connection';
  end if;

  if pair_is_blocked and not is_disconnect_cancellation then
    raise exception 'Connection plans are unavailable while either participant is blocked';
  end if;

  if old.status = 'proposed' then
    if new.status in ('accepted', 'declined') then
      if actor_id = old.proposer_id then
        raise exception 'Only the other participant can accept or decline a plan';
      end if;

      if new.status = 'accepted' and old.starts_at <= now() then
        raise exception 'An expired connection plan cannot be accepted';
      end if;
    elsif new.status = 'cancelled' then
      if actor_id <> old.proposer_id and not is_disconnect_cancellation then
        raise exception 'Only the proposer can cancel a proposed plan';
      end if;
    else
      raise exception 'Invalid proposed plan transition';
    end if;
  elsif old.status = 'accepted' then
    if new.status not in ('cancelled', 'completed') then
      raise exception 'Accepted plans can only be completed or cancelled';
    end if;
  else
    raise exception 'Completed, declined, or cancelled plans cannot change status';
  end if;

  new.updated_at := now();
  new.responded_at := old.responded_at;
  new.completed_at := old.completed_at;
  new.cancelled_at := old.cancelled_at;

  if old.status = 'proposed' and new.status in ('accepted', 'declined') then
    new.responded_at := now();
  end if;

  if new.status = 'completed' then
    new.completed_at := now();
  elsif new.status = 'cancelled' then
    new.cancelled_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists connection_plans_validate on public.connection_plans;
create trigger connection_plans_validate
before insert or update on public.connection_plans
for each row execute function public.validate_connection_plan();

-- Close an active plan in the same transaction as a disconnect. This trigger is
-- BEFORE the connection row changes so plan validation still sees an accepted
-- connection; a later connection validation failure rolls the whole action back.
create or replace function public.cancel_connection_plans_on_disconnect()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_disconnect_marker text;
begin
  if old.status = 'accepted' and new.status = 'cancelled' then
    previous_disconnect_marker := current_setting(
      'cocoapp.internal_plan_disconnect',
      true
    );
    perform pg_catalog.set_config(
      'cocoapp.internal_plan_disconnect',
      'on',
      true
    );

    update public.connection_plans
    set status = 'cancelled'
    where connection_request_id = old.id
      and status in ('proposed', 'accepted');

    perform pg_catalog.set_config(
      'cocoapp.internal_plan_disconnect',
      coalesce(previous_disconnect_marker, 'off'),
      true
    );
  end if;

  return new;
end;
$$;

drop trigger if exists connection_requests_cancel_active_plans
  on public.connection_requests;
create trigger connection_requests_cancel_active_plans
before update of status on public.connection_requests
for each row
when (old.status = 'accepted' and new.status = 'cancelled')
execute function public.cancel_connection_plans_on_disconnect();

alter table public.connection_plans enable row level security;

revoke all on table public.connection_plans from anon, authenticated;
grant select on table public.connection_plans to authenticated;
grant insert (
  connection_request_id,
  proposer_id,
  title,
  starts_at,
  mode,
  location_note
) on table public.connection_plans to authenticated;
grant update (status) on table public.connection_plans to authenticated;

drop policy if exists "Participants can view connection plans"
  on public.connection_plans;
create policy "Participants can view connection plans"
  on public.connection_plans
  for select
  to authenticated
  using (public.can_access_connection_plan(connection_request_id, false));

drop policy if exists "Participants can propose connection plans"
  on public.connection_plans;
create policy "Participants can propose connection plans"
  on public.connection_plans
  for insert
  to authenticated
  with check (
    proposer_id = (select auth.uid())
    and public.can_access_connection_plan(connection_request_id, true)
  );

drop policy if exists "Participants can transition connection plans"
  on public.connection_plans;
create policy "Participants can transition connection plans"
  on public.connection_plans
  for update
  to authenticated
  using (public.can_access_connection_plan(connection_request_id, true))
  with check (public.can_access_connection_plan(connection_request_id, true));

revoke all on function public.can_access_connection_plan(uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.validate_connection_plan() from public;
revoke all on function public.cancel_connection_plans_on_disconnect() from public;
grant execute on function public.can_access_connection_plan(uuid, boolean)
  to authenticated;

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
      and tablename = 'connection_plans'
  ) then
    alter publication supabase_realtime add table public.connection_plans;
  end if;
end;
$$;
