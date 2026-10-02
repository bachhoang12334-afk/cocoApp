-- Limit connection-request writes to the fields the authenticated client owns.
-- Earlier migrations are already applied, so this hardening is additive.

revoke insert, update
  on table public.connection_requests
  from authenticated;

-- Clear any historical column-level grants before installing the exact
-- allowlist. Repeating these REVOKE and GRANT statements is safe.
revoke insert (
  id,
  requester_id,
  recipient_id,
  purpose,
  status,
  created_at,
  updated_at,
  responded_at,
  intro_message
), update (
  id,
  requester_id,
  recipient_id,
  purpose,
  status,
  created_at,
  updated_at,
  responded_at,
  intro_message
) on table public.connection_requests from authenticated;

grant select on table public.connection_requests to authenticated;
grant insert (
  requester_id,
  recipient_id,
  purpose,
  intro_message
) on table public.connection_requests to authenticated;
grant update (status) on table public.connection_requests to authenticated;
