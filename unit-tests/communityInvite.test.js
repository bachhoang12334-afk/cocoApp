import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getCommunityInviteLink,
  getCommunityInviteMessage,
} from '../src/lib/communityInvite.js'

test('builds a registration link without exposing a profile identifier', () => {
  const link = getCommunityInviteLink('https://coco.example')

  assert.equal(link, 'https://coco.example/register')
  assert.doesNotMatch(link, /user|profile|ref=/i)
})

test('creates a concise purpose-led invitation', () => {
  const message = getCommunityInviteMessage('http://127.0.0.1:5173')

  assert.match(message, /bạn học, team project hoặc người ghép trọ/i)
  assert.match(message, /http:\/\/127\.0\.0\.1:5173\/register/)
})

test('falls back to a safe relative registration path', () => {
  assert.equal(getCommunityInviteLink('not a valid origin'), '/register')
})
