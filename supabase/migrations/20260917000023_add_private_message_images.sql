-- Private image attachments for one-to-one messages.
-- Originals are normalized to WebP in the browser before upload so EXIF/GPS
-- metadata is not retained. Stored objects are never public.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'message-images',
  'message-images',
  false,
  5242880,
  array['image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.messages
  add column if not exists image_path text,
  add column if not exists image_mime_type text,
  add column if not exists image_size_bytes integer;

alter table public.messages
  alter column body drop not null;

alter table public.messages
  drop constraint if exists messages_body_check;

alter table public.messages
  drop constraint if exists messages_content_check;

alter table public.messages
  add constraint messages_content_check check (
    (
      body is null
      or (
        body = btrim(body)
        and char_length(body) between 1 and 1000
      )
    )
    and (body is not null or image_path is not null)
    and (
      (
        image_path is null
        and image_mime_type is null
        and image_size_bytes is null
      )
      or (
        image_path is not null
        and image_mime_type = 'image/webp'
        and image_size_bytes between 1 and 5242880
        and image_path ~ (
          '^'
          || connection_request_id::text
          || '/'
          || sender_id::text
          || '/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
        )
      )
    )
  );

create or replace function public.validate_message_image()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.body := nullif(btrim(new.body), '');

  if new.image_path is not null and not exists (
    select 1
    from storage.objects as object
    where object.bucket_id = 'message-images'
      and object.name = new.image_path
  ) then
    raise exception 'Message image was not found';
  end if;

  return new;
end;
$$;

drop trigger if exists messages_validate_image on public.messages;
create trigger messages_validate_image
before insert on public.messages
for each row execute function public.validate_message_image();

create or replace function public.protect_message_read_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.connection_request_id is distinct from old.connection_request_id
    or new.sender_id is distinct from old.sender_id
    or new.body is distinct from old.body
    or new.image_path is distinct from old.image_path
    or new.image_mime_type is distinct from old.image_mime_type
    or new.image_size_bytes is distinct from old.image_size_bytes
    or new.created_at is distinct from old.created_at then
    raise exception 'Message content and ownership fields cannot be changed';
  end if;

  if old.read_at is null then
    new.read_at := now();
  else
    new.read_at := old.read_at;
  end if;

  return new;
end;
$$;

revoke all on table public.messages from anon, authenticated;
grant select on table public.messages to authenticated;
grant insert (
  id,
  connection_request_id,
  sender_id,
  body,
  image_path,
  image_mime_type,
  image_size_bytes
) on table public.messages to authenticated;
grant update (read_at) on table public.messages to authenticated;

drop policy if exists "Connection participants can view message images"
  on storage.objects;
create policy "Connection participants can view message images"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'message-images'
    and exists (
      select 1
      from public.connection_requests as request
      where request.id::text = (storage.foldername(name))[1]
        and request.status = 'accepted'
        and (select auth.uid()) in (request.requester_id, request.recipient_id)
    )
  );

drop policy if exists "Participants can upload their own message images"
  on storage.objects;
create policy "Participants can upload their own message images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'message-images'
    and array_length(storage.foldername(name), 1) = 2
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and storage.filename(name) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
    and exists (
      select 1
      from public.connection_requests as request
      where request.id::text = (storage.foldername(name))[1]
        and request.status = 'accepted'
        and (select auth.uid()) in (request.requester_id, request.recipient_id)
    )
  );

drop policy if exists "Senders can remove their own message images"
  on storage.objects;
create policy "Senders can remove their own message images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'message-images'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and exists (
      select 1
      from public.connection_requests as request
      where request.id::text = (storage.foldername(name))[1]
        and (select auth.uid()) in (request.requester_id, request.recipient_id)
    )
    and not exists (
      select 1
      from public.messages as message
      where message.image_path = name
    )
  );

revoke all on function public.validate_message_image() from public;
revoke all on function public.protect_message_read_update() from public;
