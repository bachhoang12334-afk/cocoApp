import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getNotificationTarget,
  isConnectionNotification,
  parseConnectionNotificationDeepLink,
  parseCocoPlanDeepLink,
} from '../src/lib/notificationNavigation.js'

const CONNECTION_ID = '11111111-1111-4111-8111-111111111111'
const PLAN_ID = '22222222-2222-4222-8222-222222222222'

test('connection notifications target the exact pending request or accepted conversation', () => {
  assert.equal(
    getNotificationTarget({
      type: 'request_received',
      connection_request_id: CONNECTION_ID,
    }),
    `/matches?connection=${CONNECTION_ID}&focus=pending`
  )
  assert.equal(
    getNotificationTarget({
      type: 'request_accepted',
      connection_request_id: CONNECTION_ID,
    }),
    `/matches?connection=${CONNECTION_ID}&focus=conversation`
  )

  assert.deepEqual(
    parseConnectionNotificationDeepLink(`?connection=${CONNECTION_ID}&focus=pending`),
    { kind: 'pending-request', tab: 'pending', connectionId: CONNECTION_ID }
  )
  assert.deepEqual(
    parseConnectionNotificationDeepLink(`?ignored=1&connection=${CONNECTION_ID}&focus=conversation`),
    { kind: 'accepted-conversation', tab: 'accepted', connectionId: CONNECTION_ID }
  )
})

test('terminal connection notifications select a safe overview without carrying a stale row id', () => {
  const cases = [
    ['request_declined', 'pending'],
    ['request_cancelled', 'pending'],
    ['connection_disconnected', 'accepted'],
  ]

  for (const [type, tab] of cases) {
    assert.equal(isConnectionNotification({ type }), true)
    assert.equal(
      getNotificationTarget({ type, connection_request_id: CONNECTION_ID }),
      `/matches?focus=${tab}&event=${type}`
    )
    assert.deepEqual(
      parseConnectionNotificationDeepLink(`?focus=${tab}&event=${type}`),
      { kind: 'terminal-event', tab, notificationType: type }
    )
  }

  assert.equal(isConnectionNotification({ type: 'plan_proposed' }), false)
  assert.equal(isConnectionNotification({ type: 'unknown' }), false)
})

test('malformed notification rows and unsupported types fall back to Matches', () => {
  const malformedIds = [
    undefined,
    '',
    'not-a-uuid',
    '11111111-1111-1111-1111-111111111111',
    `${CONNECTION_ID}?focus=conversation`,
    `<script>${CONNECTION_ID}</script>`,
  ]

  for (const connection_request_id of malformedIds) {
    assert.equal(
      getNotificationTarget({ type: 'request_received', connection_request_id }),
      '/matches'
    )
    assert.equal(
      getNotificationTarget({ type: 'connection_disconnected', connection_request_id }),
      '/matches'
    )
  }

  assert.equal(getNotificationTarget(null), '/matches')
  assert.equal(getNotificationTarget({ type: 'unknown', connection_request_id: CONNECTION_ID }), '/matches')
})

test('connection deep-link parser rejects missing, invalid, duplicated, and mixed reserved values', () => {
  const invalidSearches = [
    '',
    '?focus=pending',
    `?connection=${CONNECTION_ID}`,
    '?connection=not-a-uuid&focus=pending',
    `?connection=${CONNECTION_ID}&focus=accepted`,
    `?connection=${CONNECTION_ID}&focus=pending&event=request_declined`,
    `?connection=${CONNECTION_ID}&connection=${PLAN_ID}&focus=pending`,
    `?connection=${CONNECTION_ID}&focus=pending&focus=conversation`,
    '?focus=pending&event=connection_disconnected',
    '?focus=accepted&event=request_declined',
    '?focus=accepted&event=unknown',
    '?focus=accepted&event=connection_disconnected&event=request_cancelled',
    `?focus=accepted&event=connection_disconnected&connection=${CONNECTION_ID}`,
    `?connection=%3Cscript%3E${CONNECTION_ID}%3C%2Fscript%3E&focus=conversation`,
  ]

  for (const search of invalidSearches) {
    assert.equal(parseConnectionNotificationDeepLink(search), null, search)
  }
})

test('Coco Plan target and parser behavior remain unchanged', () => {
  const notification = {
    type: 'plan_proposed',
    connection_request_id: CONNECTION_ID,
    connection_plan_id: PLAN_ID,
  }

  assert.equal(
    getNotificationTarget(notification),
    `/matches?connection=${CONNECTION_ID}&plan=${PLAN_ID}&focus=plan`
  )
  assert.deepEqual(
    parseCocoPlanDeepLink(`?connection=${CONNECTION_ID}&plan=${PLAN_ID}&focus=plan`),
    { connectionId: CONNECTION_ID, planId: PLAN_ID }
  )
  assert.equal(
    parseConnectionNotificationDeepLink(`?connection=${CONNECTION_ID}&plan=${PLAN_ID}&focus=plan`),
    null
  )
})
