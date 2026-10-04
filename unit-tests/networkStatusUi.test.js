import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('authenticated shell exposes one accessible, non-destructive network status banner', async () => {
  const [layoutSource, bannerSource, styles, readme] = await Promise.all([
    readFile(new URL('../src/components/AppLayout.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/NetworkStatusBanner.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/ProductV2.css', import.meta.url), 'utf8'),
    readFile(new URL('../README.md', import.meta.url), 'utf8'),
  ])

  assert.match(layoutSource, /<NetworkStatusBanner\s*\/>/)
  assert.match(bannerSource, /role=\{isOffline \? 'alert' : 'status'\}/)
  assert.match(bannerSource, /aria-atomic="true"/)
  assert.match(bannerSource, /Nội dung đang mở vẫn được giữ/)
  assert.doesNotMatch(bannerSource, /location\.reload|location\.assign/)
  assert.match(styles, /\.network-status-banner\s*\{[^}]*position:\s*sticky/s)
  assert.match(styles, /\.network-status-banner\.is-restored/)
  assert.match(readme, /Banner trạng thái mạng/)
})
