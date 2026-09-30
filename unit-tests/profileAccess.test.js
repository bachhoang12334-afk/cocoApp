import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  normalizeConnectionRequest,
  normalizeConnectionRequests,
  normalizeNotification,
  normalizeNotifications,
} from '../src/lib/profileAccess.js'

const appLayoutSource = await readFile(
  new URL('../src/components/AppLayout.jsx', import.meta.url),
  'utf8'
)
const dashboardSource = await readFile(
  new URL('../src/pages/Dashboard.jsx', import.meta.url),
  'utf8'
)
const matchesSource = await readFile(
  new URL('../src/pages/Matches.jsx', import.meta.url),
  'utf8'
)

const peerFields = {
  other_profile_id: 'peer-id',
  other_full_name: 'Nguyễn An',
  other_major: 'Công nghệ thông tin',
  other_purpose: 'Học nhóm',
  other_city: 'Hà Nội',
  other_area: 'Cầu Giấy',
  other_public_location: 'Thư viện',
  other_bio: 'Ôn thuật toán cùng nhau.',
  other_email_confirmed: true,
  other_education_email: false,
  other_verification_status: 'unverified',
}

test('normalizes a scoped connection row without inventing the viewer profile', () => {
  const incoming = normalizeConnectionRequest({
    id: 'request-id',
    requester_id: 'peer-id',
    recipient_id: 'viewer-id',
    purpose: 'study_group',
    intro_message: 'Mình cùng ôn DSA nhé.',
    status: 'pending',
    created_at: '2026-09-30T00:00:00Z',
    responded_at: null,
    ...peerFields,
  })

  assert.equal(incoming.requester.full_name, 'Nguyễn An')
  assert.equal(incoming.requester.id, 'peer-id')
  assert.equal(incoming.recipient, null)
  assert.equal(incoming.intro_message, 'Mình cùng ôn DSA nhé.')

  const outgoing = normalizeConnectionRequest({
    ...incoming,
    requester_id: 'viewer-id',
    recipient_id: 'peer-id',
    ...peerFields,
  })

  assert.equal(outgoing.requester, null)
  assert.equal(outgoing.recipient.full_name, 'Nguyễn An')
  assert.deepEqual(normalizeConnectionRequests(null), [])
})

test('normalizes notification actor names and preserves blocked-user fallback', () => {
  const notification = normalizeNotification({
    id: 'notification-id',
    recipient_id: 'viewer-id',
    actor_id: 'peer-id',
    connection_request_id: 'request-id',
    type: 'request_received',
    read_at: null,
    created_at: '2026-09-30T00:00:00Z',
    actor_full_name: 'Nguyễn An',
  })

  assert.deepEqual(notification.actor, { full_name: 'Nguyễn An' })
  assert.equal(normalizeNotification({ ...notification, actor_full_name: null }).actor, null)
  assert.deepEqual(normalizeNotifications(null), [])
})

test('cross-user profile reads use scoped RPCs instead of embedded profile joins', () => {
  assert.match(appLayoutSource, /rpc\('get_my_notifications'\)/)
  assert.match(dashboardSource, /rpc\('get_my_connection_requests'\)/)
  assert.match(matchesSource, /rpc\('get_my_connection_requests'\)/)
  assert.doesNotMatch(appLayoutSource, /actor:profiles!/)
  assert.doesNotMatch(dashboardSource, /profiles!connection_requests/)
  assert.doesNotMatch(matchesSource, /profiles!connection_requests/)
})
