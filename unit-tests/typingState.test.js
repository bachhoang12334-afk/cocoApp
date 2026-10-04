import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createTypingPayload,
  isTypingEventForConversation,
  TYPING_EVENT_MAX_AGE_MS,
} from '../src/lib/typingState.js'

test('typing payload carries presence only and never includes draft content', () => {
  const payload = createTypingPayload({
    connectionRequestId: 'connection-1',
    senderId: 'user-a',
    isTyping: true,
    sentAt: 1000,
    draft: 'Nội dung này không được truyền đi',
  })

  assert.deepEqual(payload, {
    connectionRequestId: 'connection-1',
    senderId: 'user-a',
    isTyping: true,
    sentAt: 1000,
  })
  assert.equal('draft' in payload, false)
  assert.equal('text' in payload, false)
})

test('typing events must target the active conversation and come from the other user', () => {
  const payload = createTypingPayload({
    connectionRequestId: 'connection-1',
    senderId: 'user-b',
    isTyping: true,
    sentAt: 5000,
  })
  const context = {
    connectionRequestId: 'connection-1',
    currentUserId: 'user-a',
    now: 5500,
  }

  assert.equal(isTypingEventForConversation(payload, context), true)
  assert.equal(isTypingEventForConversation(payload, {
    ...context,
    connectionRequestId: 'connection-2',
  }), false)
  assert.equal(isTypingEventForConversation(payload, {
    ...context,
    currentUserId: 'user-b',
  }), false)
})

test('typing events expire instead of leaving a stale indicator', () => {
  const payload = createTypingPayload({
    connectionRequestId: 'connection-1',
    senderId: 'user-b',
    isTyping: true,
    sentAt: 5000,
  })

  assert.equal(isTypingEventForConversation(payload, {
    connectionRequestId: 'connection-1',
    currentUserId: 'user-a',
    now: 5000 + TYPING_EVENT_MAX_AGE_MS + 1,
  }), false)

  assert.equal(isTypingEventForConversation(payload, {
    connectionRequestId: 'connection-1',
    currentUserId: 'user-a',
    now: 5000 - TYPING_EVENT_MAX_AGE_MS - 1,
  }), false)
})
