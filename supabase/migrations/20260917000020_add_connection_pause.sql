-- CocoApp Phase 20: let members pause new connections without losing their
-- existing conversations. The setting is enforced by discovery and writes,
-- not only hidden in the client.

alter table public.profiles
  add column if not exists accepting_connections boolean not null default true;

comment on column public.profiles.accepting_connections is
  'Owner-controlled switch for discovery, saves, and new connection requests.';

create or replace function public.can_start_new_connections(profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = profile_id
      and profile.accepting_connections
      and public.is_connection_ready_profile(profile.id)
  );
$$;

revoke all on function public.can_start_new_connections(uuid)
  from public, anon, authenticated;

create or replace function public.get_discover_profiles()
returns table (
  id uuid,
  full_name text,
  gender text,
  major text,
  purpose text,
  city text,
  area text,
  bio text,
  email_confirmed boolean,
  education_email boolean,
  verification_status text,
  availability_slots text[],
  collaboration_style text,
  commitment_level text
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
    profile.bio,
    profile.email_confirmed,
    profile.education_email,
    profile.verification_status,
    profile.availability_slots,
    profile.collaboration_style,
    profile.commitment_level
  from public.profiles as profile
  where auth.uid() is not null
    and public.can_start_new_connections(auth.uid())
    and profile.id <> auth.uid()
    and public.can_start_new_connections(profile.id)
    and not exists (
      select 1
      from public.user_blocks as block
      where (block.blocker_id = auth.uid() and block.blocked_id = profile.id)
         or (block.blocker_id = profile.id and block.blocked_id = auth.uid())
    )
  order by profile.created_at desc, profile.id;
$$;

revoke all on function public.get_discover_profiles()
  from public, anon, authenticated;
grant execute on function public.get_discover_profiles() to authenticated;

create or replace function public.guard_new_connection_availability()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_start_new_connections(new.requester_id)
    or not public.can_start_new_connections(new.recipient_id) then
    raise exception 'connection_requests_paused';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_new_connection_availability()
  from public, anon, authenticated;

drop trigger if exists connection_requests_availability_guard
  on public.connection_requests;
create trigger connection_requests_availability_guard
before insert on public.connection_requests
for each row execute function public.guard_new_connection_availability();

-- A hidden member also disappears from a saved-only discovery view. Existing
-- private saved rows may remain, but no new hidden profile can be saved.
create or replace function public.validate_saved_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or new.owner_id <> auth.uid() then
    raise exception 'saved_profile_owner_mismatch';
  end if;

  if not public.can_start_new_connections(new.owner_id)
    or not public.can_start_new_connections(new.saved_profile_id) then
    raise exception 'saved_profile_not_discoverable';
  end if;

  if exists (
    select 1
    from public.user_blocks as block
    where (block.blocker_id = new.owner_id and block.blocked_id = new.saved_profile_id)
       or (block.blocker_id = new.saved_profile_id and block.blocked_id = new.owner_id)
  ) then
    raise exception 'saved_profile_blocked';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_saved_profile()
  from public, anon, authenticated;
