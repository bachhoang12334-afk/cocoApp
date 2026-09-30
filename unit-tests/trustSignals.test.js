import assert from 'node:assert/strict'
import test from 'node:test'
import { getTrustSignal } from '../src/lib/trustSignals.js'

test('manual student verification has priority over email signals', () => {
  assert.equal(getTrustSignal({
    verification_status: 'verified',
    education_email: true,
    email_confirmed: true,
  }).key, 'verified')
})

test('confirmed education email is described without claiming student verification', () => {
  const signal = getTrustSignal({ education_email: true, email_confirmed: true })

  assert.equal(signal.label, 'Email trường đã xác nhận')
  assert.match(signal.description, /chưa phải là xác minh danh tính sinh viên/i)
})

test('generic confirmed email remains distinct from education email', () => {
  assert.equal(getTrustSignal({ email_confirmed: true }).key, 'confirmed')
  assert.equal(getTrustSignal({ email_confirmed: false }).key, 'unconfirmed')
})
