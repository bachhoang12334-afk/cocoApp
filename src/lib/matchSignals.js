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

  if (rank >= 6) {
    return { rank, level: 'strong', label: 'Nhiều điểm chung', reasons }
  }

  if (rank >= 3) {
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
