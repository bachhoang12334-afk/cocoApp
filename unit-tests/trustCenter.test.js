import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const registerSource = await readFile(new URL('../src/pages/Register.jsx', import.meta.url), 'utf8')
const trustSource = await readFile(new URL('../src/pages/TrustCenter.jsx', import.meta.url), 'utf8')

test('the trust center is public and keeps authenticated safety navigation available', () => {
  assert.match(appSource, /path="\/trust" element=\{<TrustCenter account=\{account\} \/>\}/)
  assert.doesNotMatch(appSource, /protectedPage\(<TrustCenter/)
  assert.match(trustSource, /isAuthenticated \? '\/safety' : '\/register'/)
})

test('registration requires explicit agreement with the usage and community rules', () => {
  assert.match(registerSource, /if \(!acceptedGuidelines\)/)
  assert.match(registerSource, /nextErrors\.guidelines/)
  assert.match(registerSource, /to="\/trust#terms"/)
  assert.match(registerSource, /to="\/trust#community"/)
})

test('trust copy distinguishes private data, matching signals, and account deletion rights', () => {
  assert.match(trustSource, /Email đăng nhập, số điện thoại, danh sách đã lưu, báo cáo/)
  assert.match(trustSource, /không yêu cầu GPS, số nhà, căn cước/)
  assert.match(trustSource, /Xoá vĩnh viễn tài khoản và dữ liệu gắn với tài khoản/)
  assert.match(trustSource, /không bảo đảm danh tính, năng lực, hành vi hay độ an toàn/)
})
