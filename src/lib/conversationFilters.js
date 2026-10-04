const searchableConversationFields = [
  'name',
  'major',
  'purpose',
  'location',
  'city',
  'area',
]

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
