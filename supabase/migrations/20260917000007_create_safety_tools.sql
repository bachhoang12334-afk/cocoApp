-- CocoApp Phase 6: blocking, reporting, and safety controls.
-- Existing connections and reports are not backfilled.

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);

create index if not exists user_blocks_blocked_idx
  on public.user_blocks (blocked_id, blocker_id);

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  connection_request_id uuid
    references public.connection_requests(id) on delete set null,
  message_id uuid references public.messages(id) on delete set null,
  category text not null check (
    category in (
      'spam',
      'harassment',
      'unsafe_behavior',
      'impersonation',
      'inappropriate_content',
      'other'
    )
  ),
  details text check (
    details is null
    or (
      details = btrim(details)
      and char_length(details) between 1 and 1000
    )
  ),
  status text not null default 'submitted'
    check (status in ('submitted', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_reports_not_self check (reporter_id <> reported_user_id)
);

create index if not exists user_reports_reporter_created_idx
  on public.user_reports (reporter_id, created_at desc);

create index if not exists user_reports_moderation_queue_idx
  on public.user_reports (status, created_at);

create unique index if not exists user_reports_open_context_idx
  on public.user_reports (
    reporter_id,
    reported_user_id,
    coalesce(connection_request_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(message_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status in ('submitted', 'reviewing');

create or replace function public.validate_user_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  report_connection_id uuid;
  request_record public.connection_requests%rowtype;
begin
  if new.reporter_id <> auth.uid() then
    raise exception 'Only the reporter can submit a safety report';
  end if;

  if new.status <> 'submitted' then
    raise exception 'New safety reports must be submitted';
  end if;

  new.details := nullif(btrim(new.details), '');

  if new.message_id is not null then
    select message.connection_request_id
      into report_connection_id
    from public.messages as message
    where message.id = new.message_id;

    if report_connection_id is null then
      raise exception 'Reported message was not found';
    end if;

    if new.connection_request_id is null then
      new.connection_request_id := report_connection_id;
    elsif new.connection_request_id <> report_connection_id then
      raise exception 'Reported message does not belong to this connection';
    end if;
  end if;

  if new.connection_request_id is not null then
    select request.*
      into request_record
    from public.connection_requests as request
    where request.id = new.connection_request_id;

    if request_record.id is null
      or auth.uid() not in (request_record.requester_id, request_record.recipient_id) then
      raise exception 'Reporter is not a participant in this connection';
    end if;

    if new.reported_user_id not in (
      request_record.requester_id,
      request_record.recipient_id
    ) or new.reported_user_id = auth.uid() then
      raise exception 'Reported user does not match this connection';
    end if;
  elsif not exists (
    select 1
    from public.profiles as profile
    where profile.id = new.reported_user_id
  ) then
    raise exception 'Reported user was not found';
  end if;

  return new;
end;
$$;

drop trigger if exists user_reports_validate on public.user_reports;
create trigger user_reports_validate
before insert on public.user_reports
for each row execute function public.validate_user_report();

create or replace function public.protect_user_report_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.reporter_id is distinct from old.reporter_id
    or new.reported_user_id is distinct from old.reported_user_id
    or new.connection_request_id is distinct from old.connection_request_id
    or new.message_id is distinct from old.message_id
    or new.category is distinct from old.category
    or new.details is distinct from old.details
    or new.created_at is distinct from old.created_at then
    raise exception 'Safety report evidence fields cannot be changed';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_reports_protect_update on public.user_reports;
create trigger user_reports_protect_update
before update on public.user_reports
for each row execute function public.protect_user_report_update();

alter table public.user_blocks enable row level security;
alter table public.user_reports enable row level security;

revoke all on table public.user_blocks from anon, authenticated;
grant select on table public.user_blocks to authenticated;
grant insert (blocker_id, blocked_id) on table public.user_blocks to authenticated;
grant delete on table public.user_blocks to authenticated;

drop policy if exists "Users can view blocks they created" on public.user_blocks;
create policy "Users can view blocks they created"
  on public.user_blocks
  for select
  to authenticated
  using (blocker_id = (select auth.uid()));

drop policy if exists "Users can block other accounts" on public.user_blocks;
create policy "Users can block other accounts"
  on public.user_blocks
  for insert
  to authenticated
  with check (
    blocker_id = (select auth.uid())
    and blocked_id <> (select auth.uid())
  );

drop policy if exists "Users can remove blocks they created" on public.user_blocks;
create policy "Users can remove blocks they created"
  on public.user_blocks
  for delete
  to authenticated
  using (blocker_id = (select auth.uid()));

revoke all on table public.user_reports from anon, authenticated;
grant select on table public.user_reports to authenticated;
grant insert (
  id,
  reporter_id,
  reported_user_id,
  connection_request_id,
  message_id,
  category,
  details
) on table public.user_reports to authenticated;

drop policy if exists "Users can view reports they submitted" on public.user_reports;
create policy "Users can view reports they submitted"
  on public.user_reports
  for select
  to authenticated
  using (reporter_id = (select auth.uid()));

drop policy if exists "Users can submit safety reports" on public.user_reports;
create policy "Users can submit safety reports"
  on public.user_reports
  for insert
  to authenticated
  with check (
    reporter_id = (select auth.uid())
    and reported_user_id <> (select auth.uid())
    and status = 'submitted'
  );

-- Blocking immediately closes an active request. Cancelled rows and messages remain
-- in the database so moderators can retain evidence and users can reconnect later.
create or replace function public.validate_connection_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester_gender text;
  recipient_gender text;
  pair_is_blocked boolean;
begin
  select exists (
    select 1
    from public.user_blocks as block
    where (block.blocker_id = new.requester_id and block.blocked_id = new.recipient_id)
       or (block.blocker_id = new.recipient_id and block.blocked_id = new.requester_id)
  ) into pair_is_blocked;

  if tg_op = 'INSERT' then
    if pair_is_blocked then
      raise exception 'Users cannot connect while blocked';
    end if;

    if new.status <> 'pending' then
      raise exception 'New connection requests must be pending';
    end if;

    if new.requester_id <> auth.uid() then
      raise exception 'Only the requester can create a connection request';
    end if;

    if new.purpose = 'roommates' then
      select gender into requester_gender
      from public.profiles
      where id = new.requester_id;

      select gender into recipient_gender
      from public.profiles
      where id = new.recipient_id;

      if nullif(btrim(requester_gender), '') is null
        or nullif(btrim(recipient_gender), '') is null
        or requester_gender <> recipient_gender then
        raise exception 'Roommate requests require matching genders';
      end if;
    end if;

    new.responded_at = null;
    return new;
  end if;

  if new.requester_id is distinct from old.requester_id
    or new.recipient_id is distinct from old.recipient_id
    or new.purpose is distinct from old.purpose then
    raise exception 'Requester, recipient, and purpose cannot be changed';
  end if;

  if pair_is_blocked and new.status <> 'cancelled' then
    raise exception 'Blocked connections can only be cancelled';
  end if;

  if new.status is distinct from old.status then
    if old.status = 'pending' then
      if new.status in ('accepted', 'declined')
        and auth.uid() <> old.recipient_id then
        raise exception 'Only the recipient can accept or decline a request';
      end if;

      if new.status = 'cancelled'
        and auth.uid() <> old.requester_id
        and not pair_is_blocked then
        raise exception 'Only the requester can cancel a request';
      end if;
    elsif old.status = 'accepted' then
      if new.status <> 'cancelled'
        or auth.uid() not in (old.requester_id, old.recipient_id) then
        raise exception 'Only a participant can disconnect an accepted request';
      end if;
    else
      raise exception 'Only pending or accepted requests can change status';
    end if;

    if new.status not in ('accepted', 'declined', 'cancelled') then
      raise exception 'Invalid connection request transition';
    end if;

    new.responded_at = now();
  else
    new.responded_at = old.responded_at;
  end if;

  return new;
end;
$$;

create or replace function public.disconnect_users_after_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.connection_requests
  set status = 'cancelled'
  where status in ('pending', 'accepted')
    and (
      (requester_id = new.blocker_id and recipient_id = new.blocked_id)
      or (requester_id = new.blocked_id and recipient_id = new.blocker_id)
    );

  return new;
end;
$$;

drop trigger if exists user_blocks_disconnect_connections on public.user_blocks;
create trigger user_blocks_disconnect_connections
after insert on public.user_blocks
for each row execute function public.disconnect_users_after_block();

-- A block-driven cancellation stays private and does not create a misleading
-- connection notification for either account.
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
  on conflict (connection_request_id, recipient_id, type) do nothing;

  return new;
end;
$$;

create or replace function public.get_discover_profiles()
returns table (
  id uuid,
  full_name text,
  gender text,
  major text,
  purpose text,
  city text,
  area text,
  public_location text,
  bio text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    profile.id,
    profile.full_name,
    profile.gender,
    profile.major,
    profile.purpose,
    profile.city,
    profile.area,
    profile.public_location,
    profile.bio
  from public.profiles as profile
  where auth.uid() is not null
    and profile.id <> auth.uid()
    and not exists (
      select 1
      from public.user_blocks as block
      where (block.blocker_id = auth.uid() and block.blocked_id = profile.id)
         or (block.blocker_id = profile.id and block.blocked_id = auth.uid())
    )
  order by profile.created_at desc, profile.id;
$$;

create or replace function public.get_my_blocked_users()
returns table (
  blocked_user_id uuid,
  full_name text,
  major text,
  university text,
  blocked_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    block.blocked_id,
    profile.full_name,
    profile.major,
    profile.university,
    block.created_at
  from public.user_blocks as block
  join public.profiles as profile on profile.id = block.blocked_id
  where block.blocker_id = auth.uid()
  order by block.created_at desc;
$$;

revoke all on function public.validate_user_report() from public;
revoke all on function public.protect_user_report_update() from public;
revoke all on function public.disconnect_users_after_block() from public;
revoke all on function public.validate_connection_request() from public;
revoke all on function public.create_connection_notification() from public;
revoke all on function public.get_discover_profiles() from public;
revoke all on function public.get_my_blocked_users() from public;

grant execute on function public.get_discover_profiles() to authenticated;
grant execute on function public.get_my_blocked_users() to authenticated;
