import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { requestPasswordReset } from '../auth'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const errorRef = useRef(null)

  useEffect(() => {
    if (error) errorRef.current?.focus({ preventScroll: true })
  }, [error])

  async function handleSubmit(event) {
    event.preventDefault()
    if (isLoading) return

    if (!email.trim()) {
      setError('Hãy nhập email đã dùng để đăng ký.')
      return
    }

    setError('')
    setIsLoading(true)

    try {
      await requestPasswordReset(
        email,
        `${window.location.origin}/reset-password`
      )
      setSent(true)
    } catch (requestError) {
      setError(
        requestError.message
        || 'Chưa thể gửi email đặt lại mật khẩu. Hãy thử lại sau.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Layout>
      <div className="login-card-container auth-recovery-stage">
        <section className="login-card auth-recovery-card" aria-labelledby="forgot-password-title">
          <div className="auth-recovery-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 8.5A4.5 4.5 0 0 1 8.5 4h7A4.5 4.5 0 0 1 20 8.5v7a4.5 4.5 0 0 1-4.5 4.5h-7A4.5 4.5 0 0 1 4 15.5v-7Z" />
              <path d="m5.5 7 6.5 5 6.5-5" />
            </svg>
          </div>

          <header className="card-header auth-recovery-heading">
            <span className="login-small-title">KHÔI PHỤC TÀI KHOẢN</span>
            <h1 id="forgot-password-title" className="card-heading">
              Quên mật khẩu?
            </h1>
            <p className="card-subtitle">
              Nhập email đăng ký. Coco sẽ gửi một liên kết an toàn để cậu tạo mật khẩu mới.
            </p>
          </header>

          {sent ? (
            <div className="auth-success-panel" role="status" aria-live="polite">
              <strong>Kiểm tra hộp thư của cậu</strong>
              <p>
                Nếu email khớp với một tài khoản CocoApp, liên kết đặt lại mật khẩu sẽ được gửi tới đó.
                Nhớ kiểm tra cả thư rác.
              </p>
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
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="recovery-email">
                  Email đăng ký
                </label>
                <input
                  id="recovery-email"
                  name="email"
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    setError('')
                  }}
                  placeholder="tenban@example.com"
                  autoComplete="email"
                  inputMode="email"
                  maxLength="254"
                  disabled={isLoading}
                  aria-invalid={Boolean(error)}
                  autoFocus
                />
              </div>

              <button type="submit" className="btn-login" disabled={isLoading}>
                {isLoading ? 'Đang gửi email…' : 'Gửi liên kết đặt lại mật khẩu →'}
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
