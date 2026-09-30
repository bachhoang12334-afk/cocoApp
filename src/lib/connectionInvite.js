export const CONNECTION_INVITE_MIN_LENGTH = 8
export const CONNECTION_INVITE_MAX_LENGTH = 240

const templatesByPurpose = {
  'Học nhóm': [
    'Chào cậu, mình thấy chúng ta cùng mục tiêu học nhóm. Cậu có muốn trao đổi môn học và lịch phù hợp không?',
    'Chào cậu, mình đang tìm bạn cùng ôn tập đều đặn. Nếu phù hợp, mình cùng thống nhất cách học nhé.',
  ],
  'Team Project': [
    'Chào cậu, mình đang tìm đồng đội cho một dự án. Mình muốn trao đổi thêm về kỹ năng và vai trò của hai bên.',
    'Chào cậu, hồ sơ của cậu khá phù hợp với team mình đang tìm. Cậu có muốn cùng trao đổi mục tiêu dự án không?',
  ],
  'Ghép trọ': [
    'Chào cậu, mình muốn trao đổi thêm về khu vực, ngân sách và thời gian ghép trọ. Nếu phù hợp mình cùng nói chuyện nhé.',
    'Chào cậu, mình đang tìm người ghép trọ cùng khu vực. Mình muốn hỏi thêm về thời gian ở và thói quen sinh hoạt.',
  ],
}

const fallbackTemplates = [
  'Chào cậu, mình thấy hồ sơ của cậu phù hợp với điều mình đang tìm. Cậu có muốn trao đổi thêm không?',
  'Chào cậu, mình muốn kết nối để tìm hiểu xem hai bên có thể hỗ trợ nhau như thế nào.',
]

export function getConnectionInviteTemplates(purpose) {
  return templatesByPurpose[purpose] || fallbackTemplates
}

export function normalizeConnectionInvite(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ')
}

export function getConnectionInviteError(value) {
  const message = normalizeConnectionInvite(value)

  if (message.length < CONNECTION_INVITE_MIN_LENGTH) {
    return `Lời nhắn cần ít nhất ${CONNECTION_INVITE_MIN_LENGTH} ký tự.`
  }

  if (message.length > CONNECTION_INVITE_MAX_LENGTH) {
    return `Lời nhắn không được vượt quá ${CONNECTION_INVITE_MAX_LENGTH} ký tự.`
  }

  return ''
}
