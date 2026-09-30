const trustSignals = {
  verified: {
    key: 'verified',
    label: 'Sinh viên đã xác minh',
    description: 'Coco đã hoàn tất bước xác minh sinh viên cho tài khoản này.',
  },
  education: {
    key: 'education',
    label: 'Email trường đã xác nhận',
    description: 'Email thuộc tên miền giáo dục và đã được xác nhận. Đây chưa phải là xác minh danh tính sinh viên.',
  },
  confirmed: {
    key: 'confirmed',
    label: 'Email đã xác nhận',
    description: 'Email đăng ký đã được xác nhận. Đây chưa phải là xác minh danh tính sinh viên.',
  },
  unconfirmed: {
    key: 'unconfirmed',
    label: 'Email chưa xác nhận',
    description: 'Email đăng ký chưa được xác nhận và tài khoản chưa có tín hiệu xác minh.',
  },
}

export function getTrustSignal(profile = {}) {
  if (profile.verification_status === 'verified') return trustSignals.verified
  if (profile.education_email === true) return trustSignals.education
  if (profile.email_confirmed === true) return trustSignals.confirmed
  return trustSignals.unconfirmed
}
