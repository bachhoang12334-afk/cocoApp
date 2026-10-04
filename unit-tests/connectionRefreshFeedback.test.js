import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  getConnectionLoadErrorMessage,
  getConnectionRefreshWarning,
} from '../src/lib/connectionRefreshFeedback.js'

test('initial connection failures describe the blocking recovery path', () => {
  assert.match(
    getConnectionLoadErrorMessage(new Error('JWT session missing')),
    /đăng nhập lại/i
  )
  assert.match(
    getConnectionLoadErrorMessage(new Error('row-level security policy')),
    /quyền truy cập/i
  )
  assert.match(
    getConnectionLoadErrorMessage(new Error('unknown')),
    /không thể tải danh sách kết nối/i
  )
})

test('background refresh failures preserve the last successful snapshot', () => {
  assert.match(
    getConnectionRefreshWarning(new Error('Failed to fetch')),
    /danh sách gần nhất vẫn được giữ/i
  )
  assert.match(
    getConnectionRefreshWarning(new Error('network timeout')),
    /thử lại khi thiết bị có mạng/i
  )
  assert.match(
    getConnectionRefreshWarning(new Error('permission denied')),
    /đăng nhập lại/i
  )
})

test('Matches offers manual recovery and refreshes once after reconnection', async () => {
  const matchesSource = await readFile(
    new URL('../src/pages/Matches.jsx', import.meta.url),
    'utf8'
  )

  assert.match(matchesSource, /networkStatus !== NETWORK_STATUS_RESTORED/)
  assert.match(matchesSource, /void retryConnectionRefresh\(\)/)
  assert.match(matchesSource, /Đang dùng dữ liệu gần nhất/)
  assert.match(matchesSource, /Thử đồng bộ lại/)
  assert.match(matchesSource, /role="status"/)
  assert.match(matchesSource, /aria-busy=\{isRefreshingSnapshot\}/)
})
