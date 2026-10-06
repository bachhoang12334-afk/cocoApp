import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const layoutSource = await readFile(new URL('../src/components/AppLayout.jsx', import.meta.url), 'utf8')
const roomsSource = await readFile(new URL('../src/pages/Rooms.jsx', import.meta.url), 'utf8')
const studySource = await readFile(new URL('../src/pages/StudyHub.jsx', import.meta.url), 'utf8')
const migrationSource = await readFile(
  new URL('../supabase/migrations/20261006000024_add_campus_ecosystem.sql', import.meta.url),
  'utf8'
)

test('campus routes expose rooms and Study Hub inside authenticated navigation', () => {
  assert.match(appSource, /path="\/rooms"/)
  assert.match(appSource, /path="\/study-hub"/)
  assert.match(layoutSource, /label: 'Phòng trọ'/)
  assert.match(layoutSource, /label: 'Study Hub'/)
})

test('room discovery prefers Supabase and keeps a resilient demo fallback', () => {
  assert.match(roomsSource, /from\('room_listings'\)/)
  assert.match(roomsSource, /from\('room_bookings'\)/)
  assert.match(roomsSource, /SAMPLE_ROOMS/)
  assert.match(roomsSource, /student_phone/)
})

test('Study Hub supports persisted posts and study materials', () => {
  assert.match(studySource, /from\('study_posts'\)/)
  assert.match(studySource, /from\('study_materials'\)/)
  assert.match(studySource, /Tạo bài tìm nhóm/)
  assert.match(studySource, /Chia sẻ tài liệu/)
})

test('campus database tables are protected with row level security', () => {
  assert.match(migrationSource, /alter table public\.room_bookings enable row level security/)
  assert.match(migrationSource, /alter table public\.study_posts enable row level security/)
  assert.match(migrationSource, /student_id = \(select auth\.uid\(\)\)/)
  assert.match(migrationSource, /author_id = \(select auth\.uid\(\)\)/)
})
