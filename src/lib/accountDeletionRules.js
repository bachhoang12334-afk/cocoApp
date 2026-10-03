export const ACCOUNT_DELETION_CONFIRMATION = 'XOA TAI KHOAN'

export function normalizeAccountDeletionConfirmation(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleUpperCase('vi-VN')
}

export function isAccountDeletionConfirmed(value) {
  return normalizeAccountDeletionConfirmation(value) === ACCOUNT_DELETION_CONFIRMATION
}

export function getAccountDeletionErrorMessage(error) {
  const message = String(error?.message || '').toLowerCase()

  if (message.includes('unauthorized') || message.includes('jwt')) {
    return 'Phiên đăng nhập đã hết. Hãy đăng nhập lại trước khi xoá tài khoản.'
  }

  if (message.includes('fetch') || message.includes('network')) {
    return 'Không kết nối được tới máy chủ. Tài khoản chưa bị xoá; hãy kiểm tra mạng và thử lại.'
  }

  return 'Chưa thể xoá tài khoản. Dữ liệu vẫn được giữ nguyên; hãy thử lại sau.'
}
