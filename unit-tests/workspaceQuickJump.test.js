import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const layoutSource = await readFile(
  new URL('../src/components/AppLayout.jsx', import.meta.url),
  'utf8'
)
const productStyles = await readFile(
  new URL('../src/ProductV2.css', import.meta.url),
  'utf8'
)

test('workspace quick jump opens from an accessible trigger and Ctrl or Command K', () => {
  assert.match(layoutSource, /aria-label="Đi nhanh đến một khu vực, phím tắt Control hoặc Command K"/)
  assert.match(layoutSource, /aria-expanded=\{quickJumpOpen\}/)
  assert.match(layoutSource, /event\.ctrlKey \|\| event\.metaKey/)
  assert.match(layoutSource, /event\.key\.toLocaleLowerCase\('vi'\) === 'k'/)
})

test('workspace quick jump behaves as a keyboard-safe modal dialog', () => {
  assert.match(layoutSource, /role="dialog"/)
  assert.match(layoutSource, /aria-modal="true"/)
  assert.match(layoutSource, /event\.key === 'Escape'/)
  assert.match(layoutSource, /document\.body\.style\.overflow = 'hidden'/)
  assert.match(layoutSource, /returnFocusRef\.current\?\.focus/)
  assert.match(layoutSource, /querySelectorAll/)
  assert.match(layoutSource, /event\.key !== 'Tab'/)
})

test('workspace quick jump search is accent-insensitive and responsive', () => {
  assert.match(layoutSource, /normalize\('NFD'\)/)
  assert.match(layoutSource, /replace\(\/\[\\u0300-\\u036f\]\/g, ''\)/)
  assert.match(layoutSource, /Không tìm thấy khu vực này/)
  assert.match(productStyles, /\.workspace-search-trigger\s*\{[\s\S]*?min-height: 44px;/)
  assert.match(productStyles, /\.quick-jump-dialog\s*\{[\s\S]*?width: min\(640px, 100%\);/)
  assert.match(productStyles, /@media \(max-width: 760px\)[\s\S]*?\.quick-jump-dialog/)
})
