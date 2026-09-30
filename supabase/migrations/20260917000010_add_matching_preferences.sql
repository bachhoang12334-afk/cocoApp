-- CocoApp Phase 8: add broad, public collaboration preferences for Coco Fit.
-- These fields intentionally avoid exact timetables, class locations, or private contact data.

alter table public.profiles
  add column if not exists availability_slots text[] not null default '{}'::text[];

alter table public.profiles
  add column if not exists collaboration_style text not null default '';

alter table public.profiles
  add column if not exists commitment_level text not null default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_availability_slots_allowed'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_availability_slots_allowed
      check (
        availability_slots <@ array[
          'weekday_morning',
          'weekday_afternoon',
          'weekday_evening',
          'weekend_morning',
          'weekend_afternoon',
          'weekend_evening'
        ]::text[]
        and cardinality(availability_slots) <= 6
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_collaboration_style_allowed'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_collaboration_style_allowed
      check (collaboration_style in ('', 'structured', 'flexible', 'focused', 'collaborative'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_commitment_level_allowed'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_commitment_level_allowed
      check (commitment_level in ('', 'light', 'steady', 'intensive'));
  end if;
end;
$$;

-- Recreate discovery so only broad public preferences are shared.
-- profile_private and exact Auth email data remain excluded.
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
    profile.public_location,
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

revoke all on function public.get_discover_profiles() from public;
grant execute on function public.get_discover_profiles() to authenticated;
