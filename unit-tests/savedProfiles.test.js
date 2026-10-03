import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getSavedProfileErrorMessage,
  normalizeSavedProfileIds,
  updateSavedProfileIds,
} from '../src/lib/savedProfiles.js'

test('normalizes private saved-profile rows into stable unique ids', () => {
  assert.deepEqual(normalizeSavedProfileIds([
    { saved_profile_id: 'profile-a' },
    { saved_profile_id: 'profile-a' },
    { saved_profile_id: 'profile-b' },
    { saved_profile_id: '' },
    null,
  ]), ['profile-a', 'profile-b'])
  assert.deepEqual(normalizeSavedProfileIds(null), [])
})

test('adds and removes saved profiles without creating duplicates', () => {
  assert.deepEqual(
    updateSavedProfileIds(['profile-a'], 'profile-b', true),
    ['profile-a', 'profile-b']
  )
  assert.deepEqual(
    updateSavedProfileIds(['profile-a', 'profile-a'], 'profile-a', true),
    ['profile-a']
  )
  assert.deepEqual(
    updateSavedProfileIds(['profile-a', 'profile-b'], 'profile-a', false),
    ['profile-b']
  )
})

test('maps database safety failures to actionable Vietnamese feedback', () => {
  assert.match(
    getSavedProfileErrorMessage({ message: 'saved_profile_not_ready' }),
    /chưa đủ thông tin/i
  )
  assert.match(
    getSavedProfileErrorMessage({ message: 'saved_profile_blocked' }),
    /cài đặt an toàn/i
  )
  assert.match(
    getSavedProfileErrorMessage({ code: 'PGRST205' }),
    /chưa được bật trên Supabase/i
  )
})
