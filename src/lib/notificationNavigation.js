const COCO_PLAN_NOTIFICATION_TYPES = new Set([
  'plan_proposed',
  'plan_accepted',
  'plan_declined',
  'plan_cancelled',
  'plan_completed',
])

const CONNECTION_NOTIFICATION_TYPES = new Set([
  'request_received',
  'request_accepted',
  'request_declined',
  'request_cancelled',
  'connection_disconnected',
])

const TERMINAL_CONNECTION_TARGETS = {
  request_declined: 'pending',
  request_cancelled: 'pending',
  connection_disconnected: 'accepted',
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeUuid(value) {
  if (typeof value !== 'string') return null

  const normalized = value.trim()
  return UUID_PATTERN.test(normalized) ? normalized : null
}

function getSingleSearchParam(params, name) {
  const values = params.getAll(name)
  return values.length === 1 ? values[0] : null
}

export function isCocoPlanNotification(notification) {
  return COCO_PLAN_NOTIFICATION_TYPES.has(notification?.type)
}

export function isConnectionNotification(notification) {
  return CONNECTION_NOTIFICATION_TYPES.has(notification?.type)
}

export function getNotificationTarget(notification) {
  if (isCocoPlanNotification(notification)) {
    const connectionId = normalizeUuid(notification?.connection_request_id)
    const planId = normalizeUuid(notification?.connection_plan_id)
    if (!connectionId || !planId) return '/matches'

    const params = new URLSearchParams({
      connection: connectionId,
      plan: planId,
      focus: 'plan',
    })

    return `/matches?${params.toString()}`
  }

  if (!isConnectionNotification(notification)) return '/matches'

  const connectionId = normalizeUuid(notification?.connection_request_id)
  if (!connectionId) return '/matches'

  if (notification.type === 'request_received') {
    const params = new URLSearchParams({
      connection: connectionId,
      focus: 'pending',
    })
    return `/matches?${params.toString()}`
  }

  if (notification.type === 'request_accepted') {
    const params = new URLSearchParams({
      connection: connectionId,
      focus: 'conversation',
    })
    return `/matches?${params.toString()}`
  }

  const params = new URLSearchParams({
    focus: TERMINAL_CONNECTION_TARGETS[notification.type],
    event: notification.type,
  })
  return `/matches?${params.toString()}`
}

export function parseCocoPlanDeepLink(search) {
  const params = new URLSearchParams(search || '')
  if (params.get('focus') !== 'plan') return null

  const connectionId = normalizeUuid(params.get('connection'))
  const planId = normalizeUuid(params.get('plan'))
  if (!connectionId || !planId) return null

  return { connectionId, planId }
}

export function parseConnectionNotificationDeepLink(search) {
  const params = new URLSearchParams(search || '')
  const focus = getSingleSearchParam(params, 'focus')
  const rawConnectionId = getSingleSearchParam(params, 'connection')
  const notificationType = getSingleSearchParam(params, 'event')

  if (focus === 'pending' && rawConnectionId !== null && notificationType === null) {
    const connectionId = normalizeUuid(rawConnectionId)
    return connectionId
      ? { kind: 'pending-request', tab: 'pending', connectionId }
      : null
  }

  if (focus === 'conversation' && rawConnectionId !== null && notificationType === null) {
    const connectionId = normalizeUuid(rawConnectionId)
    return connectionId
      ? { kind: 'accepted-conversation', tab: 'accepted', connectionId }
      : null
  }

  if (rawConnectionId !== null || notificationType === null) return null

  const expectedTab = TERMINAL_CONNECTION_TARGETS[notificationType]
  if (!expectedTab || focus !== expectedTab) return null

  return {
    kind: 'terminal-event',
    tab: expectedTab,
    notificationType,
  }
}
