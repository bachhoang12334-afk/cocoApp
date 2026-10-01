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
const profileAccessMigration = await readFile(
  new URL('../supabase/migrations/20260917000011_harden_profile_access.sql', import.meta.url),
  'utf8'
)
const connectionPlansMigration = await readFile(
  new URL('../supabase/migrations/20260917000012_create_connection_plans.sql', import.meta.url),
  'utf8'
)
const connectionPlanHardeningMigration = await readFile(
  new URL('../supabase/migrations/20260917000013_harden_connection_plan_transitions.sql', import.meta.url),
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

test('direct profile reads are restricted to the authenticated user', () => {
  assert.match(
    profileAccessMigration,
    /drop policy if exists "Authenticated users can view public profiles"/
  )
  assert.match(
    profileAccessMigration,
    /create policy "Users can view their own profile"[\s\S]*using \(\(select auth\.uid\(\)\) = id\)/
  )
  assert.match(
    profileAccessMigration,
    /create policy "Profiles remain self-only"[\s\S]*as restrictive[\s\S]*using \(\(select auth\.uid\(\)\) = id\)/
  )
  assert.match(profileAccessMigration, /revoke all on table public\.profiles from anon/)
  assert.doesNotMatch(profileAccessMigration, /using \(true\)/i)
})

test('connection profile reads require an active participant relationship and no block', () => {
  const connectionFunction = profileAccessMigration.match(
    /create or replace function public\.get_my_connection_requests\(\)[\s\S]*?\$\$;/
  )?.[0] || ''

  assert.match(connectionFunction, /security definer/)
  assert.match(connectionFunction, /set search_path = ''/)
  assert.match(connectionFunction, /auth\.uid\(\) in \(request\.requester_id, request\.recipient_id\)/)
  assert.match(connectionFunction, /request\.status in \('pending', 'accepted'\)/)
  assert.match(connectionFunction, /block\.blocker_id = other_profile\.id and block\.blocked_id = auth\.uid\(\)/)
  assert.doesNotMatch(connectionFunction, /profile_private|university|study_year|exact_address|phone/i)
  assert.match(profileAccessMigration, /revoke all on function public\.get_my_connection_requests\(\) from public, anon, authenticated/)
  assert.match(profileAccessMigration, /grant execute on function public\.get_my_connection_requests\(\) to authenticated/)
})

test('notification actor names are recipient-scoped and hidden after either user blocks', () => {
  const notificationFunction = profileAccessMigration.match(
    /create or replace function public\.get_my_notifications\(\)[\s\S]*?\$\$;/
  )?.[0] || ''

  assert.match(notificationFunction, /security definer/)
  assert.match(notificationFunction, /notification\.recipient_id = auth\.uid\(\)/)
  assert.match(notificationFunction, /left join public\.profiles as actor/)
  assert.match(notificationFunction, /block\.blocker_id = actor\.id and block\.blocked_id = auth\.uid\(\)/)
  assert.doesNotMatch(notificationFunction, /profile_private|university|study_year|exact_address|phone/i)
  assert.match(profileAccessMigration, /grant execute on function public\.get_my_notifications\(\) to authenticated/)
})

test('Coco Plan allows only one active plan per connection with constrained public fields', () => {
  assert.match(connectionPlansMigration, /mode in \('online', 'campus', 'public_place'\)/)
  assert.match(connectionPlansMigration, /status in \('proposed', 'accepted', 'declined', 'cancelled', 'completed'\)/)
  assert.match(connectionPlansMigration, /char_length\(title\) between 4 and 120/)
  assert.match(connectionPlansMigration, /char_length\(location_note\) between 1 and 160/)
  assert.match(
    connectionPlansMigration,
    /create unique index[\s\S]*connection_request_id[\s\S]*where status in \('proposed', 'accepted'\)/
  )
})

test('Coco Plan RLS requires an accepted, unblocked participant relationship', () => {
  const accessFunction = connectionPlansMigration.match(
    /create or replace function public\.can_access_connection_plan\([\s\S]*?\$\$;/
  )?.[0] || ''

  assert.match(connectionPlansMigration, /alter table public\.connection_plans enable row level security/)
  assert.match(accessFunction, /security definer/)
  assert.match(accessFunction, /set search_path = ''/)
  assert.match(accessFunction, /auth\.uid\(\) in \(request\.requester_id, request\.recipient_id\)/)
  assert.match(accessFunction, /request\.status = 'accepted'/)
  assert.match(accessFunction, /block\.blocker_id = request\.requester_id and block\.blocked_id = request\.recipient_id/)
  assert.match(accessFunction, /block\.blocker_id = request\.recipient_id and block\.blocked_id = request\.requester_id/)
  assert.match(connectionPlansMigration, /proposer_id = \(select auth\.uid\(\)\)/)
  assert.match(connectionPlansMigration, /with check \([\s\S]*can_access_connection_plan\(connection_request_id, true\)[\s\S]*\)/)
  assert.match(connectionPlansMigration, /for update[\s\S]*using \(public\.can_access_connection_plan\(connection_request_id, true\)\)[\s\S]*with check \(public\.can_access_connection_plan\(connection_request_id, true\)\)/)
  assert.match(connectionPlansMigration, /grant execute on function public\.can_access_connection_plan\(uuid, boolean\)[\s\S]*to authenticated/)
})

test('Coco Plan details are immutable and clients can update only status', () => {
  const validationFunction = connectionPlansMigration.match(
    /create or replace function public\.validate_connection_plan\(\)[\s\S]*?\$\$;/
  )?.[0] || ''

  assert.match(connectionPlansMigration, /grant update \(status\) on table public\.connection_plans/)
  assert.match(validationFunction, /new\.connection_request_id is distinct from old\.connection_request_id/)
  assert.match(validationFunction, /new\.proposer_id is distinct from old\.proposer_id/)
  assert.match(validationFunction, /new\.title is distinct from old\.title/)
  assert.match(validationFunction, /new\.starts_at is distinct from old\.starts_at/)
  assert.match(validationFunction, /new\.mode is distinct from old\.mode/)
  assert.match(validationFunction, /new\.location_note is distinct from old\.location_note/)
  assert.doesNotMatch(connectionPlansMigration, /grant[^;]*(?:delete|\ball\b)[^;]*on table public\.connection_plans/i)
  assert.doesNotMatch(connectionPlansMigration, /for delete/i)
})

test('Coco Plan transitions enforce ownership and terminal states', () => {
  const validationFunction = connectionPlansMigration.match(
    /create or replace function public\.validate_connection_plan\(\)[\s\S]*?\$\$;/
  )?.[0] || ''

  assert.match(validationFunction, /Only the other participant can accept or decline a plan/)
  assert.match(validationFunction, /new\.status in \('accepted', 'declined'\)[\s\S]*actor_id = old\.proposer_id/)
  assert.match(validationFunction, /Only the proposer can cancel a proposed plan/)
  assert.match(validationFunction, /new\.status = 'cancelled'[\s\S]*actor_id <> old\.proposer_id/)
  assert.match(validationFunction, /Accepted plans can only be completed or cancelled/)
  assert.match(validationFunction, /old\.status = 'accepted'[\s\S]*new\.status not in \('cancelled', 'completed'\)/)
  assert.match(validationFunction, /Completed, declined, or cancelled plans cannot change status/)
  assert.match(validationFunction, /actor_id not in \(request_record\.requester_id, request_record\.recipient_id\)/)
  assert.match(connectionPlansMigration, /before update of status on public\.connection_requests/)
  assert.match(connectionPlansMigration, /set status = 'cancelled'[\s\S]*status in \('proposed', 'accepted'\)/)
  assert.match(connectionPlansMigration, /cocoapp\.internal_plan_disconnect/)
})

test('Coco Plan realtime setup is idempotent and does not expose private profiles', () => {
  assert.match(connectionPlansMigration, /pg_publication_tables/)
  assert.match(connectionPlansMigration, /alter publication supabase_realtime add table public\.connection_plans/)
  assert.doesNotMatch(connectionPlansMigration, /profile_private|phone|exact_address/i)
})

test('Coco Plan serializes plan writes with disconnects and rejects no-op updates', () => {
  const validationFunction = connectionPlanHardeningMigration.match(
    /create or replace function public\.validate_connection_plan\(\)[\s\S]*?\$\$;/
  )?.[0] || ''

  assert.match(
    validationFunction,
    /if tg_op = 'INSERT' then[\s\S]*from public\.connection_requests as request[\s\S]*where request\.id = new\.connection_request_id[\s\S]*for update/
  )
  assert.match(
    validationFunction,
    /new\.status is not distinct from old\.status[\s\S]*Connection plan status must change/
  )
  assert.match(connectionPlanHardeningMigration, /security definer/)
  assert.match(connectionPlanHardeningMigration, /set search_path = ''/)
  assert.match(
    connectionPlanHardeningMigration,
    /revoke all on function public\.validate_connection_plan\(\) from public/
  )
})
