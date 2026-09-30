import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getAvailabilityLabel,
  getPreferenceOption,
  normalizeAvailabilitySlots,
  COLLABORATION_STYLE_OPTIONS,
} from '../src/lib/matchingPreferences.js'

test('normalizes public availability to supported unique broad time slots', () => {
  assert.deepEqual(
    normalizeAvailabilitySlots([
      'weekday_evening',
      'exact_class_schedule',
      'weekday_evening',
      'weekend_morning',
    ]),
    ['weekday_evening', 'weekend_morning']
  )
})

test('returns safe display labels for matching preferences', () => {
  assert.equal(getAvailabilityLabel('weekday_evening'), 'Tối trong tuần')
  assert.equal(getAvailabilityLabel('weekday_evening', { short: true }), 'Tối T2–T6')
  assert.equal(getAvailabilityLabel('unknown'), '')
  assert.equal(
    getPreferenceOption(COLLABORATION_STYLE_OPTIONS, 'structured')?.label,
    'Có kế hoạch rõ ràng'
  )
})
