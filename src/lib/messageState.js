export const MESSAGE_PAGE_SIZE = 50

const messageTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  hour: '2-digit',
  minute: '2-digit',
})

const messageDateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
})

const messageDateWithYearFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

function isSameLocalDay(first, second) {
  return first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth()
    && first.getDate() === second.getDate()
}

export function mapMessage(message, userId) {
  return {
    id: message.id,
    sender: message.sender_id === userId ? 'me' : 'other',
    text: message.body,
    createdAt: message.created_at,
    readAt: message.read_at,
  }
}

export function getUnreadMessageCount(connection) {
  if (Number.isInteger(connection.unreadCount)) {
    return Math.max(0, connection.unreadCount)
  }

  return connection.messages.filter(
    (message) => message.sender === 'other' && message.readAt === null
  ).length
}

export function formatMessageTimestamp(value, now = new Date()) {
  const timestamp = new Date(value)
  const reference = now instanceof Date ? now : new Date(now)

  if (Number.isNaN(timestamp.getTime()) || Number.isNaN(reference.getTime())) {
    return ''
  }

  const time = messageTimeFormatter.format(timestamp)
  if (isSameLocalDay(timestamp, reference)) return time

  const date = timestamp.getFullYear() === reference.getFullYear()
    ? messageDateFormatter.format(timestamp)
    : messageDateWithYearFormatter.format(timestamp)

  return `${date} · ${time}`
}

export function getLatestOwnMessageId(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].sender === 'me') return messages[index].id
  }

  return null
}

export function getMessageDeliveryLabel(message, latestOwnMessageId) {
  if (message.sender !== 'me' || message.id !== latestOwnMessageId) return ''
  return message.readAt ? 'Đã đọc' : 'Đã gửi'
}

export function mergeMessages(serverMessages, currentMessages) {
  const byId = new Map()

  for (const message of [...serverMessages, ...currentMessages]) {
    const existing = byId.get(message.id)
    byId.set(message.id, {
      ...existing,
      ...message,
      readAt: existing?.readAt || message.readAt,
    })
  }

  return [...byId.values()].sort((first, second) => {
    const timeDifference = new Date(first.createdAt) - new Date(second.createdAt)
    return timeDifference || first.id.localeCompare(second.id)
  })
}

export function applyReadReceipts(connections, receipts) {
  if (receipts.length === 0) return connections

  const readAtById = new Map(
    receipts.map((receipt) => [receipt.id, receipt.read_at])
  )

  return connections.map((connection) => {
    const receiptCount = receipts.filter((receipt) => (
      connection.messages.some((message) => (
        message.id === receipt.id && message.readAt === null
      ))
    )).length

    return {
      ...connection,
      unreadCount: Number.isInteger(connection.unreadCount)
        ? Math.max(0, connection.unreadCount - receiptCount)
        : connection.unreadCount,
      messages: connection.messages.map((message) => (
        readAtById.has(message.id)
          ? { ...message, readAt: readAtById.get(message.id) }
          : message
      )),
    }
  })
}

export function normalizeMessagePage(
  rows,
  userId,
  pageSize = MESSAGE_PAGE_SIZE
) {
  const pageRows = rows.slice(0, pageSize)

  return {
    messages: pageRows.map((message) => mapMessage(message, userId)).reverse(),
    hasOlder: rows.length > pageSize,
  }
}
