import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { getConnectionRequestErrorMessage } from '../src/lib/connectionRequestErrors.js'

const migration = await readFile(
  new URL('../supabase/migrations/20260917000022_limit_connection_request_spam.sql', import.meta.url),
  'utf8'
)

test('connection request limits are enforced atomically at the database boundary', () => {
  const limiter = migration.match(
    /create or replace function public\.limit_connection_request_spam\(\)[\s\S]*?\$\$;/
  )?.[0] || ''

  assert.match(limiter, /security definer/)
  assert.match(limiter, /set search_path = ''/)
  assert.match(limiter, /new\.requester_id <> auth\.uid\(\)/)
  assert.match(limiter, /pg_advisory_xact_lock/)
  assert.match(limiter, /status in \('declined', 'cancelled'\)/)
  assert.match(limiter, /coalesce\(request\.responded_at, request\.updated_at, request\.created_at\)/)
  assert.match(limiter, /interval '60 minutes'/)
  assert.match(limiter, /interval '10 minutes'[\s\S]*recent_request_count >= 5/)
  assert.match(limiter, /interval '24 hours'[\s\S]*daily_request_count >= 20/)
  assert.match(migration, /before insert on public\.connection_requests/)
  assert.match(
    migration,
    /revoke all on function public\.limit_connection_request_spam\(\)[\s\S]*from public, anon, authenticated;/
  )
  assert.doesNotMatch(migration, /profile_private|phone|exact_address/i)
})

test('connection request rate-limit errors remain actionable without exposing history', () => {
  assert.match(
    getConnectionRequestErrorMessage({ message: 'connection_request_recipient_cooldown' }),
    /60 phút/
  )
  assert.match(
    getConnectionRequestErrorMessage({ message: 'connection_request_rate_limit_short_window' }),
    /thời gian ngắn/
  )
  assert.match(
    getConnectionRequestErrorMessage({ message: 'connection_request_rate_limit_daily' }),
    /20 lời mời trong 24 giờ/
  )
  assert.doesNotMatch(
    getConnectionRequestErrorMessage({ message: 'connection_request_rate_limit_daily' }),
    /recipient|requester|uuid|database/i
  )
})

test('existing connection request failures keep their specific guidance', () => {
  assert.match(
    getConnectionRequestErrorMessage({ message: 'Roommate requests require matching genders' }),
    /chưa cùng giới tính/
  )
  assert.match(
    getConnectionRequestErrorMessage({ code: '23505' }),
    /lời mời đang chờ hoặc kết nối/
  )
  assert.match(
    getConnectionRequestErrorMessage({ message: 'Users cannot connect while blocked' }),
    /cài đặt an toàn/
  )
  assert.match(
    getConnectionRequestErrorMessage({ message: 'Connection request intro must be between 8 and 240 characters' }),
    /8 đến 240 ký tự/
  )
  assert.match(
    getConnectionRequestErrorMessage({ message: 'connection_profile_not_ready' }),
    /chưa đủ thông tin/
  )
  assert.match(
    getConnectionRequestErrorMessage({ message: 'connection_requests_paused' }),
    /tạm dừng kết nối mới/
  )
})
