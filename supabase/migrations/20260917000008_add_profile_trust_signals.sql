-- CocoApp Phase 7: expose truthful account trust signals without exposing Auth email.
-- Confirmed email and education-domain email are not the same as student verification.

alter table public.profiles
  add column if not exists email_confirmed boolean not null default false;

alter table public.profiles
  add column if not exists education_email boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_education_email_requires_confirmation'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_education_email_requires_confirmation
      check (not education_email or email_confirmed);
  end if;
end;
$$;

create or replace function public.is_education_email(candidate_email text)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select lower(split_part(candidate_email, '@', 2)) ~ '(^|[.])edu([.]vn)?$';
$$;

-- New accounts receive trust signals from Auth. Existing profile content is never
-- overwritten if the trigger is replayed for an existing user.
create or replace function public.create_profile_for_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    university,
    email_confirmed,
    education_email
  )
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'fullName'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      ''
    ),
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'university'), ''), ''),
    new.email_confirmed_at is not null,
    new.email_confirmed_at is not null
      and coalesce(public.is_education_email(new.email), false)
  )
  on conflict (id) do update
  set
    email_confirmed = excluded.email_confirmed,
    education_email = excluded.education_email;

  insert into public.profile_private (profile_id)
  values (new.id)
  on conflict (profile_id) do nothing;

  return new;
end;
$$;

create or replace function public.sync_profile_auth_trust()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set
    email_confirmed = new.email_confirmed_at is not null,
    education_email = new.email_confirmed_at is not null
      and coalesce(public.is_education_email(new.email), false)
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists auth_users_sync_profile_trust on auth.users;
create trigger auth_users_sync_profile_trust
after update of email, email_confirmed_at on auth.users
for each row
when (
  old.email is distinct from new.email
  or old.email_confirmed_at is distinct from new.email_confirmed_at
)
execute function public.sync_profile_auth_trust();

-- Backfill only derived booleans. Exact Auth emails never enter public.profiles.
update public.profiles as profile
set
  email_confirmed = users.email_confirmed_at is not null,
  education_email = users.email_confirmed_at is not null
    and coalesce(public.is_education_email(users.email), false)
from auth.users as users
where profile.id = users.id;

create or replace function public.prevent_profile_trust_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
      (tg_op = 'INSERT' and (new.email_confirmed or new.education_email))
      or (
        tg_op = 'UPDATE'
        and (
          new.email_confirmed is distinct from old.email_confirmed
          or new.education_email is distinct from old.education_email
        )
      )
    )
    and current_user not in ('postgres', 'service_role', 'supabase_admin') then
    raise exception 'Profile trust signals are managed by Supabase Auth';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_prevent_trust_change on public.profiles;
create trigger profiles_prevent_trust_change
before insert or update on public.profiles
for each row execute function public.prevent_profile_trust_change();

-- Recreate the blocked-user-safe discovery RPC with public trust signals only.
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
  public_location text,
  bio text,
  email_confirmed boolean,
  education_email boolean,
  verification_status text
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
    profile.bio,
    profile.email_confirmed,
    profile.education_email,
    profile.verification_status
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

revoke all on function public.is_education_email(text) from public;
revoke all on function public.create_profile_for_user() from public;
revoke all on function public.sync_profile_auth_trust() from public;
revoke all on function public.prevent_profile_trust_change() from public;
revoke all on function public.get_discover_profiles() from public;

grant execute on function public.get_discover_profiles() to authenticated;
