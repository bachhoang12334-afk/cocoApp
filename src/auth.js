import { supabase } from './lib/supabaseClient'
import { normalizeAndValidateEmail } from './lib/authSecurity'

function getVietnameseAuthError(error) {
  const message = error?.message?.toLowerCase() || ''

  if (message.includes('invalid login credentials')) {
    return new Error('Email hoặc mật khẩu chưa đúng.')
  }

  if (message.includes('user already registered')) {
    return new Error('Email này đã đăng ký. Hãy chuyển sang đăng nhập.')
  }

  if (message.includes('email not confirmed')) {
    return new Error('Email chưa được xác nhận. Hãy kiểm tra hộp thư của cậu.')
  }

  if (message.includes('password should be at least')) {
    return new Error('Mật khẩu cần ít nhất 6 ký tự.')
  }

  if (
    message.includes('rate limit')
    || message.includes('email rate limit')
    || message.includes('security purposes')
  ) {
    return new Error('Cậu thao tác hơi nhanh. Hãy đợi một lúc rồi thử lại.')
  }

  if (
    message.includes('expired')
    || message.includes('invalid token')
    || message.includes('session missing')
  ) {
    return new Error('Liên kết đã hết hạn hoặc không hợp lệ. Hãy yêu cầu email mới.')
  }

  if (message.includes('same password')) {
    return new Error('Mật khẩu mới cần khác mật khẩu đang dùng.')
  }

  if (message.includes('fetch') || message.includes('network')) {
    return new Error('Không kết nối được tới máy chủ. Hãy kiểm tra mạng và thử lại.')
  }

  return new Error('Đã xảy ra lỗi xác thực. Hãy thử lại sau.')
}

export async function registerAccount({
  fullName,
  email,
  university,
  password,
}) {
  const normalizedEmail = normalizeAndValidateEmail(email)

  if (!fullName.trim() || !university.trim()) {
    throw new Error('Hãy nhập họ tên và trường đại học.')
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('Email chưa đúng định dạng.')
  }

  if (password.length < 6 || !password.trim()) {
    throw new Error('Mật khẩu cần ít nhất 6 ký tự, không chỉ là dấu cách.')
  }

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: {
        fullName: fullName.trim(),
        university: university.trim(),
      },
    },
  })

  if (error) throw getVietnameseAuthError(error)

  return {
    requiresEmailConfirmation: Boolean(data.user && !data.session),
  }
}

export async function loginAccount(email, password) {
  const normalizedEmail = normalizeAndValidateEmail(email)

  const { error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  })

  if (error) throw getVietnameseAuthError(error)
}

export async function requestPasswordReset(email, redirectTo) {
  const normalizedEmail = normalizeAndValidateEmail(email)
  const { error } = await supabase.auth.resetPasswordForEmail(
    normalizedEmail,
    { redirectTo }
  )

  if (error) throw getVietnameseAuthError(error)
}

export async function resendSignupConfirmation(email, redirectTo) {
  const normalizedEmail = normalizeAndValidateEmail(email)
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: normalizedEmail,
    options: { emailRedirectTo: redirectTo },
  })

  if (error) throw getVietnameseAuthError(error)
}

export async function updateAccountPassword(password) {
  if (password.length < 6 || !password.trim()) {
    throw new Error('Mật khẩu cần ít nhất 6 ký tự, không chỉ là dấu cách.')
  }

  const { data, error } = await supabase.auth.getSession()

  if (error) throw getVietnameseAuthError(error)
  if (!data.session) {
    throw new Error('Liên kết đã hết hạn hoặc không hợp lệ. Hãy yêu cầu email mới.')
  }

  const { error: updateError } = await supabase.auth.updateUser({ password })

  if (updateError) throw getVietnameseAuthError(updateError)

  const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' })

  if (signOutError) throw getVietnameseAuthError(signOutError)
}

export async function getCurrentAccount() {
  const { data, error } = await supabase.auth.getSession()

  if (error) throw getVietnameseAuthError(error)

  return data.session?.user || null
}

export function subscribeToAuthState(callback) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user || null, event)
  })

  return () => data.subscription.unsubscribe()
}

export async function logoutAccount() {
  const { error } = await supabase.auth.signOut()

  if (error) throw getVietnameseAuthError(error)
}
