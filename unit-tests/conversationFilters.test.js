import assert from 'node:assert/strict'
import test from 'node:test'

import {
  filterConversations,
  normalizeConversationSearch,
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
