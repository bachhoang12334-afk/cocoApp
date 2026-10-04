export const ACCOUNT_EXPORT_SCHEMA_VERSION = 1

export function createAccountExportFilename(exportedAt = new Date()) {
  const date = exportedAt instanceof Date ? exportedAt : new Date(exportedAt)

  if (Number.isNaN(date.getTime())) {
    throw new TypeError('A valid export date is required.')
  }

  return `coco-du-lieu-${date.toISOString().slice(0, 10)}.json`
}

export function createAccountExportPayload({ account, data, exportedAt = new Date() }) {
  const date = exportedAt instanceof Date ? exportedAt : new Date(exportedAt)

  if (Number.isNaN(date.getTime())) {
    throw new TypeError('A valid export date is required.')
  }

  return {
    schemaVersion: ACCOUNT_EXPORT_SCHEMA_VERSION,
    exportedAt: date.toISOString(),
    account: {
      id: account?.id || null,
      email: account?.email || null,
      createdAt: account?.createdAt || null,
      emailConfirmedAt: account?.emailConfirmedAt || null,
      lastSignInAt: account?.lastSignInAt || null,
    },
    data: {
      profile: data?.profile || null,
      privateProfile: data?.privateProfile || null,
      connections: Array.isArray(data?.connections) ? data.connections : [],
      messages: Array.isArray(data?.messages) ? data.messages : [],
      plans: Array.isArray(data?.plans) ? data.plans : [],
      notifications: Array.isArray(data?.notifications) ? data.notifications : [],
      savedProfiles: Array.isArray(data?.savedProfiles) ? data.savedProfiles : [],
      blockedProfiles: Array.isArray(data?.blockedProfiles) ? data.blockedProfiles : [],
      safetyReports: Array.isArray(data?.safetyReports) ? data.safetyReports : [],
    },
  }
}

export function serializeAccountExport(payload) {
  return `${JSON.stringify(payload, null, 2)}\n`
}

export function getAccountExportErrorMessage(error) {
  const message = String(error?.message || '').toLowerCase()

  if (message.includes('unauthorized') || message.includes('jwt') || message.includes('session')) {
    return 'Phiên đăng nhập đã hết. Hãy đăng nhập lại trước khi tải dữ liệu.'
  }

  if (message.includes('fetch') || message.includes('network')) {
    return 'Không kết nối được tới máy chủ. Chưa có tệp nào được tải xuống.'
  }

  return 'Chưa thể chuẩn bị bản sao dữ liệu. Chưa có tệp nào được tải xuống; hãy thử lại sau.'
}
