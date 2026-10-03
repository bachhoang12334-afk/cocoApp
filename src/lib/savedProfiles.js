export function normalizeSavedProfileIds(rows) {
  if (!Array.isArray(rows)) return []

  return [...new Set(
    rows
      .map((row) => row?.saved_profile_id)
      .filter((profileId) => typeof profileId === 'string' && profileId.trim())
  )]
}

export function updateSavedProfileIds(profileIds, profileId, shouldSave) {
  const normalizedIds = [...new Set(
    (Array.isArray(profileIds) ? profileIds : [])
      .filter((value) => typeof value === 'string' && value.trim())
  )]

  if (typeof profileId !== 'string' || !profileId.trim()) return normalizedIds

  if (shouldSave) {
    return normalizedIds.includes(profileId)
      ? normalizedIds
      : [...normalizedIds, profileId]
  }

  return normalizedIds.filter((value) => value !== profileId)
}

export function getSavedProfileErrorMessage(error) {
  const message = error?.message?.toLowerCase() || ''

  if (message.includes('saved_profile_not_ready')) {
    return 'Hồ sơ này hiện chưa đủ thông tin để lưu. Hãy làm mới danh sách.'
  }

  if (message.includes('saved_profile_blocked')) {
    return 'Không thể lưu hồ sơ này do cài đặt an toàn giữa hai tài khoản.'
  }

  if (message.includes('saved_profile_owner_mismatch')) {
    return 'Phiên đăng nhập không khớp. Hãy đăng nhập lại rồi thử tiếp.'
  }

  if (error?.code === '42P01' || error?.code === 'PGRST205') {
    return 'Mục Đã lưu chưa được bật trên Supabase. Các tính năng Khám phá khác vẫn hoạt động.'
  }

  return 'Chưa cập nhật được mục Đã lưu. Hãy thử lại sau.'
}
