import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import PasswordFlashlightInput from '../components/PasswordFlashlightInput'
import { loginAccount, resendSignupConfirmation } from '../auth'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState(location.state?.email || '')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(
    Boolean(location.state?.requiresEmailConfirmation)
  )
  const [confirmationSent, setConfirmationSent] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const errorRef = useRef(null)

  useEffect(() => {
    if (error) errorRef.current?.focus({ preventScroll: true })
  }, [error])

  function handleFieldChange(field, value) {
    if (field === 'email') setEmail(value)
    if (field === 'password') setPassword(value)
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

    if (isLoading) return

    setError('')

    const nextErrors = {}
    if (!email.trim()) nextErrors.email = 'Nhập email để tiếp tục.'
    if (!password) nextErrors.password = 'Nhập mật khẩu để tiếp tục.'

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors)
      setError('Hãy kiểm tra các thông tin bắt buộc bên dưới.')
      return
    }

    setFieldErrors({})
    setIsLoading(true)

    try {
      await loginAccount(email, password)
      navigate('/dashboard', { replace: true })
    } catch (loginError) {
      if (loginError.message?.includes('chưa được xác nhận')) {
        setNeedsEmailConfirmation(true)
      }
      setError(
        loginError.message || 'Không đăng nhập được. Hãy thử lại sau.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  async function handleResendConfirmation() {
    if (isResending) return

    if (!email.trim()) {
      setFieldErrors({ email: 'Nhập email cần nhận lại thư xác nhận.' })
      setError('Hãy nhập email trước khi gửi lại thư xác nhận.')
      return
    }

    setError('')
    setFieldErrors({})
    setIsResending(true)

    try {
      await resendSignupConfirmation(
        email,
        `${window.location.origin}/login`
      )
      setConfirmationSent(true)
    } catch (resendError) {
      setError(
        resendError.message
        || 'Chưa thể gửi lại email xác nhận. Hãy thử lại sau.'
      )
    } finally {
      setIsResending(false)
    }
  }

  return (
    <Layout>
      <section className="login-stage">
        <div className="login-intro">
          <div className="intro-decoration intro-decoration-one" />
          <div className="intro-decoration intro-decoration-two" />

          <div className="intro-content">
            <span className="intro-label">DÀNH CHO SINH VIÊN</span>

            <h1>
              Gặp đúng người.
              <span> Đồng hành đúng mục tiêu.</span>
            </h1>

            <p className="intro-description">
              Tìm bạn học, đồng đội làm dự án và người ở ghép
              phù hợp với nhu cầu của cậu.
            </p>

            <div className="purpose-list">
              <div className="purpose-item purpose-study">
                <span className="purpose-number">01</span>

                <div>
                  <strong>Học nhóm</strong>
                  <p>Tìm bạn theo ngành học và kỹ năng.</p>
                </div>
              </div>

              <div className="purpose-item purpose-project">
                <span className="purpose-number">02</span>

                <div>
                  <strong>Team Project</strong>
                  <p>Tìm người cùng thực hiện ý tưởng.</p>
                </div>
              </div>

              <div className="purpose-item purpose-room">
                <span className="purpose-number">03</span>

                <div>
                  <strong>Ghép trọ</strong>
                  <p>Lọc theo giới tính, thành phố và khu vực.</p>
                </div>
              </div>
            </div>

            <p className="privacy-note">
              Hồ sơ mẫu không công khai số điện thoại hoặc số nhà.
            </p>
          </div>
        </div>

        <div className="login-panel">
          <div className="login-form-box">
            <div className="login-heading">
              <span className="login-small-title">COCOAPP</span>
              <h2>Chào mừng quay lại</h2>
              <p>Đăng nhập bằng tài khoản cậu đã đăng ký.</p>
            </div>

            {location.state?.accountDeleted ? (
              <div className="discover-demo-note auth-success-note" role="status">
                Tài khoản và dữ liệu Coco của cậu đã được xoá vĩnh viễn.
                {location.state?.sessionCleanupWarning
                  ? ' Hãy đóng tab này nếu thiết bị vẫn còn hiển thị phiên cũ.'
                  : ' Cậu đã được đăng xuất khỏi thiết bị này.'}
              </div>
            ) : location.state?.passwordReset ? (
              <div className="discover-demo-note auth-success-note" role="status">
                Mật khẩu đã được cập nhật. Các phiên cũ đã đăng xuất; cậu có thể đăng nhập lại ngay.
              </div>
            ) : location.state?.requiresEmailConfirmation ? (
              <div className="discover-demo-note" role="status">
                Tài khoản đã được tạo. Hãy kiểm tra email để xác nhận
                tài khoản trước khi đăng nhập.
              </div>
            ) : location.state?.registered ? (
              <div className="discover-demo-note" role="status">
                Đăng ký thành công! Nhập email và mật khẩu vừa tạo
                để đăng nhập.
              </div>
            ) : null}

            {confirmationSent && (
              <div className="discover-demo-note auth-success-note" role="status" aria-live="polite">
                Đã gửi lại email xác nhận. Hãy kiểm tra cả hộp thư rác.
              </div>
            )}

            {error && (
              <div ref={errorRef} className="form-error-banner auth-error-summary" role="alert" tabIndex="-1">
                <strong>{error}</strong>
                {Object.keys(fieldErrors).length > 0 && (
                  <ul>
                    {Object.entries(fieldErrors).map(([field, message]) => (
                      <li key={field}><a href={`#login-${field}`}>{message}</a></li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="login-field">
                <label htmlFor="login-email">Email</label>

                <div className="login-input-wrapper">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <rect x="3" y="5" width="18" height="14" rx="3" />
                    <path d="m3 7 9 6 9-6" />
                  </svg>

                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    placeholder="tenban@example.com"
                    value={email}
                    onChange={(event) => handleFieldChange('email', event.target.value)}
                    autoComplete="username"
                    disabled={isLoading}
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
                  />
                </div>
                {fieldErrors.email && <small id="login-email-error" className="auth-field-error">{fieldErrors.email}</small>}
              </div>

              <div className="login-field">
                <div className="login-label-row">
                  <label htmlFor="login-password">Mật khẩu</label>
                  <Link className="forgot-password" to="/forgot-password">
                    Quên mật khẩu?
                  </Link>
                </div>

                <PasswordFlashlightInput
                  id="login-password"
                  name="password"
                  value={password}
                  onChange={(event) => handleFieldChange('password', event.target.value)}
                  placeholder="Nhập mật khẩu đã đăng ký"
                  autoComplete="current-password"
                  disabled={isLoading}
                  invalid={Boolean(fieldErrors.password)}
                  describedBy={fieldErrors.password ? 'login-password-error' : undefined}
                  variant="login"
                />
                {fieldErrors.password && <small id="login-password-error" className="auth-field-error">{fieldErrors.password}</small>}
              </div>

              <button
                type="submit"
                className="login-submit"
                disabled={isLoading}
              >
                {isLoading ? 'Đang đăng nhập…' : 'Đăng nhập'}
                {!isLoading && <span aria-hidden="true">→</span>}
              </button>
            </form>

            {needsEmailConfirmation && (
              <div className="auth-resend-row">
                <span>Chưa nhận được email xác nhận?</span>
                <button
                  type="button"
                  className="auth-text-button"
                  onClick={handleResendConfirmation}
                  disabled={isResending}
                >
                  {isResending ? 'Đang gửi…' : 'Gửi lại email'}
                </button>
              </div>
            )}

            <div className="login-register">
              <span>Chưa có tài khoản?</span>
              <Link to="/register">Đăng ký tài khoản</Link>
            </div>

            <p className="login-safety">
              Tài khoản và hồ sơ được đồng bộ an toàn qua Supabase.
              Cậu có thể đăng nhập trên thiết bị khác.
            </p>
          </div>
        </div>
      </section>
    </Layout>
  )
}
