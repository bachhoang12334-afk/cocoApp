import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getConnectionInviteError,
  getConnectionInviteTemplates,
  normalizeConnectionInvite,
} from '../src/lib/connectionInvite.js'

test('offers purpose-specific invitation starters', () => {
  assert.match(getConnectionInviteTemplates('Học nhóm')[0], /học nhóm/i)
  assert.match(getConnectionInviteTemplates('Team Project')[0], /dự án/i)
  assert.match(getConnectionInviteTemplates('Ghép trọ')[0], /ghép trọ/i)
})

test('normalizes invitation whitespace without exposing extra fields', () => {
  assert.equal(
    normalizeConnectionInvite('  Chào cậu,   mình muốn kết nối.  '),
    'Chào cậu, mình muốn kết nối.'
  )
})

test('requires a useful invitation within the database length contract', () => {
  assert.match(getConnectionInviteError('Chào'), /ít nhất 8 ký tự/i)
  assert.equal(getConnectionInviteError('Chào cậu, mình muốn trao đổi thêm.'), '')
  assert.match(getConnectionInviteError('a'.repeat(241)), /240 ký tự/i)
})
