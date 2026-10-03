import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyReadReceipts,
  formatMessageTimestamp,
  getLatestOwnMessageId,
  getMessageDeliveryLabel,
  getUnreadMessageCount,
  mapMessage,
  mergeMessages,
  normalizeMessagePage,
} from '../src/lib/messageState.js'

const userId = 'user-a'

function row(overrides = {}) {
  return {
    id: 'message-1',
    sender_id: 'user-b',
    body: 'Xin chào',
    created_at: '2026-09-18T01:00:00.000Z',
    read_at: null,
    ...overrides,
  }
}

test('maps sender ownership without exposing database field names to the UI', () => {
  assert.deepEqual(mapMessage(row(), userId), {
    id: 'message-1',
    sender: 'other',
    text: 'Xin chào',
    createdAt: '2026-09-18T01:00:00.000Z',
    readAt: null,
  })

  assert.equal(mapMessage(row({ sender_id: userId }), userId).sender, 'me')
})

test('counts only unread messages received from the other participant', () => {
  const connection = {
    messages: [
      mapMessage(row(), userId),
      mapMessage(row({ id: 'message-2', sender_id: userId }), userId),
      mapMessage(row({ id: 'message-3', read_at: '2026-09-18T02:00:00.000Z' }), userId),
    ],
  }

  assert.equal(getUnreadMessageCount(connection), 1)
  assert.equal(getUnreadMessageCount({ ...connection, unreadCount: 72 }), 72)
})

test('formats valid message times and keeps older dates understandable', () => {
  const sameDay = formatMessageTimestamp(
    '2026-09-18T01:05:00.000Z',
    '2026-09-18T08:00:00.000Z'
  )
  const olderDay = formatMessageTimestamp(
    '2026-09-17T01:05:00.000Z',
    '2026-09-18T08:00:00.000Z'
  )
  const olderYear = formatMessageTimestamp(
    '2025-09-17T01:05:00.000Z',
    '2026-09-18T08:00:00.000Z'
  )

  assert.match(sameDay, /\d{2}:\d{2}/)
  assert.match(olderDay, /\d{2}[/-]\d{2}.*\d{2}:\d{2}/)
  assert.match(olderYear, /2025.*\d{2}:\d{2}/)
  assert.equal(formatMessageTimestamp('not-a-date'), '')
})

test('shows a delivery receipt only for the latest outgoing message', () => {
  const messages = [
    mapMessage(row({ id: 'message-1', sender_id: userId }), userId),
    mapMessage(row({ id: 'message-2' }), userId),
    mapMessage(row({
      id: 'message-3',
      sender_id: userId,
      read_at: '2026-09-18T02:00:00.000Z',
    }), userId),
  ]
  const latestOwnMessageId = getLatestOwnMessageId(messages)

  assert.equal(latestOwnMessageId, 'message-3')
  assert.equal(getMessageDeliveryLabel(messages[0], latestOwnMessageId), '')
  assert.equal(getMessageDeliveryLabel(messages[1], latestOwnMessageId), '')
  assert.equal(getMessageDeliveryLabel(messages[2], latestOwnMessageId), 'Đã đọc')
  assert.equal(
    getMessageDeliveryLabel({ ...messages[2], readAt: null }, latestOwnMessageId),
    'Đã gửi'
  )
  assert.equal(getLatestOwnMessageId([]), null)
})

test('merges realtime and fetched messages once while preserving read receipts', () => {
  const fetched = [mapMessage(row({ read_at: '2026-09-18T02:00:00.000Z' }), userId)]
  const realtime = [
    mapMessage(row(), userId),
    mapMessage(row({ id: 'message-2', created_at: '2026-09-18T03:00:00.000Z' }), userId),
  ]

  const merged = mergeMessages(fetched, realtime)

  assert.deepEqual(merged.map((message) => message.id), ['message-1', 'message-2'])
  assert.equal(merged[0].readAt, '2026-09-18T02:00:00.000Z')
})

test('normalizes a descending database page into chronological UI order', () => {
  const rows = [
    row({ id: 'message-3', created_at: '2026-09-18T03:00:00.000Z' }),
    row({ id: 'message-2', created_at: '2026-09-18T02:00:00.000Z' }),
    row({ id: 'message-1', created_at: '2026-09-18T01:00:00.000Z' }),
  ]

  const page = normalizeMessagePage(rows, userId, 2)

  assert.deepEqual(page.messages.map((message) => message.id), ['message-2', 'message-3'])
  assert.equal(page.hasOlder, true)
})

test('applies receipts only to matching messages', () => {
  const connections = [{
    id: 'connection-1',
    unreadCount: 2,
    messages: [mapMessage(row(), userId), mapMessage(row({ id: 'message-2' }), userId)],
  }]

  const updated = applyReadReceipts(connections, [{
    id: 'message-2',
    connection_request_id: 'connection-1',
    read_at: '2026-09-18T04:00:00.000Z',
  }])

  assert.equal(updated[0].unreadCount, 1)
  assert.equal(updated[0].messages[0].readAt, null)
  assert.equal(updated[0].messages[1].readAt, '2026-09-18T04:00:00.000Z')
})
