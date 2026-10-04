import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const viteConfig = await readFile(
  new URL('../vite.config.js', import.meta.url),
  'utf8'
)

test('production build isolates third-party dependencies from app code', () => {
  assert.match(viteConfig, /rolldownOptions/)
  assert.match(viteConfig, /codeSplitting/)
  assert.match(viteConfig, /name: 'vendor'/)
  assert.match(viteConfig, /test: \/node_modules\[\\\\\/\]\//)
})
