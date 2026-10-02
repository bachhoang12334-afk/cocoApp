import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AppLayout, { Icon } from '../components/AppLayout'
import { getCurrentAccount } from '../auth'
import { supabase } from '../lib/supabaseClient'

function formatBlockedAt(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
  }).format(date)
}

export default function SafetyCenter() {
  const [blockedUsers, setBlockedUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [pendingUnblock, setPendingUnblock] = useState(null)
  const [actionId, setActionId] = useState(null)
  const isMountedRef = useRef(false)
  const loadRequestIdRef = useRef(0)
  const confirmationTriggerRef = useRef(null)

  const loadBlockedUsers = useCallback(async ({ silent = false } = {}) => {
    const requestId = ++loadRequestIdRef.current
    const isCurrentRequest = () => (
      isMountedRef.current && loadRequestIdRef.current === requestId
    )

    if (!silent && isMountedRef.current) {
      setIsLoading(true)
      setLoadError('')
    }

    try {
      const user = await getCurrentAccount()
      if (!user) throw new Error('Phiên đăng nhập đã hết.')

      const { data, error: loadError } = await supabase.rpc('get_my_blocked_users')
      if (loadError) throw loadError

      if (isCurrentRequest()) {
        setBlockedUsers(data || [])
        setLoadError('')
      }
    } catch {
      if (isCurrentRequest()) {
        setLoadError('Chưa tải được danh sách đã chặn. Hãy thử lại.')
      }
    } finally {
      if (isCurrentRequest()) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    const initialLoadFrame = window.requestAnimationFrame(() => {
      void loadBlockedUsers({ silent: true })
    })

    function handleFocus() {
      if (document.visibilityState === 'visible') {
        void loadBlockedUsers({ silent: true })
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleFocus)

    return () => {
      isMountedRef.current = false
      loadRequestIdRef.current += 1
      window.cancelAnimationFrame(initialLoadFrame)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleFocus)
    }
  }, [loadBlockedUsers])

  function askToUnblock(user) {
    confirmationTriggerRef.current = document.activeElement
    setPendingUnblock(user)
    setActionError('')
    setStatusMessage('')
  }

  function closeConfirmation() {
    setPendingUnblock(null)
    window.requestAnimationFrame(() => {
      confirmationTriggerRef.current?.focus({ preventScroll: true })
    })
  }

  async function unblockUser() {
    if (!pendingUnblock || actionId) return

    const blockedUser = pendingUnblock
    setActionId(blockedUser.blocked_user_id)
    setActionError('')

    try {
      const user = await getCurrentAccount()
      if (!user) throw new Error('Phiên đăng nhập đã hết.')

      const { error: deleteError } = await supabase
        .from('user_blocks')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_id', blockedUser.blocked_user_id)

      if (deleteError) throw deleteError
      if (!isMountedRef.current) return

      loadRequestIdRef.current += 1
      const unblockedName = blockedUser.full_name?.trim() || 'tài khoản này'
      setBlockedUsers((current) => current.filter(
        (item) => item.blocked_user_id !== blockedUser.blocked_user_id
      ))
      setPendingUnblock(null)
      setStatusMessage(`Đã bỏ chặn ${unblockedName}. Hai bên cần gửi lời mời mới để kết nối lại.`)
    } catch {
      if (isMountedRef.current) {
        setActionError('Chưa bỏ chặn được tài khoản. Hãy thử lại sau.')
      }
    } finally {
      if (isMountedRef.current) setActionId(null)
    }
  }

  return (
    <AppLayout>
      <section className="discover-page safety-center-page">
        <header className="discover-header">
          <div>
            <p className="page-eyebrow">COCO SAFETY</p>
            <h1>Trung tâm an toàn</h1>
            <p>Quản lý tài khoản đã chặn và biết cách xử lý khi một tương tác khiến cậu không thoải mái.</p>
          </div>
          <Link to="/discover" className="banner-button">Quay lại Khám phá</Link>
        </header>

        <div className="safety-principles" aria-label="Nguyên tắc an toàn">
          <article>
            <span><Icon name="safety" /></span>
            <div><strong>Cậu kiểm soát kết nối</strong><p>Chặn sẽ dừng lời mời, kết nối và tin nhắn mới.</p></div>
          </article>
          <article>
            <span><Icon name="profile" /></span>
            <div><strong>Báo cáo được giữ kín</strong><p>Người bị báo cáo không xem được lý do hoặc mô tả của cậu.</p></div>
          </article>
          <article>
            <span><Icon name="connection" /></span>
            <div><strong>Ưu tiên an toàn thực tế</strong><p>Gặp ở nơi công cộng và báo cho người tin cậy khi cần.</p></div>
          </article>
        </div>

        <div className="safety-emergency-note" role="note">
          <strong>Nếu có nguy hiểm ngay lúc này</strong>
          <p>Rời khỏi tình huống, liên hệ người cậu tin tưởng và cơ quan hỗ trợ khẩn cấp tại nơi cậu đang ở. CocoApp không thay thế dịch vụ khẩn cấp.</p>
        </div>

        {actionError && <div className="form-error-banner" role="alert">{actionError}</div>}
        {statusMessage && (
          <div className="matches-status-message" role="status" aria-live="polite">
            <Icon name="safety" /> {statusMessage}
          </div>
        )}

        <section
          className="blocked-users-section"
          aria-labelledby="blocked-users-title"
          aria-busy={isLoading}
        >
          <div className="blocked-users-heading">
            <div>
              <p className="page-eyebrow">QUYỀN KIỂM SOÁT CỦA CẬU</p>
              <h2 id="blocked-users-title">Tài khoản đã chặn</h2>
              <p>Bỏ chặn không khôi phục kết nối cũ. Hai bên phải gửi và chấp nhận lời mời mới.</p>
            </div>
            {!isLoading && !loadError && <span>{blockedUsers.length} tài khoản</span>}
          </div>

          {isLoading ? (
            <div className="safety-list-state" role="status">Đang tải danh sách đã chặn…</div>
          ) : loadError ? (
            <div className="safety-list-state" role="alert">
              <strong>Không thể tải danh sách đã chặn</strong>
              <p>{loadError}</p>
              <button
                type="button"
                className="view-student-button"
                onClick={() => void loadBlockedUsers()}
              >
                Thử tải lại
              </button>
            </div>
          ) : blockedUsers.length === 0 ? (
            <div className="safety-list-state">
              <strong>Chưa có tài khoản bị chặn</strong>
              <p>Khi chặn ai đó từ Khám phá hoặc Kết nối, cậu có thể quản lý tại đây.</p>
            </div>
          ) : (
            <div className="blocked-users-list">
              {blockedUsers.map((user) => (
                <article key={user.blocked_user_id}>
                  <span className="conversation-avatar" aria-hidden="true">
                    {(user.full_name?.trim() || 'S').split(/\s+/).pop()?.[0] || 'S'}
                  </span>
                  <div>
                    <strong>{user.full_name?.trim() || 'Sinh viên CocoApp'}</strong>
                    <p>{[user.major, user.university].filter(Boolean).join(' · ') || 'Hồ sơ sinh viên'}</p>
                    <small>Đã chặn {formatBlockedAt(user.blocked_at)}</small>
                  </div>
                  <button type="button" className="view-student-button" onClick={() => askToUnblock(user)}>
                    Bỏ chặn
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        {pendingUnblock && (
          <div className="discover-dialog-backdrop safety-dialog-backdrop" role="presentation">
            <section
              className="discover-profile-dialog connection-confirmation-dialog"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="unblock-title"
              aria-describedby="unblock-description"
            >
              <div className="discover-dialog-body">
                <div className="discover-dialog-section">
                  <h2 id="unblock-title">Bỏ chặn {pendingUnblock.full_name?.trim() || 'tài khoản này'}?</h2>
                  <p id="unblock-description">Hai bên có thể thấy lại hồ sơ và gửi lời mời mới. Kết nối cũ không tự khôi phục.</p>
                </div>
              </div>
              <footer className="discover-dialog-actions">
                <button type="button" className="view-student-button" onClick={closeConfirmation} disabled={Boolean(actionId)}>
                  Giữ chặn
                </button>
                <button type="button" className="connect-student-button" onClick={unblockUser} disabled={Boolean(actionId)} autoFocus>
                  {actionId ? 'Đang bỏ chặn…' : 'Xác nhận bỏ chặn'}
                </button>
              </footer>
            </section>
          </div>
        )}
      </section>
    </AppLayout>
  )
}
