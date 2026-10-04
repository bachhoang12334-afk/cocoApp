const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const RELATIVE_DAY_LIMIT = 7

export const NOTIFICATION_FILTER_ALL = 'all'
export const NOTIFICATION_FILTER_UNREAD = 'unread'

export function filterNotifications(notifications, filter) {
  const source = Array.isArray(notifications) ? notifications : []

  if (filter === NOTIFICATION_FILTER_UNREAD) {
    return source.filter((notification) => notification?.read_at === null)
  }

  return [...source]
}

export function formatNotificationTime(value, now = Date.now()) {
  const date = new Date(value)
  const referenceTime = Number(now)

  if (Number.isNaN(date.getTime()) || !Number.isFinite(referenceTime)) return ''

  const elapsed = Math.max(0, referenceTime - date.getTime())

  if (elapsed < MINUTE_MS) return 'Vừa xong'
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)} phút trước`
  if (elapsed < DAY_MS) return `${Math.floor(elapsed / HOUR_MS)} giờ trước`
  if (elapsed < RELATIVE_DAY_LIMIT * DAY_MS) {
    return `${Math.floor(elapsed / DAY_MS)} ngày trước`
  }

  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}
