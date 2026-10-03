-- CocoApp Phase 21: let a signed-in member permanently remove their own
-- Auth identity and every profile-owned row. The function intentionally has
-- no user-id parameter, so the caller can never select another account.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'account_deletion_unauthorized';
  end if;

  delete from auth.users as auth_user
  where auth_user.id = current_user_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'account_deletion_not_found';
  end if;
end;
$$;

comment on function public.delete_my_account() is
  'Permanently deletes only auth.uid(); profile-owned rows cascade from auth.users.';

revoke all on function public.delete_my_account()
  from public, anon, authenticated;
grant execute on function public.delete_my_account() to authenticated;
