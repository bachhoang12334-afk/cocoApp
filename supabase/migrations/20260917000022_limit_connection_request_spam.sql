-- CocoApp Phase 22: enforce invitation rate limits at the database boundary.
-- Closed requests still count so cancelling or declining cannot bypass limits.

create index if not exists connection_requests_requester_created_idx
  on public.connection_requests (requester_id, created_at desc);

create index if not exists connection_requests_pair_history_idx
  on public.connection_requests (
    least(requester_id, recipient_id),
    greatest(requester_id, recipient_id),
    (coalesce(responded_at, updated_at, created_at)) desc
  )
  where status in ('declined', 'cancelled');

create or replace function public.limit_connection_request_spam()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_request_count integer;
  daily_request_count integer;
begin
  if auth.uid() is null or new.requester_id <> auth.uid() then
    raise exception using
      errcode = 'P0001',
      message = 'connection_request_requester_mismatch';
  end if;

  -- Serialize inserts per requester so parallel tabs cannot race past counts.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.requester_id::text, 0)
  );

  if exists (
    select 1
    from public.connection_requests as request
    where least(request.requester_id, request.recipient_id)
        = least(new.requester_id, new.recipient_id)
      and greatest(request.requester_id, request.recipient_id)
        = greatest(new.requester_id, new.recipient_id)
      and request.status in ('declined', 'cancelled')
      and coalesce(request.responded_at, request.updated_at, request.created_at)
        >= pg_catalog.now() - interval '60 minutes'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'connection_request_recipient_cooldown';
  end if;

  select count(*)
  into recent_request_count
  from public.connection_requests as request
  where request.requester_id = new.requester_id
    and request.created_at >= pg_catalog.now() - interval '10 minutes';

  if recent_request_count >= 5 then
    raise exception using
      errcode = 'P0001',
      message = 'connection_request_rate_limit_short_window';
  end if;

  select count(*)
  into daily_request_count
  from public.connection_requests as request
  where request.requester_id = new.requester_id
    and request.created_at >= pg_catalog.now() - interval '24 hours';

  if daily_request_count >= 20 then
    raise exception using
      errcode = 'P0001',
      message = 'connection_request_rate_limit_daily';
  end if;

  return new;
end;
$$;

revoke all on function public.limit_connection_request_spam()
  from public, anon, authenticated;

drop trigger if exists connection_requests_rate_limit
  on public.connection_requests;
create trigger connection_requests_rate_limit
before insert on public.connection_requests
for each row execute function public.limit_connection_request_spam();

comment on function public.limit_connection_request_spam() is
  'Prevents invitation bursts and rapid repeat requests without exposing request history.';
