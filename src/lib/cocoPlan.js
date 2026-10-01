export const COCO_PLAN_TITLE_MIN_LENGTH = 4
export const COCO_PLAN_TITLE_MAX_LENGTH = 120
export const COCO_PLAN_LOCATION_MAX_LENGTH = 160

export const COCO_PLAN_MODES = Object.freeze({
  online: 'Online',
  campus: 'Trong trường',
  public_place: 'Địa điểm công cộng',
})

export const COCO_PLAN_STATUSES = Object.freeze({
  proposed: 'Chờ phản hồi',
  accepted: 'Đã thống nhất',
  declined: 'Đã từ chối',
  cancelled: 'Đã hủy',
  completed: 'Hoàn thành',
  expired: 'Đã quá giờ',
})

export const EMPTY_COCO_PLAN_DRAFT = Object.freeze({
  title: '',
  startsAt: '',
  mode: 'campus',
  locationNote: '',
})

function normalizeSingleLine(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

export function mapCocoPlan(row, userId) {
  if (!row) return null

  return {
    id: row.id,
    connectionRequestId: row.connection_request_id,
    proposerId: row.proposer_id,
    title: row.title,
    startsAt: row.starts_at,
    mode: row.mode,
    locationNote: row.location_note || '',
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isMine: row.proposer_id === userId,
  }
}

export function normalizeCocoPlanDraft(draft) {
  const parsedStart = new Date(draft?.startsAt || '')

  return {
    title: normalizeSingleLine(draft?.title),
    startsAt: Number.isNaN(parsedStart.getTime()) ? '' : parsedStart.toISOString(),
    mode: String(draft?.mode || ''),
    locationNote: normalizeSingleLine(draft?.locationNote) || null,
  }
}

export function getCocoPlanDraftErrors(draft, { now = new Date() } = {}) {
  const normalized = normalizeCocoPlanDraft(draft)
  const errors = {}

  if (
    normalized.title.length < COCO_PLAN_TITLE_MIN_LENGTH
    || normalized.title.length > COCO_PLAN_TITLE_MAX_LENGTH
  ) {
    errors.title = `Tên kế hoạch cần từ ${COCO_PLAN_TITLE_MIN_LENGTH} đến ${COCO_PLAN_TITLE_MAX_LENGTH} ký tự.`
  }

  if (!Object.hasOwn(COCO_PLAN_MODES, normalized.mode)) {
    errors.mode = 'Hãy chọn một hình thức gặp hợp lệ.'
  }

  if (!normalized.startsAt) {
    errors.startsAt = 'Hãy chọn ngày và giờ hợp lệ.'
  } else if (new Date(normalized.startsAt).getTime() <= new Date(now).getTime()) {
    errors.startsAt = 'Thời gian gặp phải ở tương lai.'
  }

  if ((normalized.locationNote || '').length > COCO_PLAN_LOCATION_MAX_LENGTH) {
    errors.locationNote = `Ghi chú địa điểm tối đa ${COCO_PLAN_LOCATION_MAX_LENGTH} ký tự.`
  }

  return errors
}

export function buildCocoPlanInsert(draft, { connectionRequestId, proposerId }) {
  const normalized = normalizeCocoPlanDraft(draft)

  return {
    connection_request_id: connectionRequestId,
    proposer_id: proposerId,
    title: normalized.title,
    starts_at: normalized.startsAt,
    mode: normalized.mode,
    location_note: normalized.locationNote,
  }
}

export function isCocoPlanExpired(plan, now = new Date()) {
  if (!plan || plan.status !== 'proposed') return false

  const startsAt = Date.parse(plan.startsAt || '')
  const referenceTime = new Date(now).getTime()

  return !Number.isNaN(startsAt)
    && !Number.isNaN(referenceTime)
    && startsAt <= referenceTime
}

export function getCocoPlanActions(plan, { now = new Date() } = {}) {
  if (!plan) return []

  if (plan.status === 'proposed') {
    if (isCocoPlanExpired(plan, now)) {
      return plan.isMine ? ['cancelled'] : ['declined']
    }

    return plan.isMine ? ['cancelled'] : ['accepted', 'declined']
  }

  if (plan.status === 'accepted') {
    return ['completed', 'cancelled']
  }

  return []
}

export function mergeCocoPlans(serverPlan, currentPlan) {
  if (!serverPlan) return currentPlan || null
  if (!currentPlan) return serverPlan

  const serverVersion = Date.parse(serverPlan.updatedAt || serverPlan.createdAt || '')
  const currentVersion = Date.parse(currentPlan.updatedAt || currentPlan.createdAt || '')

  if (Number.isNaN(serverVersion)) return currentPlan
  if (Number.isNaN(currentVersion)) return serverPlan
  if (serverVersion > currentVersion) return serverPlan
  if (serverVersion < currentVersion) return currentPlan

  // Both values came from Supabase. On an equal timestamp, preserve a confirmed
  // in-memory transition for the same row instead of letting an older in-flight
  // fetch move the UI backwards.
  return serverPlan.id === currentPlan.id ? currentPlan : serverPlan
}

export function getDefaultCocoPlanStartAt(now = new Date()) {
  const date = new Date(now)
  date.setMinutes(0, 0, 0)
  date.setHours(date.getHours() + 2)

  const localOffset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - localOffset).toISOString().slice(0, 16)
}
