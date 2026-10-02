import { getNotificationTarget } from './notificationNavigation.js'

export const MATCHES_PENDING_TARGET = '/matches?focus=pending'
export const MATCHES_ACCEPTED_TARGET = '/matches?focus=accepted'

export function parseMatchesOverviewTarget(search) {
  const params = new URLSearchParams(search || '')
  const keys = [...params.keys()]
  const focusValues = params.getAll('focus')

  if (keys.some((key) => key !== 'focus') || focusValues.length !== 1) return null

  return focusValues[0] === 'pending' || focusValues[0] === 'accepted'
    ? focusValues[0]
    : null
}

export function getGuestRouteRedirect({ isAuthenticated, isCheckingSession }) {
  if (isCheckingSession || !isAuthenticated) return null
  return '/dashboard'
}

export function getPostRegistrationNavigation({
  requiresEmailConfirmation,
  isAuthenticated,
  email,
}) {
  if (isAuthenticated) {
    return {
      to: '/dashboard',
      options: { replace: true },
    }
  }

  return {
    to: '/login',
    options: {
      replace: true,
      state: {
        registered: true,
        requiresEmailConfirmation: Boolean(requiresEmailConfirmation),
        email: String(email || '').trim().toLowerCase(),
      },
    },
  }
}

export function getDashboardConnectionTarget(connection) {
  if (connection?.status === 'accepted') {
    const target = getNotificationTarget({
      type: 'request_accepted',
      connection_request_id: connection.id,
    })

    return target === '/matches' ? MATCHES_ACCEPTED_TARGET : target
  }

  if (connection?.status === 'pending' && connection.isIncoming) {
    const target = getNotificationTarget({
      type: 'request_received',
      connection_request_id: connection.id,
    })

    return target === '/matches' ? MATCHES_PENDING_TARGET : target
  }

  return connection?.status === 'pending'
    ? MATCHES_PENDING_TARGET
    : '/matches'
}
