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
  assert.equal(
    shouldBlockProfileNavigation({
      isDirty: true,
      discardConfirmed: true,
      currentPathname: '/profile',
      nextPathname: '/login',
    }),
    false
  )
})

test('Profile wires both SPA and browser-exit protection into accessible confirmation UI', async () => {
  const [appSource, layoutSource, profileSource] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/AppLayout.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/Profile.jsx', import.meta.url), 'utf8'),
  ])

  assert.match(appSource, /createBrowserRouter/)
  assert.match(appSource, /<RouterProvider router=\{router\}/)
  assert.match(profileSource, /useBlocker/)
  assert.match(profileSource, /beforeunload/)
  assert.match(profileSource, /role="alertdialog"/)
  assert.match(profileSource, /blocker\.reset/)
  assert.match(profileSource, /blocker\.proceed/)
  assert.match(profileSource, /beforeLogout=\{confirmLogout\}/)
  assert.match(layoutSource, /await beforeLogout\(\)/)
  assert.match(layoutSource, /await logoutAccount\(\)/)
  assert.ok(
    layoutSource.indexOf('await beforeLogout()') < layoutSource.indexOf('await logoutAccount()'),
    'logout confirmation must resolve before ending the Supabase session'
  )
})
