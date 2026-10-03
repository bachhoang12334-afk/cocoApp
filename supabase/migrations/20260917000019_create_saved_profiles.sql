-- CocoApp Phase 19: private, owner-only profile shortlists for discovery.
-- Saving is intentionally silent: the saved person receives no notification.

create table if not exists public.saved_profiles (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  saved_profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, saved_profile_id),
  constraint saved_profiles_not_self check (owner_id <> saved_profile_id)
);

create index if not exists saved_profiles_owner_created_idx
  on public.saved_profiles (owner_id, created_at desc);

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

  if not public.is_connection_ready_profile(new.owner_id)
    or not public.is_connection_ready_profile(new.saved_profile_id) then
    raise exception 'saved_profile_not_ready';
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

drop trigger if exists saved_profiles_validate on public.saved_profiles;
create trigger saved_profiles_validate
before insert on public.saved_profiles
for each row execute function public.validate_saved_profile();

create or replace function public.remove_saved_profiles_on_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.saved_profiles as saved
  where (saved.owner_id = new.blocker_id and saved.saved_profile_id = new.blocked_id)
     or (saved.owner_id = new.blocked_id and saved.saved_profile_id = new.blocker_id);

  return new;
end;
$$;

revoke all on function public.remove_saved_profiles_on_block()
  from public, anon, authenticated;

drop trigger if exists user_blocks_remove_saved_profiles on public.user_blocks;
create trigger user_blocks_remove_saved_profiles
after insert on public.user_blocks
for each row execute function public.remove_saved_profiles_on_block();

alter table public.saved_profiles enable row level security;

revoke all on table public.saved_profiles from anon, authenticated;
grant select on table public.saved_profiles to authenticated;
grant insert (owner_id, saved_profile_id) on table public.saved_profiles to authenticated;
grant delete on table public.saved_profiles to authenticated;

drop policy if exists "Users can view profiles they saved" on public.saved_profiles;
create policy "Users can view profiles they saved"
  on public.saved_profiles
  for select
  to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "Users can save discoverable profiles" on public.saved_profiles;
create policy "Users can save discoverable profiles"
  on public.saved_profiles
  for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and saved_profile_id <> (select auth.uid())
  );

drop policy if exists "Users can remove profiles they saved" on public.saved_profiles;
create policy "Users can remove profiles they saved"
  on public.saved_profiles
  for delete
  to authenticated
  using (owner_id = (select auth.uid()));
