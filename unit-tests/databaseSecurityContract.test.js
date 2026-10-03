import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const connectionSchema = await readFile(
  new URL('../supabase/migrations/20260917000001_create_connection_requests.sql', import.meta.url),
  'utf8'
)
const connectionPrivilegeHardeningMigration = await readFile(
  new URL('../supabase/migrations/20260917000016_harden_connection_request_privileges.sql', import.meta.url),
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
const proximityScopeMigration = await readFile(
  new URL('../supabase/migrations/20260917000017_add_private_proximity_scope.sql', import.meta.url),
  'utf8'
)
const connectionReadinessMigration = await readFile(
  new URL('../supabase/migrations/20260917000018_enforce_connection_readiness.sql', import.meta.url),
  'utf8'
)
const savedProfilesMigration = await readFile(
  new URL('../supabase/migrations/20260917000019_create_saved_profiles.sql', import.meta.url),
  'utf8'
)
const connectionPauseMigration = await readFile(
  new URL('../supabase/migrations/20260917000020_add_connection_pause.sql', import.meta.url),
  'utf8'
)
const connectionPlansMigration = await readFile(
  new URL('../supabase/migrations/20260917000012_create_connection_plans.sql', import.meta.url),
  'utf8'
)
const reportAndPlanHardeningMigration = await readFile(
  new URL('../supabase/migrations/20260917000015_harden_reports_and_plan_completion.sql', import.meta.url),
  'utf8'
)
const effectiveUserReportValidationFunction = reportAndPlanHardeningMigration.match(
  /create or replace function public\.validate_user_report\(\)[\s\S]*?\$\$;/
)?.[0] || ''
const effectiveConnectionPlanValidationFunction = reportAndPlanHardeningMigration.match(
  /create or replace function public\.validate_connection_plan\(\)[\s\S]*?\$\$;/
)?.[0] || ''
const discoverTrustFunction = trustMigration.match(
  /create function public\.get_discover_profiles\(\)[\s\S]*?\$\$;/
)?.[0] || ''
const discoverPreferencesFunction = matchingPreferencesMigration.match(
  /create function public\.get_discover_profiles\(\)[\s\S]*?\$\$;/
)?.[0] || ''
const effectiveDiscoverFunction = proximityScopeMigration.match(
  /create function public\.get_discover_profiles\(\)[\s\S]*?\$\$;/
)?.[0] || ''
const effectiveConnectionProfileFunction = proximityScopeMigration.match(
  /create or replace function public\.get_my_connection_requests\(\)[\s\S]*?\$\$;/
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

test('connection request writes expose only the client-owned business fields', () => {
  const privilegeStatements = connectionPrivilegeHardeningMigration
    .replace(/--.*$/gm, '')
    .split(';')
    .map((statement) => statement.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  assert.deepEqual(privilegeStatements, [
    'revoke insert, update on table public.connection_requests from authenticated',
    'revoke insert ( id, requester_id, recipient_id, purpose, status, created_at, updated_at, responded_at, intro_message ), update ( id, requester_id, recipient_id, purpose, status, created_at, updated_at, responded_at, intro_message ) on table public.connection_requests from authenticated',
    'grant select on table public.connection_requests to authenticated',
    'grant insert ( requester_id, recipient_id, purpose, intro_message ) on table public.connection_requests to authenticated',
    'grant update (status) on table public.connection_requests to authenticated',
  ])
})

test('connection readiness is shared by discovery and the insert-time database guard', () => {
  const readinessFunction = connectionReadinessMigration.match(
    /create or replace function public\.is_connection_ready_profile\(profile_id uuid\)[\s\S]*?\$\$;/
  )?.[0] || ''
  const discoverFunction = connectionReadinessMigration.match(
    /create or replace function public\.get_discover_profiles\(\)[\s\S]*?\$\$;/
  )?.[0] || ''
  const validationFunction = connectionReadinessMigration.match(
    /create or replace function public\.validate_connection_request\(\)[\s\S]*?\$\$;/
  )?.[0] || ''

  for (const field of [
    'full_name',
    'university',
    'major',
    'study_year',
    'gender',
    'purpose',
    'city',
    'area',
    'proximity_scope',
  ]) {
    assert.match(readinessFunction, new RegExp(`profile\\.${field}`))
  }

  assert.match(discoverFunction, /is_connection_ready_profile\(auth\.uid\(\)\)/)
  assert.match(discoverFunction, /is_connection_ready_profile\(profile\.id\)/)
  assert.match(
    validationFunction,
    /tg_op = 'INSERT'[\s\S]*is_connection_ready_profile\(new\.requester_id\)[\s\S]*is_connection_ready_profile\(new\.recipient_id\)[\s\S]*connection_profile_not_ready/
  )
  assert.match(
    connectionReadinessMigration,
    /revoke all on function public\.is_connection_ready_profile\(uuid\)[\s\S]*from public, anon, authenticated;/
  )
  assert.match(
    connectionReadinessMigration,
    /revoke all on function public\.validate_connection_request\(\)[\s\S]*from public, anon, authenticated;/
  )
  assert.doesNotMatch(connectionReadinessMigration, /profile_private|phone|exact_address/i)
})

test('pausing new connections is enforced for discovery, requests, and new saves', () => {
  const availabilityFunction = connectionPauseMigration.match(
    /create or replace function public\.can_start_new_connections\(profile_id uuid\)[\s\S]*?\$\$;/
  )?.[0] || ''
  const discoverFunction = connectionPauseMigration.match(
    /create or replace function public\.get_discover_profiles\(\)[\s\S]*?\$\$;/
  )?.[0] || ''
  const requestGuard = connectionPauseMigration.match(
    /create or replace function public\.guard_new_connection_availability\(\)[\s\S]*?\$\$;/
  )?.[0] || ''
  const savedProfileGuard = connectionPauseMigration.match(
    /create or replace function public\.validate_saved_profile\(\)[\s\S]*?\$\$;/
  )?.[0] || ''

  assert.match(connectionPauseMigration, /add column if not exists accepting_connections boolean not null default true/)
  assert.match(availabilityFunction, /profile\.accepting_connections/)
  assert.match(availabilityFunction, /is_connection_ready_profile\(profile\.id\)/)
  assert.match(discoverFunction, /can_start_new_connections\(auth\.uid\(\)\)/)
  assert.match(discoverFunction, /can_start_new_connections\(profile\.id\)/)
  assert.match(requestGuard, /can_start_new_connections\(new\.requester_id\)/)
  assert.match(requestGuard, /can_start_new_connections\(new\.recipient_id\)/)
  assert.match(requestGuard, /connection_requests_paused/)
  assert.match(
    connectionPauseMigration,
    /before insert on public\.connection_requests[\s\S]*guard_new_connection_availability\(\)/
  )
  assert.match(savedProfileGuard, /can_start_new_connections\(new\.owner_id\)/)
  assert.match(savedProfileGuard, /can_start_new_connections\(new\.saved_profile_id\)/)
  assert.doesNotMatch(discoverFunction, /profile_private|phone|exact_address/i)
  assert.match(
    connectionPauseMigration,
    /revoke all on function public\.can_start_new_connections\(uuid\)[\s\S]*from public, anon, authenticated;/
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

test('message reports bind the evidence sender to the reported user', () => {
  assert.match(effectiveUserReportValidationFunction, /security definer/)
  assert.match(effectiveUserReportValidationFunction, /set search_path = ''/)
  assert.match(
    effectiveUserReportValidationFunction,
    /new\.reporter_id <> auth\.uid\(\)[\s\S]*Only the reporter can submit a safety report/
  )
  assert.match(
    effectiveUserReportValidationFunction,
    /new\.status <> 'submitted'[\s\S]*New safety reports must be submitted/
  )
  assert.match(
    effectiveUserReportValidationFunction,
    /new\.details := nullif\(btrim\(new\.details\), ''\)/
  )
  assert.match(
    effectiveUserReportValidationFunction,
    /message\.connection_request_id,[\s\S]*message\.sender_id[\s\S]*into[\s\S]*report_connection_id,[\s\S]*report_message_sender_id[\s\S]*where message\.id = new\.message_id/
  )
  assert.match(
    effectiveUserReportValidationFunction,
    /report_connection_id is null[\s\S]*Reported message was not found/
  )
  assert.match(
    effectiveUserReportValidationFunction,
    /new\.connection_request_id := report_connection_id[\s\S]*new\.connection_request_id <> report_connection_id[\s\S]*Reported message does not belong to this connection/
  )
  assert.match(
    effectiveUserReportValidationFunction,
    /auth\.uid\(\) not in \(request_record\.requester_id, request_record\.recipient_id\)[\s\S]*Reporter is not a participant in this connection/
  )
  assert.match(
    effectiveUserReportValidationFunction,
    /new\.reported_user_id not in \([\s\S]*request_record\.requester_id,[\s\S]*request_record\.recipient_id[\s\S]*new\.reported_user_id = auth\.uid\(\)[\s\S]*Reported user does not match this connection/
  )
  assert.match(
    effectiveUserReportValidationFunction,
    /from public\.profiles as profile[\s\S]*profile\.id = new\.reported_user_id[\s\S]*Reported user was not found/
  )
  assert.match(
    effectiveUserReportValidationFunction,
    /report_message_sender_id is distinct from new\.reported_user_id/
  )
  assert.match(
    effectiveUserReportValidationFunction,
    /Reported message was not sent by the reported user/
  )
  assert.ok(
    effectiveUserReportValidationFunction.indexOf('Reporter is not a participant in this connection')
      < effectiveUserReportValidationFunction.indexOf('report_message_sender_id is distinct from new.reported_user_id'),
    'participant authorization must happen before sender identity validation'
  )
  assert.match(
    reportAndPlanHardeningMigration,
    /revoke all on function public\.validate_user_report\(\)\s+from public, anon, authenticated;/
  )
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

test('proximity matching stays broad and does not expose precise location data', () => {
  assert.match(proximityScopeMigration, /add column if not exists proximity_scope text not null default 'same_city'/)
  assert.match(
    proximityScopeMigration,
    /check \(proximity_scope in \('same_area', 'same_city', 'anywhere'\)\)/
  )
  assert.match(effectiveDiscoverFunction, /security definer/)
  assert.match(effectiveDiscoverFunction, /set search_path = ''/)
  assert.match(effectiveDiscoverFunction, /auth\.uid\(\) is not null/)
  assert.match(effectiveDiscoverFunction, /profile\.id <> auth\.uid\(\)/)
  assert.match(effectiveDiscoverFunction, /block\.blocker_id = auth\.uid\(\) and block\.blocked_id = profile\.id/)
  assert.match(effectiveDiscoverFunction, /block\.blocker_id = profile\.id and block\.blocked_id = auth\.uid\(\)/)
  assert.doesNotMatch(
    effectiveDiscoverFunction,
    /public_location|profile_private|exact_address|latitude|longitude|coordinates?/i
  )
  assert.match(
    proximityScopeMigration,
    /revoke all on function public\.get_discover_profiles\(\)[\s\S]*from public, anon, authenticated;/
  )
  assert.match(
    proximityScopeMigration,
    /grant execute on function public\.get_discover_profiles\(\) to authenticated;/
  )
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
  assert.match(effectiveConnectionProfileFunction, /security definer/)
  assert.match(effectiveConnectionProfileFunction, /set search_path = ''/)
  assert.match(effectiveConnectionProfileFunction, /auth\.uid\(\) in \(request\.requester_id, request\.recipient_id\)/)
  assert.match(effectiveConnectionProfileFunction, /request\.status in \('pending', 'accepted'\)/)
  assert.match(effectiveConnectionProfileFunction, /block\.blocker_id = other_profile\.id and block\.blocked_id = auth\.uid\(\)/)
  assert.doesNotMatch(effectiveConnectionProfileFunction, /profile_private|university|study_year|exact_address|phone/i)
  assert.match(
    effectiveConnectionProfileFunction,
    /when request\.status = 'accepted' then other_profile\.public_location[\s\S]*else null/
  )
  assert.match(
    proximityScopeMigration,
    /revoke all on function public\.get_my_connection_requests\(\)[\s\S]*from public, anon, authenticated;/
  )
  assert.match(
    proximityScopeMigration,
    /grant execute on function public\.get_my_connection_requests\(\) to authenticated;/
  )
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
  assert.match(connectionPlansMigration, /grant update \(status\) on table public\.connection_plans/)
  assert.match(effectiveConnectionPlanValidationFunction, /new\.connection_request_id is distinct from old\.connection_request_id/)
  assert.match(effectiveConnectionPlanValidationFunction, /new\.proposer_id is distinct from old\.proposer_id/)
  assert.match(effectiveConnectionPlanValidationFunction, /new\.title is distinct from old\.title/)
  assert.match(effectiveConnectionPlanValidationFunction, /new\.starts_at is distinct from old\.starts_at/)
  assert.match(effectiveConnectionPlanValidationFunction, /new\.mode is distinct from old\.mode/)
  assert.match(effectiveConnectionPlanValidationFunction, /new\.location_note is distinct from old\.location_note/)
  assert.doesNotMatch(connectionPlansMigration, /grant[^;]*(?:delete|\ball\b)[^;]*on table public\.connection_plans/i)
  assert.doesNotMatch(connectionPlansMigration, /for delete/i)
})

test('Coco Plan transitions enforce ownership and terminal states', () => {
  assert.match(effectiveConnectionPlanValidationFunction, /Only the other participant can accept or decline a plan/)
  assert.match(effectiveConnectionPlanValidationFunction, /new\.status in \('accepted', 'declined'\)[\s\S]*actor_id = old\.proposer_id/)
  assert.match(effectiveConnectionPlanValidationFunction, /Only the proposer can cancel a proposed plan/)
  assert.match(effectiveConnectionPlanValidationFunction, /new\.status = 'cancelled'[\s\S]*actor_id <> old\.proposer_id/)
  assert.match(effectiveConnectionPlanValidationFunction, /Accepted plans can only be completed or cancelled/)
  assert.match(effectiveConnectionPlanValidationFunction, /old\.status = 'accepted'[\s\S]*new\.status not in \('cancelled', 'completed'\)/)
  assert.match(effectiveConnectionPlanValidationFunction, /Completed, declined, or cancelled plans cannot change status/)
  assert.match(effectiveConnectionPlanValidationFunction, /actor_id not in \(request_record\.requester_id, request_record\.recipient_id\)/)
  assert.match(connectionPlansMigration, /before update of status on public\.connection_requests/)
  assert.match(connectionPlansMigration, /set status = 'cancelled'[\s\S]*status in \('proposed', 'accepted'\)/)
  assert.match(connectionPlansMigration, /cocoapp\.internal_plan_disconnect/)
})

test('accepted Coco Plans cannot be completed before their scheduled time', () => {
  assert.match(
    effectiveConnectionPlanValidationFunction,
    /old\.status = 'accepted'[\s\S]*new\.status = 'completed' and old\.starts_at > now\(\)[\s\S]*cannot be completed before its scheduled time/
  )
})

test('Coco Plan realtime setup is idempotent and does not expose private profiles', () => {
  assert.match(connectionPlansMigration, /pg_publication_tables/)
  assert.match(connectionPlansMigration, /alter publication supabase_realtime add table public\.connection_plans/)
  assert.doesNotMatch(connectionPlansMigration, /profile_private|phone|exact_address/i)
})

test('Coco Plan serializes plan writes with disconnects and rejects no-op updates', () => {
  const parentLookupBlock = effectiveConnectionPlanValidationFunction.match(
    /if tg_op = 'INSERT' then[\s\S]*?end if;\s+if request_record\.id is null/
  )?.[0] || ''
  const updateParentLookup = parentLookupBlock.match(
    /else[\s\S]*?end if;/
  )?.[0] || ''

  assert.match(
    effectiveConnectionPlanValidationFunction,
    /if tg_op = 'INSERT' then[\s\S]*from public\.connection_requests as request[\s\S]*where request\.id = new\.connection_request_id[\s\S]*for update/
  )
  assert.doesNotMatch(updateParentLookup, /for update/)
  assert.match(
    effectiveConnectionPlanValidationFunction,
    /current_setting\('cocoapp\.internal_plan_disconnect', true\)[\s\S]*pg_trigger_depth\(\) > 1[\s\S]*old\.status in \('proposed', 'accepted'\)[\s\S]*new\.status = 'cancelled'/
  )
  assert.match(
    effectiveConnectionPlanValidationFunction,
    /actor_id is null and not is_disconnect_cancellation/
  )
  assert.match(
    effectiveConnectionPlanValidationFunction,
    /new\.status is not distinct from old\.status[\s\S]*Connection plan status must change/
  )
  assert.match(effectiveConnectionPlanValidationFunction, /security definer/)
  assert.match(effectiveConnectionPlanValidationFunction, /set search_path = ''/)
  assert.match(
    reportAndPlanHardeningMigration,
    /revoke all on function public\.validate_connection_plan\(\)\s+from public, anon, authenticated;/
  )
})

test('saved profiles are private owner-only rows with no update surface', () => {
  assert.match(savedProfilesMigration, /create table if not exists public\.saved_profiles/)
  assert.match(savedProfilesMigration, /primary key \(owner_id, saved_profile_id\)/)
  assert.match(savedProfilesMigration, /constraint saved_profiles_not_self check \(owner_id <> saved_profile_id\)/)
  assert.match(savedProfilesMigration, /alter table public\.saved_profiles enable row level security/)
  assert.match(savedProfilesMigration, /revoke all on table public\.saved_profiles from anon, authenticated/)
  assert.match(savedProfilesMigration, /grant select on table public\.saved_profiles to authenticated/)
  assert.match(savedProfilesMigration, /grant insert \(owner_id, saved_profile_id\)/)
  assert.match(savedProfilesMigration, /grant delete on table public\.saved_profiles to authenticated/)
  assert.doesNotMatch(savedProfilesMigration, /grant[^;]*update[^;]*public\.saved_profiles/i)
})

test('saved-profile RLS scopes select, insert, and delete to the authenticated owner', () => {
  assert.match(
    savedProfilesMigration,
    /for select[\s\S]*using \(owner_id = \(select auth\.uid\(\)\)\)/
  )
  assert.match(
    savedProfilesMigration,
    /for insert[\s\S]*with check \([\s\S]*owner_id = \(select auth\.uid\(\)\)[\s\S]*saved_profile_id <> \(select auth\.uid\(\)\)/
  )
  assert.match(
    savedProfilesMigration,
    /for delete[\s\S]*using \(owner_id = \(select auth\.uid\(\)\)\)/
  )
})

test('saved-profile validation requires ready, unblocked profiles and creates no notification', () => {
  const validationFunction = savedProfilesMigration.match(
    /create or replace function public\.validate_saved_profile\(\)[\s\S]*?\$\$;/
  )?.[0] || ''

  assert.match(validationFunction, /security definer/)
  assert.match(validationFunction, /set search_path = ''/)
  assert.match(validationFunction, /new\.owner_id <> auth\.uid\(\)/)
  assert.match(validationFunction, /is_connection_ready_profile\(new\.owner_id\)/)
  assert.match(validationFunction, /is_connection_ready_profile\(new\.saved_profile_id\)/)
  assert.match(validationFunction, /block\.blocker_id = new\.owner_id and block\.blocked_id = new\.saved_profile_id/)
  assert.match(validationFunction, /block\.blocker_id = new\.saved_profile_id and block\.blocked_id = new\.owner_id/)
  assert.match(savedProfilesMigration, /revoke all on function public\.validate_saved_profile\(\)/)
  assert.doesNotMatch(savedProfilesMigration, /insert into public\.notifications/i)
})

test('blocking removes saved-profile links in either direction', () => {
  const cleanupFunction = savedProfilesMigration.match(
    /create or replace function public\.remove_saved_profiles_on_block\(\)[\s\S]*?\$\$;/
  )?.[0] || ''

  assert.match(cleanupFunction, /security definer/)
  assert.match(cleanupFunction, /delete from public\.saved_profiles/)
  assert.match(cleanupFunction, /saved\.owner_id = new\.blocker_id and saved\.saved_profile_id = new\.blocked_id/)
  assert.match(cleanupFunction, /saved\.owner_id = new\.blocked_id and saved\.saved_profile_id = new\.blocker_id/)
  assert.match(savedProfilesMigration, /after insert on public\.user_blocks/)
  assert.match(savedProfilesMigration, /revoke all on function public\.remove_saved_profiles_on_block\(\)/)
})
