import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getProximityLabel,
  getProximityLevel,
  matchesProximityScope,
  normalizeLocation,
  normalizeProximityScope,
} from '../src/lib/proximityMatching.js'

test('normalizes accents, spacing, and common Ho Chi Minh city aliases', () => {
  assert.equal(normalizeLocation('  Cầu   Giấy '), 'cau giay')
  assert.equal(normalizeLocation('Thành phố Hồ Chí Minh'), 'ho chi minh')
  assert.equal(normalizeLocation('TP.HCM'), 'ho chi minh')
  assert.equal(normalizeLocation('Sài Gòn'), 'ho chi minh')
})

test('falls back to a privacy-safe same-city scope', () => {
  assert.equal(normalizeProximityScope('same_area'), 'same_area')
  assert.equal(normalizeProximityScope('anywhere'), 'anywhere')
  assert.equal(normalizeProximityScope('invalid'), 'same_city')
  assert.equal(normalizeProximityScope(), 'same_city')
})

test('classifies broad location levels without coordinates', () => {
  const origin = { city: 'Hà Nội', area: 'Cầu Giấy' }

  assert.equal(
    getProximityLevel(origin, { city: 'Ha Noi', area: 'Cau Giay' }),
    'same_area'
  )
  assert.equal(
    getProximityLevel(origin, { city: 'Hà Nội', area: 'Hai Bà Trưng' }),
    'same_city'
  )
  assert.equal(
    getProximityLevel(origin, { city: 'Đà Nẵng', area: 'Hải Châu' }),
    'different_city'
  )
  assert.equal(getProximityLevel(origin, { city: '', area: '' }), 'unknown')
  assert.equal(
    getProximityLevel(origin, {
      city: 'Chưa cập nhật tỉnh / thành phố',
      area: 'Chưa cập nhật khu vực',
    }),
    'unknown'
  )
  assert.equal(
    getProximityLevel(
      { city: 'Hà Nội', area: 'Cầu Giấy, Thanh Xuân' },
      { city: 'Hà Nội', area: 'Thanh Xuân' }
    ),
    'same_area'
  )
})

test('filters by the selected broad scope and keeps nationwide discovery open', () => {
  const origin = { city: 'Hà Nội', area: 'Cầu Giấy' }
  const sameArea = { city: 'Ha Noi', area: 'Cau Giay' }
  const sameCity = { city: 'Hà Nội', area: 'Thanh Xuân' }
  const otherCity = { city: 'Đà Nẵng', area: 'Hải Châu' }

  assert.equal(matchesProximityScope(origin, sameArea, 'same_area'), true)
  assert.equal(matchesProximityScope(origin, sameCity, 'same_area'), false)
  assert.equal(matchesProximityScope(origin, sameArea, 'same_city'), true)
  assert.equal(matchesProximityScope(origin, sameCity, 'same_city'), true)
  assert.equal(matchesProximityScope(origin, otherCity, 'same_city'), false)
  assert.equal(matchesProximityScope(origin, otherCity, 'anywhere'), true)
})

test('uses honest proximity labels instead of simulated kilometre values', () => {
  const origin = { city: 'Hà Nội', area: 'Cầu Giấy' }

  assert.equal(
    getProximityLabel(origin, { city: 'Hà Nội', area: 'Cầu Giấy' }),
    'Cùng khu vực Cầu Giấy'
  )
  assert.equal(
    getProximityLabel(origin, { city: 'Hà Nội', area: 'Thanh Xuân' }),
    'Cùng Hà Nội'
  )
  assert.equal(
    getProximityLabel(origin, { city: 'Đà Nẵng', area: 'Hải Châu' }),
    'Khác tỉnh / thành phố'
  )
  assert.equal(
    getProximityLabel(origin, { city: '', area: '' }),
    'Chưa đủ dữ liệu khu vực'
  )
})
