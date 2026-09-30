-- CocoApp Phase 9: close direct profile reads and expose only scoped read models.
-- Discovery remains available through get_discover_profiles(). Private profile data
-- is intentionally excluded from every function in this migration.

revoke all on table public.profiles from anon;

drop policy if exists "Authenticated users can view public profiles"
  on public.profiles;
drop policy if exists "Users can view their own profile"
  on public.profiles;
drop policy if exists "Profiles remain self-only"
  on public.profiles;
create policy "Users can view their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

-- A restrictive policy prevents a future permissive policy from accidentally
-- reopening arbitrary cross-user reads.
create policy "Profiles remain self-only"
  on public.profiles
  as restrictive
  for select
  to authenticated
  using ((select auth.uid()) = id);

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
    other_profile.public_location,
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

create or replace function public.get_my_notifications()
returns table (
  id uuid,
  recipient_id uuid,
  actor_id uuid,
  connection_request_id uuid,
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

revoke all on function public.get_my_connection_requests() from public, anon, authenticated;
revoke all on function public.get_my_notifications() from public, anon, authenticated;

grant execute on function public.get_my_connection_requests() to authenticated;
grant execute on function public.get_my_notifications() to authenticated;
