import assert from 'node:assert/strict'
import test from 'node:test'

import {
  filterConversations,
  formatConversationActivityTime,
  getConversationActivityDate,
  normalizeConversationSearch,
  sortConversationsByActivity,
} from '../src/lib/conversationFilters.js'

const conversations = [
  {
    id: 'connection-1',
    name: 'Nguyễn Hà My',
    major: 'Công nghệ thông tin',
    purpose: 'Học nhóm',
    city: 'Đà Nẵng',
    unreadCount: 2,
  },
  {
    id: 'connection-2',
    name: 'Trần Minh Anh',
    major: 'Thiết kế đồ họa',
    purpose: 'Team Project',
    city: 'Hồ Chí Minh',
    unreadCount: 0,
  },
  {
    id: 'connection-3',
    name: 'Lê Đức Nam',
    major: 'Kinh tế',
    purpose: 'Ghép trọ',
    area: 'Thủ Đức',
    unreadCount: 5,
  },
]

test('normalizes Vietnamese accents, casing and whitespace for search', () => {
  assert.equal(normalizeConversationSearch('  ĐÀ   NẴNG  '), 'da nang')
  assert.equal(normalizeConversationSearch(null), '')
})

test('searches safe public conversation fields without depending on accents', () => {
  assert.deepEqual(
    filterConversations(conversations, { query: 'nguyen cong nghe' }).map(({ id }) => id),
    ['connection-1']
  )
  assert.deepEqual(
    filterConversations(conversations, { query: 'thu duc' }).map(({ id }) => id),
    ['connection-3']
  )
})

test('filters unread conversations and preserves their source order', () => {
  assert.deepEqual(
    filterConversations(conversations, { unreadOnly: true }).map(({ id }) => id),
    ['connection-1', 'connection-3']
  )
})

test('combines query and unread state without mutating the original list', () => {
  const filtered = filterConversations(conversations, {
    query: 'team',
    unreadOnly: true,
  })

  assert.deepEqual(filtered, [])
  assert.equal(conversations.length, 3)
  assert.deepEqual(filterConversations(conversations), conversations)
  assert.deepEqual(filterConversations(null), [])
})

test('sorts conversations by latest message activity with stable fallbacks', () => {
  const source = [
    {
      id: 'connection-no-message',
      createdAt: '2026-09-18T08:00:00.000Z',
      respondedAt: '2026-09-18T09:00:00.000Z',
      messages: [],
    },
    {
      id: 'connection-new-message',
      createdAt: '2026-09-18T10:00:00.000Z',
      messages: [{ createdAt: '2026-09-18T12:00:00.000Z' }],
    },
    {
      id: 'connection-old-message',
      createdAt: '2026-09-18T11:00:00.000Z',
      messages: [{ createdAt: '2026-09-18T11:30:00.000Z' }],
    },
    { id: 'connection-unknown', messages: [] },
  ]

  assert.deepEqual(
    sortConversationsByActivity(source).map(({ id }) => id),
    [
      'connection-new-message',
      'connection-old-message',
      'connection-no-message',
      'connection-unknown',
    ]
  )
  assert.equal(source[0].id, 'connection-no-message')
  assert.equal(
    getConversationActivityDate(source[0])?.toISOString(),
    '2026-09-18T09:00:00.000Z'
  )
  assert.equal(getConversationActivityDate({ createdAt: 'invalid' }), null)
})

test('formats compact conversation activity labels', () => {
  const now = Date.parse('2026-09-18T12:00:00.000Z')
  const conversationAt = (createdAt) => ({ messages: [{ createdAt }] })

  assert.equal(
    formatConversationActivityTime(conversationAt('2026-09-18T11:59:30.000Z'), now),
    'Vừa xong'
  )
  assert.equal(
    formatConversationActivityTime(conversationAt('2026-09-18T11:45:00.000Z'), now),
    '15 phút'
  )
  assert.equal(
    formatConversationActivityTime(conversationAt('2026-09-18T09:00:00.000Z'), now),
    '3 giờ'
  )
  assert.equal(
    formatConversationActivityTime(conversationAt('2026-09-15T12:00:00.000Z'), now),
    '3 ngày'
  )
  assert.equal(formatConversationActivityTime({ messages: [] }, now), '')
})
