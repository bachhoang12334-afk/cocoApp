import { useEffect, useState } from 'react'
import {
  COCO_PLAN_MODES,
  COCO_PLAN_STATUSES,
  getCocoPlanActions,
  isCocoPlanExpired,
} from '../lib/cocoPlan'

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const actionLabels = {
  accepted: 'Chấp nhận',
  declined: 'Từ chối',
  cancelled: 'Hủy kế hoạch',
  completed: 'Đánh dấu hoàn thành',
}

export default function CocoPlanCard({
  plan,
  connectionName,
  headingRef,
  pendingStatus,
  onCreate,
  onUpdateStatus,
}) {
  const [clockTick, setClockTick] = useState(0)
  const isExpired = isCocoPlanExpired(plan)
  const actions = getCocoPlanActions(plan)
  const isTerminal = plan && ['declined', 'cancelled', 'completed'].includes(plan.status)
  const displayStatus = isExpired ? 'expired' : plan?.status

  useEffect(() => {
    if (!plan || plan.status !== 'proposed') return undefined

    const startsAt = Date.parse(plan.startsAt || '')
    const remaining = startsAt - Date.now()
    if (Number.isNaN(startsAt) || remaining <= 0) return undefined

    const timeoutId = window.setTimeout(
      () => setClockTick((current) => current + 1),
      Math.min(remaining + 50, 2_147_483_647)
    )

    return () => window.clearTimeout(timeoutId)
  }, [clockTick, plan])

  return (
    <section className="coco-plan-panel" aria-labelledby="coco-plan-heading">
      <div className="coco-plan-panel-heading">
        <div>
          <p>BIẾN TRÒ CHUYỆN THÀNH HÀNH ĐỘNG</p>
          <h3 ref={headingRef} id="coco-plan-heading" tabIndex="-1">Coco Plan</h3>
        </div>
        {plan && (
          <span className={`coco-plan-status is-${displayStatus}`}>
            {COCO_PLAN_STATUSES[displayStatus] || 'Đã cập nhật'}
          </span>
        )}
      </div>

      {!plan ? (
        <div className="coco-plan-empty">
          <p>Đề xuất một buổi học, làm dự án hoặc gặp tại nơi công cộng.</p>
          <button type="button" className="coco-plan-primary" onClick={onCreate}>
            Đề xuất kế hoạch
          </button>
        </div>
      ) : (
        <div className="coco-plan-card">
          <div className="coco-plan-card-copy">
            <span>{plan.isMine ? 'Cậu đã đề xuất' : `${connectionName} đã đề xuất`}</span>
            <h4>{plan.title}</h4>
          </div>

          <dl className="coco-plan-meta">
            <div>
              <dt>Thời gian</dt>
              <dd><time dateTime={plan.startsAt}>{dateFormatter.format(new Date(plan.startsAt))}</time></dd>
            </div>
            <div>
              <dt>Hình thức</dt>
              <dd>{COCO_PLAN_MODES[plan.mode] || 'Đã thống nhất'}</dd>
            </div>
            {plan.locationNote && (
              <div className="coco-plan-meta-wide">
                <dt>Ghi chú</dt>
                <dd>{plan.locationNote}</dd>
              </div>
            )}
          </dl>

          {isExpired && (
            <p className="coco-plan-expiry-note">
              Thời gian đề xuất đã qua. Không thể chấp nhận kế hoạch này nữa.
            </p>
          )}

          {actions.length > 0 && (
            <div className="coco-plan-actions" aria-label="Hành động với Coco Plan">
              {actions.map((status) => (
                <button
                  key={status}
                  type="button"
                  className={status === 'accepted' || status === 'completed'
                    ? 'coco-plan-primary'
                    : 'coco-plan-secondary'}
                  disabled={Boolean(pendingStatus)}
                  aria-busy={pendingStatus === status}
                  onClick={() => onUpdateStatus(status)}
                >
                  {pendingStatus === status ? 'Đang cập nhật…' : actionLabels[status]}
                </button>
              ))}
            </div>
          )}

          {isTerminal && (
            <div className="coco-plan-restart">
              <span>Kế hoạch này đã khép lại. Hai cậu có thể bắt đầu một kế hoạch mới.</span>
              <button type="button" className="coco-plan-primary" onClick={onCreate}>
                Đề xuất kế hoạch mới
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
