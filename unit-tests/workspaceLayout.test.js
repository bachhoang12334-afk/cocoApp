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

test('authenticated pages use the Coco workspace hierarchy', () => {
  assert.match(layoutSource, /className="product-rail"/)
  assert.match(layoutSource, /className="product-sidebar-panel"/)
  assert.match(layoutSource, /className="workspace-tabs"/)
  assert.match(layoutSource, /className="product-workspace"/)
  assert.match(layoutSource, /className="product-context-panel"/)
  assert.match(layoutSource, /className="product-statusbar"/)
})

test('workspace navigation keeps keyboard and screen-reader landmarks', () => {
  assert.match(layoutSource, /href="#workspace-main"/)
  assert.match(layoutSource, /id="workspace-main"/)
  assert.match(layoutSource, /aria-label="Điều hướng nhanh"/)
  assert.match(layoutSource, /aria-label="Mục tiêu kết nối"/)
  assert.match(layoutSource, /aria-label="Khu vực CocoApp"/)
  assert.match(layoutSource, /aria-label="Thông tin hỗ trợ"/)
  assert.match(layoutSource, /aria-label="Trạng thái ứng dụng"/)
})

test('workspace adapts from five-region desktop to focused mobile navigation', () => {
  assert.match(productStyles, /grid-template-columns: var\(--workspace-rail-width\) minmax\(0, 248px\)/)
  assert.match(productStyles, /grid-template-columns: minmax\(0, 1fr\) 292px/)
  assert.match(productStyles, /@media \(max-width: 760px\)/)
  assert.match(productStyles, /\.product-statusbar\s*\{[\s\S]*?display: none;/)
  assert.match(productStyles, /\.mobile-bottom-nav\s*\{[\s\S]*?z-index: 70;/)
  assert.match(productStyles, /@media \(prefers-reduced-motion: reduce\)/)
})


test('collapsed workspace keeps logout accessible from the navigation rail', () => {
  assert.match(layoutSource, /className="rail-logout"/)
  assert.match(layoutSource, /aria-label="Đăng xuất"/)
  assert.match(productStyles, /sidebar-is-collapsed \.rail-logout/)
})


test('workspace uses one stable rail toggle and keeps medium desktop expansion available', () => {
  assert.match(layoutSource, /className="rail-sidebar-toggle"/)
  assert.match(layoutSource, /Mở menu/)
  assert.doesNotMatch(layoutSource, /className="sidebar-toggle"/)
  assert.match(productStyles, /product-shell\.sidebar-is-expanded[\s\S]*?--workspace-navigation-width: 320px/)
  assert.match(productStyles, /sidebar-is-expanded \.product-sidebar-panel[\s\S]*?display: flex/)
})


test('expanded workspace shows an explicit logout label', () => {
  assert.match(layoutSource, /className="logout-button"[\s\S]*?<span>Đăng xuất<\/span>/)
  assert.match(productStyles, /product-sidebar-panel \.logout-button span[\s\S]*?display: inline/)
})
