export const TYPING_HEARTBEAT_MS = 1200
export const TYPING_IDLE_MS = 1800
export const TYPING_EVENT_MAX_AGE_MS = 10000

export function createTypingPayload({ connectionRequestId, senderId, isTyping, sentAt = Date.now() }) {
  return {
    connectionRequestId: String(connectionRequestId || ''),
    senderId: String(senderId || ''),
    isTyping: isTyping === true,
    sentAt: Number(sentAt),
  }
}

export function isTypingEventForConversation(
  payload,
  { connectionRequestId, currentUserId, now = Date.now() }
) {
  if (!payload || typeof payload !== 'object') return false
  if (payload.connectionRequestId !== connectionRequestId) return false
  if (!payload.senderId || payload.senderId === currentUserId) return false
  if (typeof payload.isTyping !== 'boolean') return false

  const sentAt = Number(payload.sentAt)
  const referenceTime = Number(now)

  return Number.isFinite(sentAt)
    && Number.isFinite(referenceTime)
    && Math.abs(referenceTime - sentAt) <= TYPING_EVENT_MAX_AGE_MS
}
