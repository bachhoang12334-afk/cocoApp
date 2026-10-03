export const REQUIRED_PROFILE_FIELDS = [
  { key: 'fullName', aliases: ['fullName', 'full_name'], label: 'Họ và tên' },
  { key: 'university', aliases: ['university'], label: 'Trường đại học' },
  { key: 'major', aliases: ['major'], label: 'Ngành học' },
  { key: 'studyYear', aliases: ['studyYear', 'study_year'], label: 'Năm học' },
  { key: 'gender', aliases: ['gender'], label: 'Giới tính' },
  { key: 'purpose', aliases: ['purpose'], label: 'Mục tiêu kết nối' },
  { key: 'city', aliases: ['city'], label: 'Tỉnh / Thành phố' },
  { key: 'area', aliases: ['area'], label: 'Khu vực gần đúng' },
  { key: 'proximityScope', aliases: ['proximityScope', 'proximity_scope'], label: 'Phạm vi tìm kiếm' },
]

const OPTIONAL_PROFILE_FIELDS = [
  { aliases: ['bio'] },
  { aliases: ['publicLocation', 'public_location'] },
  { aliases: ['availabilitySlots', 'availability_slots'] },
  { aliases: ['collaborationStyle', 'collaboration_style'] },
  { aliases: ['commitmentLevel', 'commitment_level'] },
]

const VALID_VALUES = {
  studyYear: new Set(['Năm 1', 'Năm 2', 'Năm 3', 'Năm 4', 'Khác']),
  gender: new Set(['Nam', 'Nữ', 'Khác', 'Không muốn công khai']),
  purpose: new Set(['Học nhóm', 'Team Project', 'Ghép trọ']),
  proximityScope: new Set(['same_area', 'same_city', 'anywhere']),
}

export const PURPOSE_DESTINATIONS = {
  'Học nhóm': '/study',
  'Team Project': '/team',
  'Ghép trọ': '/roommates',
}

function readValue(profile, aliases) {
  for (const alias of aliases) {
    if (profile?.[alias] !== undefined && profile?.[alias] !== null) {
      return profile[alias]
    }
  }

  return ''
}

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0
  return typeof value === 'string' ? value.trim() !== '' : value !== null && value !== undefined
}

function isRequiredFieldReady(profile, field) {
  const value = readValue(profile, field.aliases)
  if (!hasValue(value)) return false

  const allowedValues = VALID_VALUES[field.key]
  return !allowedValues || allowedValues.has(String(value).trim())
}

export function getProfileReadiness(profile) {
  const missingFields = REQUIRED_PROFILE_FIELDS.filter(
    (field) => !isRequiredFieldReady(profile, field)
  )
  const completedRequired = REQUIRED_PROFILE_FIELDS.length - missingFields.length
  const completionFields = [...REQUIRED_PROFILE_FIELDS, ...OPTIONAL_PROFILE_FIELDS]
  const completedFields = completionFields.filter((field) => (
    field.key
      ? isRequiredFieldReady(profile, field)
      : hasValue(readValue(profile, field.aliases))
  )).length

  return {
    isReady: missingFields.length === 0,
    missingFields,
    missingKeys: missingFields.map((field) => field.key),
    missingLabels: missingFields.map((field) => field.label),
    completedRequired,
    requiredTotal: REQUIRED_PROFILE_FIELDS.length,
    completionPercent: Math.round((completedFields / completionFields.length) * 100),
  }
}

export function getPurposeDestination(purpose) {
  return PURPOSE_DESTINATIONS[String(purpose || '').trim()] || '/discover'
}
