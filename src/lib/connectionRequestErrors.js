export function getConnectionRequestErrorMessage(error) {
  const message = error?.message?.toLowerCase() || ''

  if (message.includes('connection_request_recipient_cooldown')) {
    return 'Giữa hai tài khoản vừa có một lời mời đã đóng. Hãy chờ 60 phút trước khi gửi lại.'
  }

  if (message.includes('connection_request_rate_limit_short_window')) {
    return 'Cậu đã gửi nhiều lời mời trong thời gian ngắn. Hãy chờ ít phút rồi thử lại.'
  }

  if (message.includes('connection_request_rate_limit_daily')) {
    return 'Cậu đã đạt giới hạn 20 lời mời trong 24 giờ. Hãy thử lại sau.'
  }

  if (message.includes('roommate requests require matching genders')) {
    return 'Không thể gửi lời mời ghép trọ vì hai hồ sơ chưa cùng giới tính.'
  }

  if (error?.code === '23505') {
    return 'Đã có lời mời đang chờ hoặc kết nối giữa hai tài khoản.'
  }

  if (message.includes('users cannot connect while blocked')) {
    return 'Không thể kết nối với tài khoản này do cài đặt an toàn.'
  }

  if (message.includes('connection request intro')) {
    return 'Lời nhắn cần có từ 8 đến 240 ký tự và không thể để trống.'
  }

  if (message.includes('connection_profile_not_ready')) {
    return 'Một trong hai hồ sơ chưa đủ thông tin để kết nối. Hãy làm mới danh sách và thử lại.'
  }

  if (message.includes('connection_requests_paused')) {
    return 'Một trong hai tài khoản đang tạm dừng kết nối mới. Hãy làm mới danh sách.'
  }

  return 'Chưa gửi được lời mời. Hãy thử lại sau.'
}
