import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const mainSource = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8')
const registrationSource = await readFile(
  new URL('../src/lib/registerServiceWorker.js', import.meta.url),
  'utf8'
)
const workerSource = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8')
const manifest = JSON.parse(
  await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8')
)

test('CocoApp registers its service worker only for production browsers', () => {
  assert.match(mainSource, /window\.addEventListener\('load'/)
  assert.match(mainSource, /registerCocoServiceWorker\(\)\.catch/)
  assert.match(registrationSource, /import\.meta\.env\.PROD/)
  assert.match(registrationSource, /'serviceWorker' in navigator/)
  assert.match(registrationSource, /register\('\/sw\.js', \{ scope: '\/' \}\)/)
})

test('offline shell caches only same-origin static resources without authorization', () => {
  assert.match(workerSource, /url\.origin !== self\.location\.origin/)
  assert.match(workerSource, /request\.headers\.has\('authorization'\)/)
  assert.match(workerSource, /url\.pathname\.startsWith\('\/assets\/'\)/)
  assert.match(workerSource, /request\.mode === 'navigate'/)
  assert.match(workerSource, /caches\.match\('\/index\.html'\)/)
  assert.doesNotMatch(workerSource, /supabase/i)
})

test('web manifest keeps CocoApp installable as a scoped standalone app', () => {
  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.scope, '/')
  assert.equal(manifest.start_url, '/dashboard')
  assert.ok(manifest.icons.length > 0)
})
