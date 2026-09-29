export const RECOVERY_SESSION_KEY = 'cocoapp.password-recovery.active'

export function normalizeAndValidateEmail(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase()

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('Email chưa đúng định dạng.')
  }

  return normalizedEmail
}

export function getNewPasswordErrors(password, confirmPassword) {
  const errors = {}

  if (!password) {
    errors.password = 'Hãy nhập mật khẩu mới.'
  } else if (password.length < 6 || !password.trim()) {
    errors.password = 'Mật khẩu cần ít nhất 6 ký tự, không chỉ là dấu cách.'
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Hãy nhập lại mật khẩu mới.'
  } else if (password && password !== confirmPassword) {
    errors.confirmPassword = 'Hai ô mật khẩu chưa giống nhau.'
  }

  return errors
}

export function isPasswordRecoveryRedirect(href) {
  try {
    const currentUrl = new URL(href)
    const hashParams = new URLSearchParams(currentUrl.hash.slice(1))

    return (
      hashParams.get('type') === 'recovery'
      || currentUrl.searchParams.has('code')
    )
  } catch {
    return false
  }
}
