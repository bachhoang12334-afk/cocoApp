import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getProfileReadiness,
  getPurposeDestination,
  REQUIRED_PROFILE_FIELDS,
} from '../src/lib/profileReadiness.js'

const readyProfile = {
  full_name: 'Nguyễn Minh An',
  university: 'Đại học Quốc gia Hà Nội',
  major: 'Công nghệ thông tin',
  study_year: 'Năm 3',
  gender: 'Nam',
  purpose: 'Học nhóm',
  city: 'Hà Nội',
  area: 'Cầu Giấy',
  proximity_scope: 'same_city',
}

test('uses one nine-field readiness contract for Supabase and form-shaped profiles', () => {
  assert.equal(REQUIRED_PROFILE_FIELDS.length, 9)
  assert.deepEqual(getProfileReadiness(readyProfile), {
    isReady: true,
    missingFields: [],
    missingKeys: [],
    missingLabels: [],
    completedRequired: 9,
    requiredTotal: 9,
    completionPercent: 64,
  })

  assert.equal(getProfileReadiness({
    fullName: 'Nguyễn Minh An',
    university: 'Đại học Quốc gia Hà Nội',
    major: 'Công nghệ thông tin',
    studyYear: 'Năm 3',
    gender: 'Nam',
    purpose: 'Học nhóm',
    city: 'Hà Nội',
    area: 'Cầu Giấy',
    proximityScope: 'same_city',
  }).isReady, true)
})

test('reports missing and invalid required values without making optional fields blockers', () => {
  const readiness = getProfileReadiness({
    ...readyProfile,
    major: '   ',
    purpose: 'Đi chơi',
    bio: '',
    availability_slots: [],
  })

  assert.equal(readiness.isReady, false)
  assert.deepEqual(readiness.missingKeys, ['major', 'purpose'])
  assert.deepEqual(readiness.missingLabels, ['Ngành học', 'Mục tiêu kết nối'])
  assert.equal(readiness.completedRequired, 7)
})

test('maps each collaboration purpose to its focused discovery route', () => {
  assert.equal(getPurposeDestination('Học nhóm'), '/study')
  assert.equal(getPurposeDestination('Team Project'), '/team')
  assert.equal(getPurposeDestination('Ghép trọ'), '/roommates')
  assert.equal(getPurposeDestination(''), '/discover')
})
