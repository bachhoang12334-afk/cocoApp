-- Tighten safety-report evidence and Coco Plan completion timing.
-- Existing reports and plans are intentionally not backfilled or rewritten.

create or replace function public.validate_user_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  report_connection_id uuid;
  report_message_sender_id uuid;
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
    select
      message.connection_request_id,
      message.sender_id
      into
        report_connection_id,
        report_message_sender_id
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

  -- Check the evidence identity only after connection authorization so a
  -- non-participant cannot probe a private message sender by UUID.
  if new.message_id is not null
    and report_message_sender_id is distinct from new.reported_user_id then
    raise exception 'Reported message was not sent by the reported user';
  end if;

  return new;
end;
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

  if tg_op = 'INSERT' then
    -- Lock the parent before the new plan row exists. A concurrent disconnect
    -- must then wait and will sweep this plan after insertion commits; if the
    -- disconnect wins first, this insert sees the cancelled parent and fails.
    select request.*
      into request_record
    from public.connection_requests as request
    where request.id = new.connection_request_id
    for update;
  else
    -- UPDATE already owns the plan-row lock. Avoid taking the parent lock in
    -- reverse order because disconnect owns the parent before sweeping plans.
    select request.*
      into request_record
    from public.connection_requests as request
    where request.id = new.connection_request_id;
  end if;

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
    raise exception 'Connection plan status must change';
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

    if new.status = 'completed' and old.starts_at > now() then
      raise exception 'A connection plan cannot be completed before its scheduled time';
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

revoke all on function public.validate_user_report()
  from public, anon, authenticated;
revoke all on function public.validate_connection_plan()
  from public, anon, authenticated;
