import {
  COLLABORATION_STYLE_OPTIONS,
  COMMITMENT_LEVEL_OPTIONS,
  getAvailabilityLabel,
  getPreferenceOption,
  normalizeAvailabilitySlots,
} from './matchingPreferences.js'

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

function sameValue(left, right) {
  const normalizedLeft = normalize(left)
  return normalizedLeft !== '' && normalizedLeft === normalize(right)
}

function isMeaningful(value) {
  const normalized = normalize(value)
  return normalized !== '' && !normalized.startsWith('chua ')
}

export function getMatchSignals(preferences = {}, candidate = {}) {
  const reasons = []
  let rank = 0

  if (sameValue(preferences.purpose, candidate.purpose)) {
    rank += 4
    reasons.push(`Cùng mục tiêu ${candidate.purpose}`)
  }

  const preferredAvailability = normalizeAvailabilitySlots(preferences.availabilitySlots)
  const candidateAvailability = normalizeAvailabilitySlots(candidate.availabilitySlots)
  const sharedAvailability = preferredAvailability.filter((slot) => candidateAvailability.includes(slot))

  if (sharedAvailability.length > 0) {
    rank += Math.min(3, sharedAvailability.length + 1)
    reasons.push(
      sharedAvailability.length === 1
        ? `Cùng rảnh ${getAvailabilityLabel(sharedAvailability[0]).toLowerCase()}`
        : `Trùng ${sharedAvailability.length} khung giờ rảnh`
    )
  }

  if (sameValue(preferences.collaborationStyle, candidate.collaborationStyle)) {
    const style = getPreferenceOption(
      COLLABORATION_STYLE_OPTIONS,
      candidate.collaborationStyle
    )

    if (style) {
      rank += 2
      reasons.push(`Cùng thích ${style.label.toLowerCase()}`)
    }
  }

  if (sameValue(preferences.commitmentLevel, candidate.commitmentLevel)) {
    const commitment = getPreferenceOption(
      COMMITMENT_LEVEL_OPTIONS,
      candidate.commitmentLevel
    )

    if (commitment) {
      rank += 2
      reasons.push(`Cùng mức cam kết ${commitment.label.toLowerCase()}`)
    }
  }

  if (sameValue(preferences.major, candidate.major)) {
    rank += 2
    reasons.push(`Cùng ngành ${candidate.major}`)
  }

  const sameCity = sameValue(preferences.city, candidate.city)
  const sameArea = sameCity && sameValue(preferences.area, candidate.area)

  if (sameArea) {
    rank += 3
    reasons.push(`Cùng khu vực ${candidate.area}`)
  } else if (sameCity) {
    rank += 1
    reasons.push(`Cùng ${candidate.city}`)
  }

  if (reasons.length === 0 && isMeaningful(candidate.purpose)) {
    reasons.push(`Đang tìm ${candidate.purpose.toLowerCase()}`)
  }

  if (reasons.length === 0 && isMeaningful(candidate.major)) {
    reasons.push(`Hồ sơ ngành ${candidate.major}`)
  }

  if (reasons.length === 0) {
    reasons.push('Có thông tin công khai để cậu tự đánh giá')
  }

  if (rank >= 8) {
    return { rank, level: 'strong', label: 'Nhiều điểm chung', reasons }
  }

  if (rank >= 4) {
    return { rank, level: 'good', label: 'Phù hợp tiêu chí', reasons }
  }

  if (rank >= 1) {
    return { rank, level: 'related', label: 'Có điểm liên quan', reasons }
  }

  return { rank, level: 'explore', label: 'Khám phá thêm', reasons }
}

export function sortStudentsByMatch(students, preferences) {
  return students
    .map((student, index) => ({
      student,
      index,
      fit: getMatchSignals(preferences, student),
    }))
    .sort((left, right) => (
      right.fit.rank - left.fit.rank || left.index - right.index
    ))
    .map(({ student, fit }) => ({ ...student, fit }))
}
