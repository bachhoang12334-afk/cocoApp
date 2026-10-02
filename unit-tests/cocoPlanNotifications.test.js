import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  getNotificationTarget,
  isCocoPlanNotification,
  parseCocoPlanDeepLink,
} from '../src/lib/notificationNavigation.js'
import { normalizeNotification } from '../src/lib/profileAccess.js'

const migration = await readFile(
  new URL('../supabase/migrations/20260917000014_add_coco_plan_notifications.sql', import.meta.url),
  'utf8'
)

const createPlanNotificationFunction = migration.match(
  /create or replace function public\.create_connection_plan_notification\(\)[\s\S]*?\$\$;/
)?.[0] || ''
const createConnectionNotificationFunction = migration.match(
  /create or replace function public\.create_connection_notification\(\)[\s\S]*?\$\$;/
)?.[0] || ''
const protectNotificationFunction = migration.match(
  /create or replace function public\.protect_notification_update\(\)[\s\S]*?\$\$;/
)?.[0] || ''
const notificationRpc = migration.match(
  /create function public\.get_my_notifications\(\)[\s\S]*?\$\$;/
)?.[0] || ''

const CONNECTION_ID = '11111111-1111-4111-8111-111111111111'
const PLAN_ID = '22222222-2222-4222-8222-222222222222'
const PLAN_NOTIFICATION_TYPES = [
  'plan_proposed',
  'plan_accepted',
  'plan_declined',
  'plan_cancelled',
  'plan_completed',
]

test('Coco Plan notification schema binds every plan event to its connection', () => {
  assert.match(migration, /add column if not exists connection_plan_id uuid/)
  assert.match(
    migration,
    /unique \(id, connection_request_id\)/
  )
  assert.match(
    migration,
    /foreign key \(connection_plan_id, connection_request_id\)[\s\S]*references public\.connection_plans \(id, connection_request_id\)/
  )

  for (const type of PLAN_NOTIFICATION_TYPES) {
    assert.match(migration, new RegExp(`'${type}'`))
  }

  assert.match(
    migration,
    /type in \([\s\S]*'connection_disconnected'[\s\S]*\)[\s\S]*and connection_plan_id is null/
  )
  assert.match(
    migration,
    /type in \([\s\S]*'plan_completed'[\s\S]*\)[\s\S]*and connection_plan_id is not null/
  )
})

test('connection and plan notifications dedupe independently without suppressing later plans', () => {
  assert.match(
    migration,
    /notifications_connection_event_idx[\s\S]*\(connection_request_id, recipient_id, type\)[\s\S]*where connection_plan_id is null/
  )
  assert.match(
    migration,
    /notifications_plan_event_idx[\s\S]*\(connection_plan_id, recipient_id, type\)[\s\S]*where connection_plan_id is not null/
  )
  assert.match(
    createPlanNotificationFunction,
    /on conflict \(connection_plan_id, recipient_id, type\)[\s\S]*where connection_plan_id is not null[\s\S]*do nothing/
  )
  assert.match(createConnectionNotificationFunction, /on conflict do nothing/)
  assert.doesNotMatch(
    createConnectionNotificationFunction,
    /on conflict \(connection_request_id, recipient_id, type\)/
  )
})

test('Coco Plan trigger emits only participant lifecycle events and skips internal disconnect cleanup', () => {
  assert.match(createPlanNotificationFunction, /notification_actor_id uuid := auth\.uid\(\)/)
  assert.match(
    createPlanNotificationFunction,
    /cocoapp\.internal_plan_disconnect[\s\S]*= 'on'[\s\S]*return new/
  )
  assert.match(createPlanNotificationFunction, /pg_trigger_depth\(\) > 1/)
  assert.match(createPlanNotificationFunction, /new\.status <> 'proposed'[\s\S]*new\.proposer_id <> notification_actor_id/)
  assert.match(createPlanNotificationFunction, /old\.status = 'proposed' and new\.status = 'accepted'[\s\S]*'plan_accepted'/)
  assert.match(createPlanNotificationFunction, /old\.status = 'proposed' and new\.status = 'declined'[\s\S]*'plan_declined'/)
  assert.match(createPlanNotificationFunction, /new\.status = 'cancelled'[\s\S]*'plan_cancelled'/)
  assert.match(createPlanNotificationFunction, /old\.status = 'accepted' and new\.status = 'completed'[\s\S]*'plan_completed'/)
  assert.match(
    createPlanNotificationFunction,
    /request\.requester_id = notification_actor_id[\s\S]*request\.recipient_id[\s\S]*request\.recipient_id = notification_actor_id[\s\S]*request\.requester_id/
  )
  assert.match(
    createPlanNotificationFunction,
    /notification_recipient_id is null[\s\S]*notification_recipient_id = notification_actor_id[\s\S]*return new/
  )
  assert.match(
    migration,
    /create trigger connection_plans_create_notification[\s\S]*after insert or update of status on public\.connection_plans/
  )
})

test('plan notification identity is immutable and clients retain read-only event access', () => {
  assert.match(
    protectNotificationFunction,
    /new\.connection_plan_id is distinct from old\.connection_plan_id/
  )
  assert.match(migration, /revoke all on table public\.notifications from anon, authenticated/)
  assert.match(migration, /alter table public\.notifications enable row level security/)
  assert.match(migration, /grant select on table public\.notifications to authenticated/)
  assert.match(migration, /grant update \(read_at\) on table public\.notifications to authenticated/)
  assert.doesNotMatch(migration, /grant insert[^;]*on table public\.notifications/i)
  assert.doesNotMatch(migration, /grant delete[^;]*on table public\.notifications/i)
  assert.match(migration, /pg_publication_tables/)
  assert.match(migration, /alter publication supabase_realtime add table public\.notifications/)
})

test('notification RPC exposes plan context only to its recipient without private profile data', () => {
  assert.match(notificationRpc, /connection_plan_id uuid/)
  assert.match(notificationRpc, /notification\.connection_plan_id/)
  assert.match(notificationRpc, /notification\.recipient_id = auth\.uid\(\)/)
  assert.match(notificationRpc, /block\.blocker_id = auth\.uid\(\) and block\.blocked_id = actor\.id/)
  assert.match(notificationRpc, /block\.blocker_id = actor\.id and block\.blocked_id = auth\.uid\(\)/)
  assert.doesNotMatch(notificationRpc, /profile_private|phone|exact_address|university|study_year/i)
  assert.match(migration, /grant execute on function public\.get_my_notifications\(\) to authenticated/)
  assert.doesNotMatch(
    migration,
    /insert into public\.notifications\s*\([^)]*\)\s*select/i
  )
})

test('Coco Plan notification targets preserve exact conversation and plan context', () => {
  for (const type of PLAN_NOTIFICATION_TYPES) {
    const notification = {
      type,
      connection_request_id: CONNECTION_ID,
      connection_plan_id: PLAN_ID,
    }

    assert.equal(isCocoPlanNotification(notification), true)
    assert.equal(
      getNotificationTarget(notification),
      `/matches?connection=${CONNECTION_ID}&plan=${PLAN_ID}&focus=plan`
    )
  }

  assert.equal(getNotificationTarget({ type: 'request_received' }), '/matches')
  assert.equal(getNotificationTarget({
    type: 'plan_proposed',
    connection_request_id: 'not-a-uuid',
    connection_plan_id: PLAN_ID,
  }), '/matches')
})

test('Coco Plan deep-link parser accepts strict plan links and safely rejects incomplete input', () => {
  assert.deepEqual(
    parseCocoPlanDeepLink(`?connection=${CONNECTION_ID}&plan=${PLAN_ID}&focus=plan&ignored=1`),
    { connectionId: CONNECTION_ID, planId: PLAN_ID }
  )
  assert.equal(parseCocoPlanDeepLink(`?connection=${CONNECTION_ID}&plan=${PLAN_ID}`), null)
  assert.equal(parseCocoPlanDeepLink(`?connection=${CONNECTION_ID}&plan=bad&focus=plan`), null)
  assert.equal(parseCocoPlanDeepLink('?focus=messages'), null)
})

test('notification normalization retains the plan id required by deep-link navigation', () => {
  const notification = normalizeNotification({
    id: 'notification-id',
    recipient_id: 'recipient-id',
    actor_id: 'actor-id',
    connection_request_id: CONNECTION_ID,
    connection_plan_id: PLAN_ID,
    type: 'plan_proposed',
    read_at: null,
    created_at: '2026-10-02T00:00:00.000Z',
    actor_full_name: 'Nguyễn An',
  })

  assert.equal(notification.connection_plan_id, PLAN_ID)
  assert.deepEqual(notification.actor, { full_name: 'Nguyễn An' })
})
