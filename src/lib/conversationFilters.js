const searchableConversationFields = [
  'name',
  'major',
  'purpose',
  'location',
  'city',
  'area',
]

function parseConversationDate(value) {
  const date = new Date(value || '')
  return Number.isNaN(date.getTime()) ? null : date
}

export function getConversationActivityDate(conversation) {
  const messages = Array.isArray(conversation?.messages) ? conversation.messages : []
  const latestMessage = messages[messages.length - 1]

  return parseConversationDate(latestMessage?.createdAt)
    || parseConversationDate(conversation?.respondedAt)
    || parseConversationDate(conversation?.createdAt)
}

export function normalizeConversationSearch(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('vi-VN')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
}

export function filterConversations(
  conversations,
  { query = '', unreadOnly = false } = {}
) {
  const normalizedQuery = normalizeConversationSearch(query)
  const queryTokens = normalizedQuery ? normalizedQuery.split(' ') : []

  return (Array.isArray(conversations) ? conversations : []).filter((conversation) => {
    if (unreadOnly && Number(conversation?.unreadCount || 0) <= 0) return false
    if (queryTokens.length === 0) return true

    const searchableText = normalizeConversationSearch(
      searchableConversationFields
        .map((field) => conversation?.[field])
        .filter(Boolean)
        .join(' ')
    )

    return queryTokens.every((token) => searchableText.includes(token))
  })
}

export function sortConversationsByActivity(conversations) {
  return (Array.isArray(conversations) ? conversations : [])
    .map((conversation, sourceIndex) => ({
      conversation,
      sourceIndex,
      activityTime: getConversationActivityDate(conversation)?.getTime() || 0,
    }))
    .sort((left, right) => (
      right.activityTime - left.activityTime
      || left.sourceIndex - right.sourceIndex
    ))
    .map(({ conversation }) => conversation)
}

export function formatConversationActivityTime(conversation, now = Date.now()) {
  const activityDate = getConversationActivityDate(conversation)
  const nowDate = new Date(now)
  if (!activityDate || Number.isNaN(nowDate.getTime())) return ''

  const elapsedMs = Math.max(0, nowDate.getTime() - activityDate.getTime())
  const elapsedMinutes = Math.floor(elapsedMs / 60_000)

  if (elapsedMinutes < 1) return 'Vừa xong'
  if (elapsedMinutes < 60) return `${elapsedMinutes} phút`

  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) return `${elapsedHours} giờ`

  const elapsedDays = Math.floor(elapsedHours / 24)
  if (elapsedDays < 7) return `${elapsedDays} ngày`

  const options = activityDate.getFullYear() === nowDate.getFullYear()
    ? { day: '2-digit', month: '2-digit' }
    : { day: '2-digit', month: '2-digit', year: 'numeric' }

  return new Intl.DateTimeFormat('vi-VN', options).format(activityDate)
}
