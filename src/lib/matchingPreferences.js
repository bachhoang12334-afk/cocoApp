export const AVAILABILITY_OPTIONS = [
  { value: 'weekday_morning', label: 'Sáng trong tuần', shortLabel: 'Sáng T2–T6' },
  { value: 'weekday_afternoon', label: 'Chiều trong tuần', shortLabel: 'Chiều T2–T6' },
  { value: 'weekday_evening', label: 'Tối trong tuần', shortLabel: 'Tối T2–T6' },
  { value: 'weekend_morning', label: 'Sáng cuối tuần', shortLabel: 'Sáng cuối tuần' },
  { value: 'weekend_afternoon', label: 'Chiều cuối tuần', shortLabel: 'Chiều cuối tuần' },
  { value: 'weekend_evening', label: 'Tối cuối tuần', shortLabel: 'Tối cuối tuần' },
]

export const COLLABORATION_STYLE_OPTIONS = [
  {
    value: 'structured',
    label: 'Có kế hoạch rõ ràng',
    description: 'Thống nhất đầu việc và mốc hoàn thành trước khi bắt đầu.',
  },
  {
    value: 'flexible',
    label: 'Linh hoạt theo tiến độ',
    description: 'Điều chỉnh cách làm khi lịch học hoặc ưu tiên thay đổi.',
  },
  {
    value: 'focused',
    label: 'Tập trung, ít họp',
    description: 'Ưu tiên thời gian tự làm và trao đổi ngắn gọn khi cần.',
  },
  {
    value: 'collaborative',
    label: 'Trao đổi thường xuyên',
    description: 'Cập nhật tiến độ và cùng thảo luận trong quá trình làm.',
  },
]

export const COMMITMENT_LEVEL_OPTIONS = [
  {
    value: 'light',
    label: 'Nhẹ nhàng',
    description: 'Khoảng 1–2 giờ mỗi tuần.',
  },
  {
    value: 'steady',
    label: 'Đều đặn',
    description: 'Khoảng 3–5 giờ mỗi tuần.',
  },
  {
    value: 'intensive',
    label: 'Tập trung cao',
    description: 'Khoảng 6 giờ trở lên mỗi tuần.',
  },
]

const availabilityValues = new Set(AVAILABILITY_OPTIONS.map((option) => option.value))

export function normalizeAvailabilitySlots(value) {
  if (!Array.isArray(value)) return []

  return [...new Set(value.filter((slot) => availabilityValues.has(slot)))]
}

export function getPreferenceOption(options, value) {
  return options.find((option) => option.value === value) || null
}

export function getAvailabilityLabel(value, { short = false } = {}) {
  const option = getPreferenceOption(AVAILABILITY_OPTIONS, value)
  return option ? (short ? option.shortLabel : option.label) : ''
}
