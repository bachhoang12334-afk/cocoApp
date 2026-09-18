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
