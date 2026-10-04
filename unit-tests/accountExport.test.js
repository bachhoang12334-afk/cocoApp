import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  createAccountExportFilename,
  createAccountExportPayload,
  getAccountExportErrorMessage,
  serializeAccountExport,
} from '../src/lib/accountExportRules.js'

const exportSource = await readFile(new URL('../src/lib/accountExport.js', import.meta.url), 'utf8')

test('account export uses a deterministic private filename and versioned payload', () => {
  const exportedAt = new Date('2026-10-04T04:05:06.000Z')
  const payload = createAccountExportPayload({
    exportedAt,
    account: {
      id: 'user-1',
      email: 'student@example.com',
      createdAt: '2026-01-01T00:00:00.000Z',
      emailConfirmedAt: null,
      lastSignInAt: null,
      password: 'must-never-be-exported',
      accessToken: 'must-never-be-exported',
    },
    data: { connections: [{ id: 'connection-1' }] },
  })

  assert.equal(createAccountExportFilename(exportedAt), 'coco-du-lieu-2026-10-04.json')
  assert.equal(payload.schemaVersion, 1)
  assert.equal(payload.account.email, 'student@example.com')
  assert.equal(payload.account.password, undefined)
  assert.equal(payload.account.accessToken, undefined)
  assert.deepEqual(payload.data.connections, [{ id: 'connection-1' }])
  assert.deepEqual(payload.data.messages, [])
})

test('serialized account export is readable JSON with a final newline', () => {
  const payload = createAccountExportPayload({
    exportedAt: '2026-10-04T00:00:00.000Z',
    account: { id: 'user-1' },
    data: {},
  })
  const serialized = serializeAccountExport(payload)

  assert.equal(serialized.endsWith('\n'), true)
  assert.deepEqual(JSON.parse(serialized), payload)
})

test('account export maps session and network failures without claiming a download', () => {
  assert.match(getAccountExportErrorMessage({ message: 'JWT expired' }), /đăng nhập lại/i)
  assert.match(getAccountExportErrorMessage({ message: 'Failed to fetch' }), /Chưa có tệp nào/i)
  assert.match(getAccountExportErrorMessage({ message: 'unknown' }), /Chưa có tệp nào/i)
})

test('account export reads only explicit allowlisted columns through RLS-protected tables', () => {
  assert.doesNotMatch(exportSource, /\.select\(['"]\*['"]\)/)
  assert.match(exportSource, /\.from\('profile_private'\)/)
  assert.match(exportSource, /\.from\('messages'\)/)
  assert.match(exportSource, /\.from\('user_reports'\)/)
  assert.doesNotMatch(exportSource, /service_role|access_token|refresh_token/i)
})
