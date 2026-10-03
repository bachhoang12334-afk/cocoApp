import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ACCOUNT_DELETION_CONFIRMATION,
  deleteCurrentAccount,
  isAccountDeletionConfirmed,
} from '../lib/accountDeletion'

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
    </svg>
  )
}

export default function AccountDangerZone({ onAccountDeleted }) {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')
  const triggerRef = useRef(null)
  const dialogRef = useRef(null)
  const inputRef = useRef(null)
  const deletingRef = useRef(false)

  const canDelete = isAccountDeletionConfirmed(confirmation)

  function closeDialog() {
    if (deletingRef.current) return
    setIsOpen(false)
    setConfirmation('')
    setError('')
  }

  useEffect(() => {
    deletingRef.current = isDeleting
  }, [isDeleting])

  useEffect(() => {
    if (!isOpen) return undefined

    const previousOverflow = document.body.style.overflow
    const previousFocus = document.activeElement
    const focusFrame = window.requestAnimationFrame(() => inputRef.current?.focus())

    document.body.style.overflow = 'hidden'

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeDialog()
        return
      }

      if (event.key !== 'Tab') return

      const focusable = dialogRef.current?.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'
      )

      if (!focusable?.length) return

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

    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [isOpen])

  async function handleDelete(event) {
    event.preventDefault()
    if (!canDelete || isDeleting) return

    setIsDeleting(true)
    setError('')

    try {
      const result = await deleteCurrentAccount()

      onAccountDeleted?.()
      navigate('/login', {
        replace: true,
        state: {
          accountDeleted: true,
          sessionCleanupWarning: !result.sessionCleared,
        },
      })
    } catch (deleteError) {
      setError(deleteError.message || 'Chưa thể xoá tài khoản. Dữ liệu vẫn được giữ nguyên.')
      setIsDeleting(false)
    }
  }

  return (
    <section className="account-danger-zone" aria-labelledby="account-danger-title">
      <div className="account-danger-copy">
        <span className="account-danger-icon"><TrashIcon /></span>
        <div>
          <p>TÀI KHOẢN VÀ DỮ LIỆU</p>
          <h2 id="account-danger-title">Xoá tài khoản Coco</h2>
          <span>
            Xoá vĩnh viễn hồ sơ, lời mời, tin nhắn, Coco Plan và dữ liệu an toàn gắn với tài khoản này.
          </span>
        </div>
      </div>
      <button
        ref={triggerRef}
        type="button"
        className="account-delete-trigger"
        onClick={() => setIsOpen(true)}
      >
        Xem tuỳ chọn xoá
      </button>

      {isOpen && (
        <div
          className="account-delete-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog()
          }}
        >
          <section
            ref={dialogRef}
            className="account-delete-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-delete-title"
            aria-describedby="account-delete-description"
          >
            <div className="account-delete-dialog-header">
              <span aria-hidden="true"><TrashIcon /></span>
              <div>
                <p>HÀNH ĐỘNG KHÔNG THỂ HOÀN TÁC</p>
                <h2 id="account-delete-title">Xoá vĩnh viễn tài khoản?</h2>
              </div>
              <button
                type="button"
                className="account-delete-close"
                onClick={closeDialog}
                disabled={isDeleting}
                aria-label="Đóng hộp thoại xoá tài khoản"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </div>

            <form className="account-delete-form" onSubmit={handleDelete}>
              <p id="account-delete-description">
                Sau khi xoá, cậu sẽ bị đăng xuất và không thể khôi phục tài khoản, kết nối hay nội dung trò chuyện. Tài khoản của người khác không bị ảnh hưởng.
              </p>

              <div className="account-delete-summary">
                <strong>Dữ liệu sẽ bị xoá</strong>
                <ul>
                  <li>Hồ sơ công khai và thông tin riêng tư</li>
                  <li>Lời mời, tin nhắn và Coco Plan</li>
                  <li>Hồ sơ đã lưu, báo cáo và trạng thái chặn</li>
                </ul>
              </div>

              <label htmlFor="account-delete-confirmation">
                Nhập <strong>{ACCOUNT_DELETION_CONFIRMATION}</strong> để xác nhận
              </label>
              <input
                ref={inputRef}
                id="account-delete-confirmation"
                value={confirmation}
                onChange={(event) => {
                  setConfirmation(event.target.value)
                  setError('')
                }}
                autoComplete="off"
                spellCheck="false"
                disabled={isDeleting}
                aria-invalid={Boolean(confirmation) && !canDelete}
                aria-describedby={error ? 'account-delete-error' : undefined}
              />

              {error && (
                <div id="account-delete-error" className="account-delete-error" role="alert">
                  {error}
                </div>
              )}

              <div className="account-delete-actions">
                <button type="button" onClick={closeDialog} disabled={isDeleting}>Giữ tài khoản</button>
                <button type="submit" disabled={!canDelete || isDeleting}>
                  {isDeleting ? 'Đang xoá an toàn…' : 'Xoá vĩnh viễn'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  )
}
