import { useEffect, useRef } from 'react'
import { Icon } from './AppLayout'
import {
  CONNECTION_INVITE_MAX_LENGTH,
  getConnectionInviteTemplates,
} from '../lib/connectionInvite'

export default function ConnectionInviteDialog({
  student,
  message,
  error,
  isSending,
  onChange,
  onBlur,
  onClose,
  onSubmit,
}) {
  const dialogRef = useRef(null)
  const textareaRef = useRef(null)
  const templates = getConnectionInviteTemplates(student.purpose)

  useEffect(() => {
    textareaRef.current?.focus({ preventScroll: true })

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !isSending) {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab') return

      const focusable = [...dialogRef.current.querySelectorAll(
        'button:not([disabled]), textarea:not([disabled])'
      )]
      if (focusable.length === 0) return

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
  }, [isSending, onClose])

  return (
    <div
      className="connection-invite-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSending) onClose()
      }}
    >
      <section
        ref={dialogRef}
        className="connection-invite-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="connection-invite-title"
      >
        <header className="connection-invite-header">
          <div className="connection-invite-person" aria-hidden="true">
            {student.name.trim().split(/\s+/).pop()?.[0] || 'C'}
          </div>
          <div>
            <p>LỜI MỜI CÓ MỤC TIÊU</p>
            <h2 id="connection-invite-title">Kết nối với {student.name}</h2>
            <span>{student.purpose} · {student.major}</span>
          </div>
          <button
            type="button"
            className="connection-invite-close"
            onClick={onClose}
            disabled={isSending}
          >
            Đóng
          </button>
        </header>

        <form className="connection-invite-form" onSubmit={onSubmit}>
          <div className="connection-invite-guidance">
            <Icon name="spark" />
            <p><strong>Nói rõ lý do cậu muốn kết nối.</strong> Đừng chia sẻ số điện thoại, địa chỉ chính xác hoặc thông tin riêng tư trong lời nhắn đầu tiên.</p>
          </div>

          <fieldset className="connection-invite-templates">
            <legend>Chọn một câu mở đầu</legend>
            {templates.map((template, index) => (
              <button
                key={template}
                type="button"
                onClick={() => onChange(template)}
              >
                <span>{index + 1}</span>
                {template}
              </button>
            ))}
          </fieldset>

          <label className="connection-invite-field" htmlFor="connection-invite-message">
            <span>Lời nhắn của cậu</span>
            <textarea
              ref={textareaRef}
              id="connection-invite-message"
              value={message}
              maxLength={CONNECTION_INVITE_MAX_LENGTH}
              rows={5}
              placeholder="Ví dụ: Chào cậu, mình đang tìm bạn cùng học React vào tối thứ Ba…"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'connection-invite-error connection-invite-count' : 'connection-invite-count'}
              onChange={(event) => onChange(event.target.value)}
              onBlur={onBlur}
            />
            <span id="connection-invite-count" className="connection-invite-count" aria-live="polite">
              {message.length}/{CONNECTION_INVITE_MAX_LENGTH}
            </span>
          </label>

          {error && (
            <p id="connection-invite-error" className="connection-invite-error" role="alert">
              {error}
            </p>
          )}

          <footer className="connection-invite-actions">
            <button type="button" className="view-student-button" onClick={onClose} disabled={isSending}>
              Để sau
            </button>
            <button type="submit" className="connect-student-button" disabled={isSending}>
              {isSending ? 'Đang gửi…' : 'Gửi lời mời'} <Icon name="arrow" />
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
