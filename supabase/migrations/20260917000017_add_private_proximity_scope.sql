-- CocoApp Phase 17: replace simulated kilometre filtering with broad, honest
-- location scopes. The preference is owner-controlled and discovery shares only
-- the city/area labels supplied by each member. GPS, coordinates, owner-private
-- fields, and the more detailed public_location field are not exposed.

alter table public.profiles
  add column if not exists proximity_scope text not null default 'same_city';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_proximity_scope_allowed'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_proximity_scope_allowed
      check (proximity_scope in ('same_area', 'same_city', 'anywhere'));
  end if;
end;
$$;

comment on column public.profiles.proximity_scope is
  'Owner-selected discovery scope based only on broad public city and area labels.';

-- Recreate discovery without public_location. That field can contain a street or
-- landmark and is only appropriate after a connection has been established.
drop function if exists public.get_discover_profiles();
create function public.get_discover_profiles()
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
    and profile.id <> auth.uid()
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

-- Pending requests need a public identity to be actionable, but they must not be
-- a shortcut for reading the more detailed landmark/street field. Keep the
-- existing return shape for clients and reveal that field only after acceptance.
create or replace function public.get_my_connection_requests()
returns table (
  id uuid,
  requester_id uuid,
  recipient_id uuid,
  purpose text,
  intro_message text,
  status text,
  created_at timestamptz,
  responded_at timestamptz,
  other_profile_id uuid,
  other_full_name text,
  other_major text,
  other_purpose text,
  other_city text,
  other_area text,
  other_public_location text,
  other_bio text,
  other_email_confirmed boolean,
  other_education_email boolean,
  other_verification_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    request.id,
    request.requester_id,
    request.recipient_id,
    request.purpose,
    request.intro_message,
    request.status,
    request.created_at,
    request.responded_at,
    other_profile.id,
    other_profile.full_name,
    other_profile.major,
    other_profile.purpose,
    other_profile.city,
    other_profile.area,
    case
      when request.status = 'accepted' then other_profile.public_location
      else null
    end,
    other_profile.bio,
    other_profile.email_confirmed,
    other_profile.education_email,
    other_profile.verification_status
  from public.connection_requests as request
  join public.profiles as other_profile
    on other_profile.id = case
      when request.requester_id = auth.uid() then request.recipient_id
      else request.requester_id
    end
  where auth.uid() is not null
    and auth.uid() in (request.requester_id, request.recipient_id)
    and request.status in ('pending', 'accepted')
    and not exists (
      select 1
      from public.user_blocks as block
      where (block.blocker_id = auth.uid() and block.blocked_id = other_profile.id)
         or (block.blocker_id = other_profile.id and block.blocked_id = auth.uid())
    )
  order by request.created_at desc, request.id;
$$;

revoke all on function public.get_my_connection_requests()
  from public, anon, authenticated;
grant execute on function public.get_my_connection_requests() to authenticated;
