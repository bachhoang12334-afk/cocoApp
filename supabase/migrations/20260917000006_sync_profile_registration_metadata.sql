-- CocoApp Phase 5A: make Supabase the only profile source of truth.
-- New accounts keep their registration name and university in public.profiles.

create or replace function public.create_profile_for_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, university)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'fullName'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      ''
    ),
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'university'), ''), '')
  )
  on conflict (id) do nothing;

  insert into public.profile_private (profile_id)
  values (new.id)
  on conflict (profile_id) do nothing;

  return new;
end;
$$;

-- Fill only missing values for accounts created before this migration.
-- Existing profile edits always win over Auth metadata.
update public.profiles as profile
set
  full_name = case
    when nullif(btrim(profile.full_name), '') is null then coalesce(
      nullif(btrim(users.raw_user_meta_data ->> 'fullName'), ''),
      nullif(btrim(users.raw_user_meta_data ->> 'full_name'), ''),
      profile.full_name
    )
    else profile.full_name
  end,
  university = case
    when nullif(btrim(profile.university), '') is null then coalesce(
      nullif(btrim(users.raw_user_meta_data ->> 'university'), ''),
      profile.university
    )
    else profile.university
  end
from auth.users as users
where profile.id = users.id
  and (
    (
      nullif(btrim(profile.full_name), '') is null
      and coalesce(
        nullif(btrim(users.raw_user_meta_data ->> 'fullName'), ''),
        nullif(btrim(users.raw_user_meta_data ->> 'full_name'), '')
      ) is not null
    )
    or (
      nullif(btrim(profile.university), '') is null
      and nullif(btrim(users.raw_user_meta_data ->> 'university'), '') is not null
    )
  );

-- Profile identity can update open tabs immediately. This is public profile data;
-- profile_private is intentionally not added to Realtime.
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
      and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end;
$$;
