import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { shouldBlockProfileNavigation } from '../src/lib/profileNavigationGuard.js'

test('blocks leaving Profile while there are unsaved changes', () => {
  assert.equal(
    shouldBlockProfileNavigation({
      isDirty: true,
      currentPathname: '/profile',
      nextPathname: '/dashboard',
    }),
    true
  )
})

test('allows clean navigation and in-page Profile links', () => {
  assert.equal(
    shouldBlockProfileNavigation({
      isDirty: false,
      currentPathname: '/profile',
      nextPathname: '/dashboard',
    }),
    false
  )
  assert.equal(
    shouldBlockProfileNavigation({
      isDirty: true,
      currentPathname: '/profile',
      nextPathname: '/profile',
    }),
    false
  )
})

test('Profile wires both SPA and browser-exit protection into accessible confirmation UI', async () => {
  const [appSource, profileSource] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/Profile.jsx', import.meta.url), 'utf8'),
  ])

  assert.match(appSource, /createBrowserRouter/)
  assert.match(appSource, /<RouterProvider router=\{router\}/)
  assert.match(profileSource, /useBlocker/)
  assert.match(profileSource, /beforeunload/)
  assert.match(profileSource, /role="alertdialog"/)
  assert.match(profileSource, /blocker\.reset/)
  assert.match(profileSource, /blocker\.proceed/)
})
