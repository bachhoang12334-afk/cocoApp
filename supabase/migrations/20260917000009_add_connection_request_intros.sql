-- CocoApp: purposeful connection invitations.
-- Existing requests remain nullable; every new request must include an immutable intro.

alter table public.connection_requests
  add column if not exists intro_message text;

alter table public.connection_requests
  drop constraint if exists connection_requests_intro_message_length;
alter table public.connection_requests
  add constraint connection_requests_intro_message_length check (
    intro_message is null
    or (
      char_length(intro_message) between 8 and 240
      and intro_message = btrim(intro_message)
    )
  );

create or replace function public.protect_connection_request_intro()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.intro_message := nullif(btrim(new.intro_message), '');

    if new.intro_message is null
      or char_length(new.intro_message) < 8
      or char_length(new.intro_message) > 240 then
      raise exception 'Connection request intro must be between 8 and 240 characters';
    end if;

    return new;
  end if;

  if new.intro_message is distinct from old.intro_message then
    raise exception 'Connection request intro cannot be changed after sending';
  end if;

  return new;
end;
$$;

drop trigger if exists connection_requests_protect_intro
  on public.connection_requests;
create trigger connection_requests_protect_intro
before insert or update on public.connection_requests
for each row execute function public.protect_connection_request_intro();

revoke all on function public.protect_connection_request_intro() from public;

comment on column public.connection_requests.intro_message is
  'Purposeful introduction visible only to the request participants through connection request RLS.';
