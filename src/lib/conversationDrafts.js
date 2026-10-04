export const CONVERSATION_DRAFT_MAX_LENGTH = 1000

const conversationDraftKeyPrefix = 'cocoapp:conversation-draft:v1'

function normalizeIdentifier(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function getConversationDraftKey({ userId, connectionRequestId }) {
  const normalizedUserId = normalizeIdentifier(userId)
  const normalizedConnectionRequestId = normalizeIdentifier(connectionRequestId)

  if (!normalizedUserId || !normalizedConnectionRequestId) return null

  return `${conversationDraftKeyPrefix}:${normalizedUserId}:${normalizedConnectionRequestId}`
}

export function readConversationDraft(storage, identifiers) {
  const key = getConversationDraftKey(identifiers)
  if (!key || !storage) return ''

  try {
    const value = storage.getItem(key)
    return typeof value === 'string'
      ? value.slice(0, CONVERSATION_DRAFT_MAX_LENGTH)
      : ''
  } catch {
    return ''
  }
}

export function saveConversationDraft(storage, identifiers, draft) {
  const key = getConversationDraftKey(identifiers)
  if (!key || !storage || typeof draft !== 'string') return false

  try {
    const nextDraft = draft.slice(0, CONVERSATION_DRAFT_MAX_LENGTH)

    if (!nextDraft.trim()) {
      storage.removeItem(key)
    } else {
      storage.setItem(key, nextDraft)
    }

    return true
  } catch {
    return false
  }
}

export function clearConversationDraft(storage, identifiers) {
  const key = getConversationDraftKey(identifiers)
  if (!key || !storage) return false

  try {
    storage.removeItem(key)
    return true
  } catch {
    return false
  }
}
