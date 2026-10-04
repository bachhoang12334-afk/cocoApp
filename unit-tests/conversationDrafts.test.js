import assert from 'node:assert/strict'
import test from 'node:test'

import {
  clearConversationDraft,
  CONVERSATION_DRAFT_MAX_LENGTH,
  readConversationDraft,
  saveConversationDraft,
} from '../src/lib/conversationDrafts.js'

function createMemoryStorage() {
  const values = new Map()

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null
    },
    removeItem(key) {
      values.delete(key)
    },
    setItem(key, value) {
      values.set(key, value)
    },
  }
}

const conversation = {
  userId: 'user-a',
  connectionRequestId: 'connection-1',
}

test('stores an exact draft per user and conversation', () => {
  const storage = createMemoryStorage()

  assert.equal(saveConversationDraft(storage, conversation, '  Chào cậu\nMình cùng học nhé.  '), true)
  assert.equal(
    readConversationDraft(storage, conversation),
    '  Chào cậu\nMình cùng học nhé.  '
  )
  assert.equal(readConversationDraft(storage, {
    ...conversation,
    connectionRequestId: 'connection-2',
  }), '')
  assert.equal(readConversationDraft(storage, {
    ...conversation,
    userId: 'user-b',
  }), '')
})

test('removes blank and sent drafts without affecting another conversation', () => {
  const storage = createMemoryStorage()
  const otherConversation = {
    ...conversation,
    connectionRequestId: 'connection-2',
  }

  saveConversationDraft(storage, conversation, 'Nháp thứ nhất')
  saveConversationDraft(storage, otherConversation, 'Nháp thứ hai')
  assert.equal(saveConversationDraft(storage, conversation, '  \n  '), true)
  assert.equal(readConversationDraft(storage, conversation), '')
  assert.equal(readConversationDraft(storage, otherConversation), 'Nháp thứ hai')

  assert.equal(clearConversationDraft(storage, otherConversation), true)
  assert.equal(readConversationDraft(storage, otherConversation), '')
})

test('caps restored content and degrades safely when storage is unavailable', () => {
  const storage = createMemoryStorage()
  const longDraft = 'a'.repeat(CONVERSATION_DRAFT_MAX_LENGTH + 50)

  assert.equal(saveConversationDraft(storage, conversation, longDraft), true)
  assert.equal(
    readConversationDraft(storage, conversation).length,
    CONVERSATION_DRAFT_MAX_LENGTH
  )

  const unavailableStorage = {
    getItem() {
      throw new Error('Storage blocked')
    },
    removeItem() {
      throw new Error('Storage blocked')
    },
    setItem() {
      throw new Error('Storage blocked')
    },
  }

  assert.equal(readConversationDraft(unavailableStorage, conversation), '')
  assert.equal(saveConversationDraft(unavailableStorage, conversation, 'Nháp'), false)
  assert.equal(clearConversationDraft(unavailableStorage, conversation), false)
  assert.equal(saveConversationDraft(storage, { userId: '', connectionRequestId: '' }, 'Nháp'), false)
})
