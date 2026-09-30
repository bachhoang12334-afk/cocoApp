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
const trustMigration = await readFile(
  new URL('../supabase/migrations/20260917000008_add_profile_trust_signals.sql', import.meta.url),
  'utf8'
)
const connectionIntroMigration = await readFile(
  new URL('../supabase/migrations/20260917000009_add_connection_request_intros.sql', import.meta.url),
  'utf8'
)
const matchingPreferencesMigration = await readFile(
  new URL('../supabase/migrations/20260917000010_add_matching_preferences.sql', import.meta.url),
  'utf8'
)
const discoverTrustFunction = trustMigration.match(
  /create function public\.get_discover_profiles\(\)[\s\S]*?\$\$;/
)?.[0] || ''
const discoverPreferencesFunction = matchingPreferencesMigration.match(
  /create function public\.get_discover_profiles\(\)[\s\S]*?\$\$;/
)?.[0] || ''

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

test('connection invitation intros are required for new requests and immutable after sending', () => {
  assert.match(connectionIntroMigration, /add column if not exists intro_message text/)
  assert.match(connectionIntroMigration, /char_length\(intro_message\) between 8 and 240/)
  assert.match(connectionIntroMigration, /if tg_op = 'INSERT'/)
  assert.match(connectionIntroMigration, /intro cannot be changed after sending/i)
  assert.match(connectionIntroMigration, /before insert or update on public\.connection_requests/)
  assert.doesNotMatch(connectionIntroMigration, /notifications|profile_private/i)
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

test('profile trust signals are derived from Auth and protected from clients', () => {
  assert.match(trustMigration, /new\.email_confirmed_at is not null/)
  assert.match(trustMigration, /check \(not education_email or email_confirmed\)/)
  assert.match(trustMigration, /Profile trust signals are managed by Supabase Auth/)
  assert.match(trustMigration, /after update of email, email_confirmed_at on auth\.users/)
  assert.match(trustMigration, /revoke all on function public\.sync_profile_auth_trust\(\) from public/)
})

test('public discovery exposes trust booleans without exposing Auth email or private profile data', () => {
  assert.match(discoverTrustFunction, /profile\.email_confirmed/)
  assert.match(discoverTrustFunction, /profile\.education_email/)
  assert.match(discoverTrustFunction, /profile\.verification_status/)
  assert.doesNotMatch(discoverTrustFunction, /profile_private/)
  assert.doesNotMatch(discoverTrustFunction, /users\.email/i)
  assert.doesNotMatch(trustMigration, /verification_status\s*=\s*'verified'/i)
})

test('matching preferences stay broad, validated, and separate from private profile data', () => {
  assert.match(matchingPreferencesMigration, /add column if not exists availability_slots text\[\]/)
  assert.match(matchingPreferencesMigration, /cardinality\(availability_slots\) <= 6/)
  assert.match(matchingPreferencesMigration, /profiles_collaboration_style_allowed/)
  assert.match(matchingPreferencesMigration, /profiles_commitment_level_allowed/)
  assert.match(discoverPreferencesFunction, /profile\.availability_slots/)
  assert.match(discoverPreferencesFunction, /profile\.collaboration_style/)
  assert.match(discoverPreferencesFunction, /profile\.commitment_level/)
  assert.doesNotMatch(discoverPreferencesFunction, /profile_private|exact_address|phone/i)
  assert.match(matchingPreferencesMigration, /grant execute on function public\.get_discover_profiles\(\) to authenticated/)
})
