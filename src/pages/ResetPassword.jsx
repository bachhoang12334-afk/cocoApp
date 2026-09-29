import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import PasswordFlashlightInput from '../components/PasswordFlashlightInput'
import {
  getCurrentAccount,
  subscribeToAuthState,
  updateAccountPassword,
} from '../auth'
import {
  getNewPasswordErrors,
  isPasswordRecoveryRedirect,
  RECOVERY_SESSION_KEY,
} from '../lib/authSecurity'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [sessionState, setSessionState] = useState('checking')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const errorRef = useRef(null)

  useEffect(() => {
    let isMounted = true

    if (isPasswordRecoveryRedirect(window.location.href)) {
      sessionStorage.setItem(RECOVERY_SESSION_KEY, 'true')
    }

    getCurrentAccount()
      .then((user) => {
        if (!isMounted) return
        const hasRecoverySession = sessionStorage.getItem(RECOVERY_SESSION_KEY) === 'true'
        setSessionState(user && hasRecoverySession ? 'ready' : 'invalid')
      })
      .catch(() => {
        if (isMounted) setSessionState('invalid')
      })

    const unsubscribe = subscribeToAuthState((user, event) => {
      if (!isMounted) return
      if (event === 'PASSWORD_RECOVERY') {
        sessionStorage.setItem(RECOVERY_SESSION_KEY, 'true')
        setSessionState('ready')
      } else if (
        user
        && sessionStorage.getItem(RECOVERY_SESSION_KEY) === 'true'
      ) {
        setSessionState('ready')
      }
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (error) errorRef.current?.focus({ preventScroll: true })
  }, [error])

  function updateField(field, value) {
    if (field === 'password') setPassword(value)
    if (field === 'confirmPassword') setConfirmPassword(value)
    setError('')
    setFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (isLoading || sessionState !== 'ready') return

    const nextErrors = getNewPasswordErrors(password, confirmPassword)

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors)
      setError('Hãy kiểm tra các thông tin được đánh dấu bên dưới.')
      return
    }

    setFieldErrors({})
    setError('')
    setIsLoading(true)

    try {
      await updateAccountPassword(password)
      sessionStorage.removeItem(RECOVERY_SESSION_KEY)
      navigate('/login', {
        replace: true,
        state: { passwordReset: true },
      })
    } catch (updateError) {
      setError(
        updateError.message
        || 'Chưa thể cập nhật mật khẩu. Hãy yêu cầu liên kết mới và thử lại.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Layout>
      <div className="login-card-container auth-recovery-stage">
        <section className="login-card auth-recovery-card" aria-labelledby="reset-password-title">
          <div className="auth-recovery-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="5" y="10" width="14" height="10" rx="3" />
              <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10M12 14v2.5" />
            </svg>
          </div>

          <header className="card-header auth-recovery-heading">
            <span className="login-small-title">BẢO MẬT TÀI KHOẢN</span>
            <h1 id="reset-password-title" className="card-heading">
              Tạo mật khẩu mới
            </h1>
            <p className="card-subtitle">
              Chọn mật khẩu cậu chưa dùng trước đây. Sau khi lưu, CocoApp sẽ đăng xuất các phiên cũ.
            </p>
          </header>

          {sessionState === 'checking' ? (
            <div className="auth-session-panel" role="status" aria-live="polite">
              Đang xác minh liên kết khôi phục…
            </div>
          ) : sessionState === 'invalid' ? (
            <div className="auth-success-panel auth-invalid-panel" role="alert">
              <strong>Liên kết không còn hiệu lực</strong>
              <p>Liên kết có thể đã hết hạn hoặc đã được sử dụng. Hãy yêu cầu một email mới.</p>
              <Link className="auth-inline-action" to="/forgot-password">
                Gửi liên kết mới
              </Link>
            </div>
          ) : (
            <form className="auth-recovery-form" onSubmit={handleSubmit} noValidate>
              {error && (
                <div
                  ref={errorRef}
                  className="form-error-banner auth-error-summary"
                  role="alert"
                  tabIndex="-1"
                >
                  <strong>{error}</strong>
                  {Object.keys(fieldErrors).length > 0 && (
                    <ul>
                      {Object.entries(fieldErrors).map(([field, message]) => (
                        <li key={field}>
                          <a href={`#reset-${field}`}>{message}</a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="reset-password">
                  Mật khẩu mới
                </label>
                <PasswordFlashlightInput
                  id="reset-password"
                  name="password"
                  value={password}
                  onChange={(event) => updateField('password', event.target.value)}
                  placeholder="Ít nhất 6 ký tự"
                  autoComplete="new-password"
                  minLength={6}
                  maxLength={128}
                  disabled={isLoading}
                  invalid={Boolean(fieldErrors.password)}
                  describedBy={fieldErrors.password ? 'reset-password-error' : undefined}
                />
                {fieldErrors.password && (
                  <small id="reset-password-error" className="auth-field-error">
                    {fieldErrors.password}
                  </small>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reset-confirmPassword">
                  Nhập lại mật khẩu mới
                </label>
                <PasswordFlashlightInput
                  id="reset-confirmPassword"
                  name="confirmPassword"
                  value={confirmPassword}
                  onChange={(event) => updateField('confirmPassword', event.target.value)}
                  placeholder="Nhập giống mật khẩu phía trên"
                  autoComplete="new-password"
                  minLength={6}
                  maxLength={128}
                  disabled={isLoading}
                  invalid={Boolean(fieldErrors.confirmPassword)}
                  describedBy={fieldErrors.confirmPassword ? 'reset-confirmPassword-error' : undefined}
                />
                {fieldErrors.confirmPassword && (
                  <small id="reset-confirmPassword-error" className="auth-field-error">
                    {fieldErrors.confirmPassword}
                  </small>
                )}
              </div>

              <button type="submit" className="btn-login" disabled={isLoading}>
                {isLoading ? 'Đang cập nhật mật khẩu…' : 'Lưu mật khẩu mới →'}
              </button>
            </form>
          )}

          <footer className="card-footer auth-recovery-footer">
            <Link to="/login">← Quay lại đăng nhập</Link>
          </footer>
        </section>
      </div>
    </Layout>
  )
}
