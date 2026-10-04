import assert from 'node:assert/strict'
import test from 'node:test'

import {
  filterNotifications,
  formatNotificationTime,
  NOTIFICATION_FILTER_ALL,
  NOTIFICATION_FILTER_UNREAD,
} from '../src/lib/notificationPresentation.js'

test('filters unread notifications without mutating their source order', () => {
  const notifications = [
    { id: 'read', read_at: '2026-10-04T08:00:00.000Z' },
    { id: 'unread-1', read_at: null },
    { id: 'unread-2', read_at: null },
  ]

  assert.deepEqual(
    filterNotifications(notifications, NOTIFICATION_FILTER_UNREAD).map((item) => item.id),
    ['unread-1', 'unread-2']
  )
  assert.deepEqual(notifications.map((item) => item.id), ['read', 'unread-1', 'unread-2'])
})

test('keeps all notifications for the all and unknown filters', () => {
  const notifications = [
    { id: 'first', read_at: null },
    { id: 'second', read_at: '2026-10-04T08:00:00.000Z' },
  ]

  assert.deepEqual(filterNotifications(notifications, NOTIFICATION_FILTER_ALL), notifications)
  assert.deepEqual(filterNotifications(notifications, 'unsupported'), notifications)
  assert.notEqual(filterNotifications(notifications, NOTIFICATION_FILTER_ALL), notifications)
  assert.deepEqual(filterNotifications(null, NOTIFICATION_FILTER_ALL), [])
})

test('formats recent notification times compactly and keeps older dates explicit', () => {
  const now = Date.parse('2026-10-04T12:00:00.000Z')

  assert.equal(formatNotificationTime('2026-10-04T11:59:30.000Z', now), 'Vừa xong')
  assert.equal(formatNotificationTime('2026-10-04T11:42:00.000Z', now), '18 phút trước')
  assert.equal(formatNotificationTime('2026-10-04T07:00:00.000Z', now), '5 giờ trước')
  assert.equal(formatNotificationTime('2026-10-02T12:00:00.000Z', now), '2 ngày trước')
  const olderLabel = formatNotificationTime('2026-09-20T12:00:00.000Z', now)
  assert.match(olderLabel, /20/)
  assert.doesNotMatch(olderLabel, /trước|Vừa xong/)
  assert.equal(formatNotificationTime('not-a-date', now), '')
})
