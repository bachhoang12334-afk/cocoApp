import assert from 'node:assert/strict'
import test from 'node:test'
import { getMatchSignals, sortStudentsByMatch } from '../src/lib/matchSignals.js'

test('explains matching signals using only shared public criteria', () => {
  const result = getMatchSignals(
    {
      purpose: 'Học nhóm',
      major: 'Công nghệ thông tin',
      city: 'Hà Nội',
      area: 'Cầu Giấy',
    },
    {
      purpose: 'Học nhóm',
      major: 'Công nghệ thông tin',
      city: 'Ha Noi',
      area: 'Cau Giay',
    }
  )

  assert.equal(result.level, 'strong')
  assert.deepEqual(result.reasons, [
    'Cùng mục tiêu Học nhóm',
    'Cùng ngành Công nghệ thông tin',
    'Cùng khu vực Cau Giay',
  ])
})

test('does not claim compatibility when there is no shared criterion', () => {
  const result = getMatchSignals(
    { purpose: 'Học nhóm', city: 'Hà Nội' },
    { purpose: 'Team Project', city: 'Đà Nẵng', major: 'Thiết kế' }
  )

  assert.equal(result.rank, 0)
  assert.equal(result.label, 'Khám phá thêm')
  assert.deepEqual(result.reasons, ['Đang tìm team project'])
})

test('sorts stronger matches first and preserves source order for ties', () => {
  const students = [
    { id: 'newest', purpose: 'Team Project', city: 'Hồ Chí Minh' },
    { id: 'best', purpose: 'Học nhóm', city: 'Hà Nội' },
    { id: 'same-rank', purpose: 'Team Project', city: 'Hà Nội' },
  ]

  const sorted = sortStudentsByMatch(students, {
    purpose: 'Học nhóm',
    city: 'Hà Nội',
  })

  assert.deepEqual(sorted.map((student) => student.id), [
    'best',
    'same-rank',
    'newest',
  ])
})
