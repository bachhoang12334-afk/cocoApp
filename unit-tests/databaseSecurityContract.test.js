import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const connectionSchema = await readFile(
  new URL('../supabase/migrations/20260917000001_create_connection_requests.sql', import.meta.url),
  'utf8'
)
const disconnectMigration = await readFile(
  new URL('../supabase/migrations/20260917000002_allow_connection_disconnect.sql', import.meta.url),
  'utf8'
)
const messageSchema = await readFile(
  new URL('../supabase/migrations/20260917000004_create_messages.sql', import.meta.url),
  'utf8'
)
const readStatusMigration = await readFile(
  new URL('../supabase/migrations/20260917000005_add_message_read_status.sql', import.meta.url),
  'utf8'
)
const profileSyncMigration = await readFile(
  new URL('../supabase/migrations/20260917000006_sync_profile_registration_metadata.sql', import.meta.url),
  'utf8'
)
const safetyMigration = await readFile(
  new URL('../supabase/migrations/20260917000007_create_safety_tools.sql', import.meta.url),
  'utf8'
)

test('connection schema permits reconnect only after the previous active row is closed', () => {
  assert.match(
    connectionSchema,
    /where status in \('pending', 'accepted'\)/
  )
  assert.match(
    disconnectMigration,
    /old\.status = 'accepted'[\s\S]*new\.status <> 'cancelled'/
  )
  assert.match(
    disconnectMigration,
    /Participants can disconnect accepted requests/
  )
})

test('message inserts require an accepted connection and the authenticated sender', () => {
  assert.match(messageSchema, /sender_id = \(select auth\.uid\(\)\)/)
  assert.match(messageSchema, /request\.status = 'accepted'/)
  assert.match(
    messageSchema,
    /grant insert \(id, connection_request_id, sender_id, body\)/
  )
  assert.doesNotMatch(messageSchema, /grant delete/i)
})

test('message updates expose only read_at and protect content fields', () => {
  assert.match(readStatusMigration, /grant update \(read_at\)/)
  assert.match(readStatusMigration, /sender_id <> \(select auth\.uid\(\)\)/)
  assert.match(readStatusMigration, /new\.body is distinct from old\.body/)
  assert.doesNotMatch(readStatusMigration, /grant delete/i)
})

test('registration metadata initializes only public profile identity fields', () => {
  assert.match(
    profileSyncMigration,
    /insert into public\.profiles \(id, full_name, university\)/
  )
  assert.match(
    profileSyncMigration,
    /nullif\(btrim\(new\.raw_user_meta_data ->> 'university'\), ''\)/
  )
  assert.match(
    profileSyncMigration,
    /alter publication supabase_realtime add table public\.profiles/
  )
  assert.doesNotMatch(
    profileSyncMigration,
    /alter publication supabase_realtime add table public\.profile_private/
  )
})

test('blocking is owner-controlled and closes active connections', () => {
  assert.match(safetyMigration, /alter table public\.user_blocks enable row level security/)
  assert.match(safetyMigration, /using \(blocker_id = \(select auth\.uid\(\)\)\)/)
  assert.match(safetyMigration, /update public\.connection_requests[\s\S]*set status = 'cancelled'[\s\S]*status in \('pending', 'accepted'\)/i)
  assert.match(safetyMigration, /Users cannot connect while blocked/)
  assert.match(safetyMigration, /create or replace function public\.get_discover_profiles\(\)/)
})

test('reports remain private and clients cannot edit or delete them', () => {
  assert.match(safetyMigration, /alter table public\.user_reports enable row level security/)
  assert.match(safetyMigration, /using \(reporter_id = \(select auth\.uid\(\)\)\)/)
  assert.match(safetyMigration, /grant insert \([\s\S]*category,[\s\S]*details[\s\S]*\) on table public\.user_reports/)
  assert.doesNotMatch(safetyMigration, /grant update(?:\s|\([^)]*\))*on table public\.user_reports/i)
  assert.doesNotMatch(safetyMigration, /grant delete on table public\.user_reports/i)
  assert.match(safetyMigration, /user_reports_open_context_idx/)
})
