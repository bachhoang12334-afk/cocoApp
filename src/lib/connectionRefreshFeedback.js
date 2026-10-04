function normalizedErrorMessage(error) {
  return typeof error?.message === 'string' ? error.message.toLowerCase() : ''
}

function isPermissionError(message) {
  return message.includes('row-level security')
    || message.includes('permission')
    || message.includes('not authorized')
}

function isSessionError(message) {
  return message.includes('phiên đăng nhập')
    || message.includes('jwt')
    || message.includes('session')
}

function isNetworkError(message) {
  return message.includes('fetch')
    || message.includes('network')
    || message.includes('offline')
    || message.includes('timeout')
}

export function getConnectionLoadErrorMessage(error) {
  const message = normalizedErrorMessage(error)

  if (isSessionError(message)) {
    return 'Phiên đăng nhập có thể đã hết. Hãy đăng nhập lại để tải kết nối.'
  }

  if (isPermissionError(message)) {
    return 'Không thể tải lời mời do quyền truy cập. Hãy đăng nhập lại.'
  }

  return 'Không thể tải danh sách kết nối. Hãy thử lại sau.'
}

export function getConnectionRefreshWarning(error) {
  const message = normalizedErrorMessage(error)

  if (isSessionError(message) || isPermissionError(message)) {
    return 'Danh sách gần nhất vẫn được giữ. Hãy đăng nhập lại để tiếp tục đồng bộ.'
  }

  if (isNetworkError(message)) {
    return 'Danh sách gần nhất vẫn được giữ. Coco sẽ thử lại khi thiết bị có mạng.'
  }

  return 'Danh sách gần nhất vẫn được giữ. Cậu có thể thử đồng bộ lại.'
}
