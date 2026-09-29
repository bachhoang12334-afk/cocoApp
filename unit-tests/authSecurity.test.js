import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getNewPasswordErrors,
  isPasswordRecoveryRedirect,
  normalizeAndValidateEmail,
} from '../src/lib/authSecurity.js'

test('normalizes an email before sending it to Supabase Auth', () => {
  assert.equal(
    normalizeAndValidateEmail('  Student@Example.COM  '),
    'student@example.com'
  )
  assert.throws(
    () => normalizeAndValidateEmail('invalid-email'),
    /Email chưa đúng định dạng/
  )
})

test('validates both password recovery fields without exposing the password', () => {
  assert.deepEqual(getNewPasswordErrors('', ''), {
    password: 'Hãy nhập mật khẩu mới.',
    confirmPassword: 'Hãy nhập lại mật khẩu mới.',
  })
  assert.deepEqual(getNewPasswordErrors('123456', '654321'), {
    confirmPassword: 'Hai ô mật khẩu chưa giống nhau.',
  })
  assert.deepEqual(getNewPasswordErrors('123456', '123456'), {})
})

test('accepts Supabase implicit and PKCE recovery redirects only', () => {
  assert.equal(
    isPasswordRecoveryRedirect('http://127.0.0.1:5173/reset-password#type=recovery&access_token=hidden'),
    true
  )
  assert.equal(
    isPasswordRecoveryRedirect('http://127.0.0.1:5173/reset-password?code=hidden'),
    true
  )
  assert.equal(
    isPasswordRecoveryRedirect('http://127.0.0.1:5173/reset-password'),
    false
  )
  assert.equal(isPasswordRecoveryRedirect('not-a-url'), false)
})
