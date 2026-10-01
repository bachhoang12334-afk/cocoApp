import { useEffect, useRef } from 'react'
import {
  COCO_PLAN_LOCATION_MAX_LENGTH,
  COCO_PLAN_MODES,
  COCO_PLAN_TITLE_MAX_LENGTH,
} from '../lib/cocoPlan'

const locationHints = {
  online: 'Chỉ ghi nền tảng hoặc link phòng an toàn.',
  campus: 'Gợi ý một khu vực chung trong trường.',
  public_place: 'Chỉ ghi địa điểm công cộng; không chia sẻ địa chỉ nhà.',
}

export default function CocoPlanDialog({
  connectionName,
  draft,
  errors,
  validationAttempt,
  submitError,
  isSaving,
  onChange,
  onClose,
  onSubmit,
}) {
  const dialogRef = useRef(null)
  const titleRef = useRef(null)
  const onCloseRef = useRef(onClose)
  const isSavingRef = useRef(isSaving)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    isSavingRef.current = isSaving
    if (isSaving) dialogRef.current?.focus({ preventScroll: true })
  }, [isSaving])

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true })

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !isSavingRef.current) {
        event.preventDefault()
        onCloseRef.current()
        return
      }

      if (event.key !== 'Tab') return

      const focusable = [...dialogRef.current.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
      )]
      if (focusable.length === 0) {
        event.preventDefault()
        dialogRef.current.focus({ preventScroll: true })
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (!validationAttempt) return undefined

    const frameId = window.requestAnimationFrame(() => {
      dialogRef.current
        ?.querySelector('[aria-invalid="true"]')
        ?.focus({ preventScroll: true })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [validationAttempt])

  return (
    <div
      className="coco-plan-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) onClose()
      }}
    >
      <section
        ref={dialogRef}
        className="coco-plan-dialog"
        role="dialog"
        tabIndex="-1"
        aria-modal="true"
        aria-labelledby="coco-plan-dialog-title"
        aria-describedby="coco-plan-dialog-description"
      >
        <header className="coco-plan-dialog-header">
          <div className="coco-plan-mark" aria-hidden="true">C</div>
          <div>
            <p>COCO PLAN</p>
            <h2 id="coco-plan-dialog-title">Hẹn một bước tiếp theo</h2>
            <span id="coco-plan-dialog-description">
              Gửi đề xuất rõ ràng cho {connectionName} để hai cậu dễ bắt đầu.
            </span>
          </div>
          <button type="button" onClick={onClose} disabled={isSaving}>
            Đóng
          </button>
        </header>

        <form className="coco-plan-form" noValidate aria-busy={isSaving} onSubmit={onSubmit}>
          <div className="coco-plan-privacy-note">
            <strong>Giữ cuộc hẹn an toàn.</strong>
            <span>Không nhập số điện thoại, địa chỉ nhà hoặc thông tin riêng tư.</span>
          </div>

          <div className="coco-plan-form-grid">
            <label className="coco-plan-field coco-plan-field-wide" htmlFor="coco-plan-title">
              <span>Tên kế hoạch</span>
              <input
                ref={titleRef}
                id="coco-plan-title"
                value={draft.title}
                maxLength={COCO_PLAN_TITLE_MAX_LENGTH}
                placeholder="Ví dụ: Ôn React trước buổi kiểm tra"
                disabled={isSaving}
                aria-invalid={Boolean(errors.title)}
                aria-describedby={errors.title ? 'coco-plan-title-error' : undefined}
                onChange={(event) => onChange('title', event.target.value)}
              />
              <small>{draft.title.length}/{COCO_PLAN_TITLE_MAX_LENGTH}</small>
              {errors.title && <em id="coco-plan-title-error">{errors.title}</em>}
            </label>

            <label className="coco-plan-field" htmlFor="coco-plan-start">
              <span>Ngày và giờ</span>
              <input
                id="coco-plan-start"
                type="datetime-local"
                value={draft.startsAt}
                disabled={isSaving}
                aria-invalid={Boolean(errors.startsAt)}
                aria-describedby={errors.startsAt ? 'coco-plan-start-error' : undefined}
                onChange={(event) => onChange('startsAt', event.target.value)}
              />
              {errors.startsAt && <em id="coco-plan-start-error">{errors.startsAt}</em>}
            </label>

            <label className="coco-plan-field" htmlFor="coco-plan-mode">
              <span>Hình thức</span>
              <select
                id="coco-plan-mode"
                value={draft.mode}
                disabled={isSaving}
                aria-invalid={Boolean(errors.mode)}
                aria-describedby={errors.mode ? 'coco-plan-mode-error' : undefined}
                onChange={(event) => onChange('mode', event.target.value)}
              >
                {Object.entries(COCO_PLAN_MODES).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              {errors.mode && <em id="coco-plan-mode-error">{errors.mode}</em>}
            </label>

            <label className="coco-plan-field coco-plan-field-wide" htmlFor="coco-plan-location">
              <span>Ghi chú địa điểm <i>(không bắt buộc)</i></span>
              <textarea
                id="coco-plan-location"
                value={draft.locationNote}
                rows={3}
                maxLength={COCO_PLAN_LOCATION_MAX_LENGTH}
                placeholder={draft.mode === 'online' ? 'Ví dụ: Google Meet' : 'Ví dụ: thư viện khu A'}
                disabled={isSaving}
                aria-invalid={Boolean(errors.locationNote)}
                aria-describedby={`coco-plan-location-hint${errors.locationNote ? ' coco-plan-location-error' : ''}`}
                onChange={(event) => onChange('locationNote', event.target.value)}
              />
              <small id="coco-plan-location-hint">
                {locationHints[draft.mode]} · {draft.locationNote.length}/{COCO_PLAN_LOCATION_MAX_LENGTH}
              </small>
              {errors.locationNote && <em id="coco-plan-location-error">{errors.locationNote}</em>}
            </label>
          </div>

          {submitError && <p className="coco-plan-form-error" role="alert">{submitError}</p>}

          <footer className="coco-plan-dialog-actions">
            <button type="button" className="view-student-button" onClick={onClose} disabled={isSaving}>
              Để sau
            </button>
            <button type="submit" className="connect-student-button" disabled={isSaving}>
              {isSaving ? 'Đang gửi đề xuất…' : 'Gửi Coco Plan'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
