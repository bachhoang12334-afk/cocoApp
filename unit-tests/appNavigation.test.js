import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getDashboardConnectionTarget,
  getGuestRouteRedirect,
  getPostRegistrationNavigation,
  MATCHES_ACCEPTED_TARGET,
  MATCHES_PENDING_TARGET,
  parseMatchesOverviewTarget,
} from '../src/lib/appNavigation.js'

const CONNECTION_ID = '11111111-1111-4111-8111-111111111111'

test('authenticated accounts leave guest-only auth routes after session checking', () => {
  assert.equal(
    getGuestRouteRedirect({ isAuthenticated: true, isCheckingSession: false }),
    '/dashboard'
  )
  assert.equal(
    getGuestRouteRedirect({ isAuthenticated: false, isCheckingSession: false }),
    null
  )
  assert.equal(
    getGuestRouteRedirect({ isAuthenticated: true, isCheckingSession: true }),
    null
  )
})

test('registration routes authenticated sessions to the connection-readiness onboarding', () => {
  assert.deepEqual(
    getPostRegistrationNavigation({
      requiresEmailConfirmation: false,
      isAuthenticated: true,
      email: 'Student@Example.com ',
    }),
    {
      to: '/profile?welcome=1',
      options: {
        replace: true,
        state: { welcome: true },
      },
    }
  )
})

test('registration keeps confirmation-required and session-fallback success state on Login', () => {
  assert.deepEqual(
    getPostRegistrationNavigation({
      requiresEmailConfirmation: true,
      isAuthenticated: false,
      email: ' Student@Example.com ',
    }),
    {
      to: '/login',
      options: {
        replace: true,
        state: {
          registered: true,
          requiresEmailConfirmation: true,
          email: 'student@example.com',
        },
      },
    }
  )

  assert.equal(
    getPostRegistrationNavigation({
      requiresEmailConfirmation: false,
      isAuthenticated: false,
      email: 'student@example.com',
    }).to,
    '/login'
  )
})

test('Dashboard overview targets preserve the selected connection state', () => {
  assert.equal(MATCHES_PENDING_TARGET, '/matches?focus=pending')
  assert.equal(MATCHES_ACCEPTED_TARGET, '/matches?focus=accepted')
  assert.equal(parseMatchesOverviewTarget('?focus=pending'), 'pending')
  assert.equal(parseMatchesOverviewTarget('?focus=accepted'), 'accepted')
})

test('Matches overview parser rejects ambiguous and contextual deep links', () => {
  const invalidSearches = [
    '',
    '?focus=unknown',
    '?focus=pending&focus=accepted',
    `?focus=pending&connection=${CONNECTION_ID}`,
    '?focus=accepted&event=connection_disconnected',
    '?focus=accepted&source=dashboard',
  ]

  for (const search of invalidSearches) {
    assert.equal(parseMatchesOverviewTarget(search), null, search)
  }
})

test('Dashboard opens exact accepted conversations and valid incoming pending rows', () => {
  assert.equal(
    getDashboardConnectionTarget({
      id: CONNECTION_ID,
      status: 'accepted',
      isIncoming: false,
    }),
    `/matches?connection=${CONNECTION_ID}&focus=conversation`
  )
  assert.equal(
    getDashboardConnectionTarget({
      id: CONNECTION_ID,
      status: 'pending',
      isIncoming: true,
    }),
    `/matches?connection=${CONNECTION_ID}&focus=pending`
  )
})

test('Dashboard avoids exact-row URLs for outgoing or malformed pending requests', () => {
  assert.equal(
    getDashboardConnectionTarget({
      id: CONNECTION_ID,
      status: 'pending',
      isIncoming: false,
    }),
    MATCHES_PENDING_TARGET
  )
  assert.equal(
    getDashboardConnectionTarget({
      id: 'not-a-uuid',
      status: 'pending',
      isIncoming: true,
    }),
    MATCHES_PENDING_TARGET
  )
  assert.equal(
    getDashboardConnectionTarget({
      id: 'not-a-uuid',
      status: 'accepted',
    }),
    MATCHES_ACCEPTED_TARGET
  )
})
