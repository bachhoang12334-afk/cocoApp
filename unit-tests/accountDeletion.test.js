import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ACCOUNT_DELETION_CONFIRMATION,
  getAccountDeletionErrorMessage,
  isAccountDeletionConfirmed,
  normalizeAccountDeletionConfirmation,
} from '../src/lib/accountDeletionRules.js'

test('account deletion requires the complete explicit confirmation phrase', () => {
  assert.equal(ACCOUNT_DELETION_CONFIRMATION, 'XOA TAI KHOAN')
  assert.equal(isAccountDeletionConfirmed('xoa tai khoan'), true)
  assert.equal(isAccountDeletionConfirmed('  XOA   TAI KHOAN  '), true)
  assert.equal(isAccountDeletionConfirmed('xoa tai kho'), false)
  assert.equal(isAccountDeletionConfirmed(''), false)
})

test('account deletion confirmation normalization does not accept added text', () => {
  assert.equal(
    normalizeAccountDeletionConfirmation('xoa tai khoan ngay'),
    'XOA TAI KHOAN NGAY'
  )
  assert.equal(isAccountDeletionConfirmed('xoa tai khoan ngay'), false)
})

test('account deletion failures explain whether data remains intact', () => {
  assert.match(
    getAccountDeletionErrorMessage({ message: 'Failed to fetch' }),
    /Tài khoản chưa bị xoá/
  )
  assert.match(
    getAccountDeletionErrorMessage({ message: 'account_deletion_unauthorized' }),
    /đăng nhập lại/
  )
  assert.match(
    getAccountDeletionErrorMessage({ message: 'database unavailable' }),
    /Dữ liệu vẫn được giữ nguyên/
  )
})
