import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCurrentAccount } from '../auth'
import { supabase } from '../lib/supabaseClient'

const reportCategories = [
  { value: 'spam', label: 'Spam hoặc quảng cáo' },
  { value: 'harassment', label: 'Quấy rối hoặc bắt nạt' },
  { value: 'unsafe_behavior', label: 'Hành vi không an toàn' },
  { value: 'impersonation', label: 'Giả mạo danh tính' },
  { value: 'inappropriate_content', label: 'Nội dung không phù hợp' },
  { value: 'other', label: 'Lý do khác' },
]

function getSafetyErrorMessage(error) {
  if (error?.code === '23505') {
    return 'Hành động này đã được ghi nhận trước đó.'
  }

  if (error?.message?.toLowerCase().includes('row-level security')) {
    return 'Phiên đăng nhập không còn quyền thực hiện hành động này. Hãy đăng nhập lại.'
  }

  return 'Chưa thể hoàn tất hành động. Hãy thử lại sau.'
}

export default function SafetyActions({
  targetId,
  targetName,
  connectionRequestId = null,
  messageId = null,
  onBlocked,
  onReported,
  compact = false,
}) {
  const [mode, setMode] = useState(null)
  const [category, setCategory] = useState('')
  const [details, setDetails] = useState('')
  const [blockAfterReport, setBlockAfterReport] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const triggerRef = useRef(null)
  const dialogRef = useRef(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!mode) return undefined

    dialogRef.current?.focus({ preventScroll: true })

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !isSubmitting) {
        event.preventDefault()
        closeDialog()
        return
      }

      if (event.key !== 'Tab') return

      const focusable = dialogRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), select:not([disabled]), textarea:not([disabled]), input:not([disabled])'
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
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [mode, isSubmitting])

  function openDialog() {
    triggerRef.current = document.activeElement
    setMode('menu')
    setError('')
  }

  function closeDialog({ restoreFocus = true } = {}) {
    setMode(null)
    setError('')
    setCategory('')
    setDetails('')
    setBlockAfterReport(false)

    if (restoreFocus) {
      window.requestAnimationFrame(() => {
        triggerRef.current?.focus({ preventScroll: true })
      })
    }
  }

  async function blockUser() {
    const user = await getCurrentAccount()
    if (!user) throw new Error('Phiên đăng nhập đã hết.')

    const { error: blockError } = await supabase
      .from('user_blocks')
      .insert({
        blocker_id: user.id,
        blocked_id: targetId,
      })

    if (blockError && blockError.code !== '23505') throw blockError
  }

  async function confirmBlock() {
    if (isSubmitting) return

    setIsSubmitting(true)
    setError('')

    try {
      await blockUser()
      closeDialog({ restoreFocus: false })
      onBlocked?.(targetId, targetName)
    } catch (blockError) {
      setError(getSafetyErrorMessage(blockError))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function submitReport(event) {
    event.preventDefault()
    if (!category || isSubmitting) return

    setIsSubmitting(true)
    setError('')

    try {
      const user = await getCurrentAccount()
      if (!user) throw new Error('Phiên đăng nhập đã hết.')

      const report = {
        id: crypto.randomUUID(),
        reporter_id: user.id,
        reported_user_id: targetId,
        category,
        details: details.trim() || null,
      }

      if (connectionRequestId) report.connection_request_id = connectionRequestId
      if (messageId) report.message_id = messageId

      const { error: reportError } = await supabase
        .from('user_reports')
        .insert(report)

      if (reportError && reportError.code !== '23505') throw reportError

      if (blockAfterReport) {
        await blockUser()
        closeDialog({ restoreFocus: false })
        onReported?.(targetId, targetName)
        onBlocked?.(targetId, targetName)
        return
      }

      setMode('reported')
      onReported?.(targetId, targetName)
    } catch (reportError) {
      setError(getSafetyErrorMessage(reportError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className={`safety-action-trigger ${compact ? 'is-compact' : ''}`}
        onClick={openDialog}
      >
        An toàn
      </button>

      {mode && (
        <div
          className="discover-dialog-backdrop safety-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSubmitting) closeDialog()
          }}
        >
          <section
            ref={dialogRef}
            className="discover-profile-dialog safety-dialog"
            role={mode === 'block' ? 'alertdialog' : 'dialog'}
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            tabIndex="-1"
          >
            <header className="safety-dialog-header">
              <span className="safety-shield" aria-hidden="true">C</span>
              <div>
                <p className="discover-dialog-kicker">COCO SAFETY</p>
                <h2 id={titleId}>
                  {mode === 'menu' && `An toàn với ${targetName}`}
                  {mode === 'block' && `Chặn ${targetName}?`}
                  {mode === 'report' && `Báo cáo ${targetName}`}
                  {mode === 'reported' && 'Đã gửi báo cáo'}
                </h2>
              </div>
              <button
                type="button"
                className="discover-dialog-close"
                onClick={() => closeDialog()}
                disabled={isSubmitting}
              >
                Đóng
              </button>
            </header>

            <div className="discover-dialog-body safety-dialog-body">
              {mode === 'menu' && (
                <>
                  <p id={descriptionId}>
                    Chọn hành động phù hợp. Người này sẽ không biết nội dung báo cáo của cậu.
                  </p>
                  <div className="safety-choice-list">
                    <button type="button" onClick={() => setMode('report')}>
                      <strong>Báo cáo tài khoản</strong>
                      <span>Gửi thông tin cho đội ngũ CocoApp xem xét.</span>
                    </button>
                    <button type="button" onClick={() => setMode('block')}>
                      <strong>Chặn tài khoản</strong>
                      <span>Dừng kết nối và không cho hai bên gửi tin nhắn mới.</span>
                    </button>
                  </div>
                  <Link to="/safety" className="safety-center-link" onClick={() => closeDialog({ restoreFocus: false })}>
                    Mở Trung tâm an toàn
                  </Link>
                </>
              )}

              {mode === 'block' && (
                <>
                  <p id={descriptionId}>
                    Lời mời hoặc kết nối hiện tại sẽ bị hủy ngay. Lịch sử được giữ lại cho mục đích an toàn, nhưng hai bên không thể kết nối hoặc gửi tin mới cho đến khi cậu bỏ chặn.
                  </p>
                  <div className="safety-warning-note" role="note">
                    Chặn không tự động gửi báo cáo. Nếu có hành vi vi phạm, hãy báo cáo trước khi chặn.
                  </div>
                </>
              )}

              {mode === 'report' && (
                <form id={`${titleId}-form`} className="safety-report-form" onSubmit={submitReport}>
                  <p id={descriptionId}>
                    Chỉ gửi thông tin cần thiết. Không nhập mật khẩu, số thẻ hoặc địa chỉ nhà.
                  </p>
                  <label>
                    <span>Lý do báo cáo</span>
                    <select
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                      required
                    >
                      <option value="">Chọn một lý do</option>
                      {reportCategories.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Mô tả thêm (không bắt buộc)</span>
                    <textarea
                      value={details}
                      onChange={(event) => setDetails(event.target.value)}
                      maxLength={1000}
                      rows={4}
                      placeholder="Mô tả ngắn điều đã xảy ra…"
                    />
                    <small>{details.length}/1000 ký tự</small>
                  </label>
                  <label className="safety-checkbox-row">
                    <input
                      type="checkbox"
                      checked={blockAfterReport}
                      onChange={(event) => setBlockAfterReport(event.target.checked)}
                    />
                    <span>Đồng thời chặn tài khoản này sau khi gửi báo cáo</span>
                  </label>
                </form>
              )}

              {mode === 'reported' && (
                <p id={descriptionId}>
                  CocoApp đã ghi nhận báo cáo. Nội dung báo cáo không hiển thị cho tài khoản bị báo cáo.
                </p>
              )}

              {error && (
                <div className="form-error-banner" role="alert" aria-live="assertive">
                  {error}
                </div>
              )}
            </div>

            <footer className="discover-dialog-actions safety-dialog-actions">
              {mode === 'menu' && (
                <button type="button" className="view-student-button" onClick={() => closeDialog()}>
                  Quay lại
                </button>
              )}
              {mode === 'block' && (
                <>
                  <button type="button" className="view-student-button" onClick={() => setMode('menu')} disabled={isSubmitting}>
                    Chưa chặn
                  </button>
                  <button type="button" className="safety-danger-button" onClick={confirmBlock} disabled={isSubmitting}>
                    {isSubmitting ? 'Đang chặn…' : 'Xác nhận chặn'}
                  </button>
                </>
              )}
              {mode === 'report' && (
                <>
                  <button type="button" className="view-student-button" onClick={() => setMode('menu')} disabled={isSubmitting}>
                    Quay lại
                  </button>
                  <button
                    type="submit"
                    form={`${titleId}-form`}
                    className="connect-student-button"
                    disabled={!category || isSubmitting}
                  >
                    {isSubmitting ? 'Đang gửi…' : 'Gửi báo cáo'}
                  </button>
                </>
              )}
              {mode === 'reported' && (
                <button type="button" className="connect-student-button" onClick={() => closeDialog()} autoFocus>
                  Hoàn tất
                </button>
              )}
            </footer>
          </section>
        </div>
      )}
    </>
  )
}
