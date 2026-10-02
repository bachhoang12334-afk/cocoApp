const COCO_PLAN_NOTIFICATION_TYPES = new Set([
  'plan_proposed',
  'plan_accepted',
  'plan_declined',
  'plan_cancelled',
  'plan_completed',
])

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeUuid(value) {
  if (typeof value !== 'string') return null

  const normalized = value.trim()
  return UUID_PATTERN.test(normalized) ? normalized : null
}

export function isCocoPlanNotification(notification) {
  return COCO_PLAN_NOTIFICATION_TYPES.has(notification?.type)
}

export function getNotificationTarget(notification) {
  if (!isCocoPlanNotification(notification)) return '/matches'

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

export function parseCocoPlanDeepLink(search) {
  const params = new URLSearchParams(search || '')
  if (params.get('focus') !== 'plan') return null

  const connectionId = normalizeUuid(params.get('connection'))
  const planId = normalizeUuid(params.get('plan'))
  if (!connectionId || !planId) return null

  return { connectionId, planId }
}
