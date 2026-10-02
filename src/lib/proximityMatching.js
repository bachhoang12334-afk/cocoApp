export const PROXIMITY_SCOPE_OPTIONS = [
  {
    value: 'same_area',
    label: 'Cùng khu vực',
    description: 'Chỉ hiển thị hồ sơ có cùng tỉnh/thành phố và khu vực đã lưu.',
  },
  {
    value: 'same_city',
    label: 'Cùng tỉnh / thành phố',
    description: 'Mở rộng tìm kiếm trong cùng tỉnh hoặc thành phố đã lưu.',
  },
  {
    value: 'anywhere',
    label: 'Toàn quốc',
    description: 'Không giới hạn theo khu vực; cậu vẫn có thể lọc địa điểm thủ công.',
  },
]

const PROXIMITY_SCOPES = new Set(
  PROXIMITY_SCOPE_OPTIONS.map((option) => option.value)
)

export function normalizeLocation(value) {
  const normalized = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim()
    .replace(/[.,/_-]+/g, ' ')
    .replace(/\s+/g, ' ')

  const withoutCityPrefix = normalized
    .replace(/^(?:thanh pho|tp)\s+/, '')
    .replace(/^ho chi minh city$/, 'ho chi minh')

  return /^(?:hcm|sai gon|saigon)$/.test(withoutCityPrefix)
    ? 'ho chi minh'
    : withoutCityPrefix
}

export function normalizeProximityScope(value) {
  return PROXIMITY_SCOPES.has(value) ? value : 'same_city'
}

export function getProximityScopeOption(value) {
  const normalized = normalizeProximityScope(value)
  return PROXIMITY_SCOPE_OPTIONS.find((option) => option.value === normalized)
}

function hasLocation(value) {
  const normalized = normalizeLocation(value)
  return normalized !== '' && !normalized.startsWith('chua cap nhat')
}

function areaValues(value) {
  return String(value ?? '')
    .split(/[,;|]/)
    .map(normalizeLocation)
    .filter((area) => area && !area.startsWith('chua cap nhat'))
}

export function getProximityLevel(origin = {}, candidate = {}) {
  const originCity = normalizeLocation(origin.city)
  const candidateCity = normalizeLocation(candidate.city)

  if (!hasLocation(origin.city) || !hasLocation(candidate.city)) return 'unknown'
  if (originCity !== candidateCity) return 'different_city'

  const originAreas = areaValues(origin.area)
  const candidateAreas = new Set(areaValues(candidate.area))

  if (originAreas.some((area) => candidateAreas.has(area))) {
    return 'same_area'
  }

  return 'same_city'
}

export function matchesProximityScope(origin, candidate, scope) {
  const normalizedScope = normalizeProximityScope(scope)
  if (normalizedScope === 'anywhere') return true

  const level = getProximityLevel(origin, candidate)
  if (normalizedScope === 'same_city') {
    return level === 'same_city' || level === 'same_area'
  }

  return level === 'same_area'
}

export function getProximityLabel(origin, candidate) {
  const level = getProximityLevel(origin, candidate)

  if (level === 'same_area') return `Cùng khu vực ${candidate.area}`
  if (level === 'same_city') return `Cùng ${candidate.city}`
  if (level === 'different_city') return 'Khác tỉnh / thành phố'
  return 'Chưa đủ dữ liệu khu vực'
}
