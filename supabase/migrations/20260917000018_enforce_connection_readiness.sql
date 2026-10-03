-- CocoApp Phase 18: keep discovery and connection creation limited to profiles
-- that contain the public context needed for a purposeful, privacy-safe match.

create or replace function public.is_connection_ready_profile(profile_id uuid)
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
      and nullif(btrim(profile.full_name), '') is not null
      and nullif(btrim(profile.university), '') is not null
      and nullif(btrim(profile.major), '') is not null
      and profile.study_year in ('Năm 1', 'Năm 2', 'Năm 3', 'Năm 4', 'Khác')
      and profile.gender in ('Nam', 'Nữ', 'Khác', 'Không muốn công khai')
      and profile.purpose in ('Học nhóm', 'Team Project', 'Ghép trọ')
      and nullif(btrim(profile.city), '') is not null
      and nullif(btrim(profile.area), '') is not null
      and profile.proximity_scope in ('same_area', 'same_city', 'anywhere')
  );
$$;

revoke all on function public.is_connection_ready_profile(uuid)
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
    and public.is_connection_ready_profile(auth.uid())
    and profile.id <> auth.uid()
    and public.is_connection_ready_profile(profile.id)
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

    if not public.is_connection_ready_profile(new.requester_id)
      or not public.is_connection_ready_profile(new.recipient_id) then
      raise exception 'connection_profile_not_ready';
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

revoke all on function public.validate_connection_request()
  from public, anon, authenticated;
