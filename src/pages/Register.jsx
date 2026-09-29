import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import PasswordFlashlightInput from '../components/PasswordFlashlightInput'
import { registerAccount } from '../auth'

export default function Register() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    university: '',
    password: '',
    confirmPassword: '',
  })

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const errorRef = useRef(null)

  useEffect(() => {
    if (error) errorRef.current?.focus({ preventScroll: true })
  }, [error])

  function handleChange(event) {
    const { name, value } = event.target

    setForm((current) => ({
      ...current,
      [name]: value,
    }))

    setError('')
    setFieldErrors((current) => {
      if (!current[name]) return current
      const next = { ...current }
      delete next[name]
      return next
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (isLoading) return

    setError('')

    const nextErrors = {}
    for (const field of ['fullName', 'email', 'university', 'password', 'confirmPassword']) {
      if (!form[field].trim()) nextErrors[field] = `Hãy nhập ${fields.find((item) => item.name === field)?.label.toLowerCase()}.`
    }

    if (form.password !== form.confirmPassword) {
      nextErrors.confirmPassword = 'Hai ô mật khẩu chưa giống nhau.'
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors)
      setError('Hãy kiểm tra các thông tin được đánh dấu bên dưới.')
      return
    }

    setFieldErrors({})
    setIsLoading(true)

    try {
      const result = await registerAccount({
        fullName: form.fullName,
        email: form.email,
        university: form.university,
        password: form.password,
      })

      navigate('/login', {
        replace: true,
        state: {
          registered: true,
          requiresEmailConfirmation: result.requiresEmailConfirmation,
          email: form.email.trim().toLowerCase(),
        },
      })
    } catch (error) {
      setError(
        error.message ||
          'Không tạo được tài khoản. Hãy thử lại sau.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  const fields = [
    {
      name: 'fullName',
      label: 'Họ và tên',
      type: 'text',
      placeholder: 'Nhập họ và tên',
      autoComplete: 'name',
      maxLength: 80,
    },
    {
      name: 'email',
      label: 'Email',
      type: 'email',
      placeholder: 'tenban@example.com',
      autoComplete: 'email',
      maxLength: 254,
    },
    {
      name: 'university',
      label: 'Trường đại học',
      type: 'text',
      placeholder: 'Nhập tên trường',
      autoComplete: 'organization',
      maxLength: 120,
    },
    {
      name: 'password',
      label: 'Mật khẩu',
      type: 'password',
      placeholder: 'Ít nhất 6 ký tự',
      autoComplete: 'new-password',
      maxLength: 128,
    },
    {
      name: 'confirmPassword',
      label: 'Nhập lại mật khẩu',
      type: 'password',
      placeholder: 'Nhập giống mật khẩu phía trên',
      autoComplete: 'new-password',
      maxLength: 128,
    },
  ]

  return (
    <Layout>
      <div className="login-card-container register-card-container">
        <div className="login-card register-card">
          <header className="card-header">
            <h1 className="card-heading">Bắt đầu với Coco</h1>
            <p className="card-subtitle">
              Tạo tài khoản để tìm người đồng hành.
            </p>
          </header>

          <p className="discover-demo-note" id="register-note">
            Tài khoản và hồ sơ CocoApp được bảo vệ, đồng bộ qua Supabase.
            Cậu có thể tiếp tục trên thiết bị khác sau khi đăng nhập.
          </p>

          {error && (
            <div ref={errorRef} className="form-error-banner auth-error-summary" role="alert" tabIndex="-1">
              <strong>{error}</strong>
              <ul>
                {Object.entries(fieldErrors).map(([field, message]) => (
                  <li key={field}><a href={`#register-${field}`}>{message}</a></li>
                ))}
              </ul>
            </div>
          )}

          <form
            className="login-form register-form"
            onSubmit={handleSubmit}
            aria-describedby="register-note"
            noValidate
          >
            {fields.map((field) => (
              <div className="form-group" key={field.name}>
                <label
                  htmlFor={`register-${field.name}`}
                  className="form-label"
                >
                  {field.label}
                </label>

                {field.type === 'password' ? (
                  <PasswordFlashlightInput
                    id={`register-${field.name}`}
                    name={field.name}
                    value={form[field.name]}
                    onChange={handleChange}
                    placeholder={field.placeholder}
                    autoComplete={field.autoComplete}
                    minLength={6}
                    maxLength={field.maxLength}
                    disabled={isLoading}
                    invalid={Boolean(fieldErrors[field.name])}
                    describedBy={fieldErrors[field.name] ? `register-${field.name}-error` : undefined}
                  />
                ) : (
                  <input
                    id={`register-${field.name}`}
                    name={field.name}
                    type={field.type}
                    className="form-input"
                    value={form[field.name]}
                    onChange={handleChange}
                    placeholder={field.placeholder}
                    autoComplete={field.autoComplete}
                    maxLength={field.maxLength}
                    disabled={isLoading}
                    aria-invalid={Boolean(fieldErrors[field.name])}
                    aria-describedby={fieldErrors[field.name] ? `register-${field.name}-error` : undefined}
                  />
                )}
                {fieldErrors[field.name] && <small id={`register-${field.name}-error`} className="auth-field-error">{fieldErrors[field.name]}</small>}
              </div>
            ))}

            <button
              type="submit"
              className="btn-login"
              disabled={isLoading}
            >
              {isLoading
                ? 'Đang tạo tài khoản…'
                : 'Đăng ký tài khoản →'}
            </button>
          </form>

          <footer className="card-footer">
            <span>Đã có tài khoản?</span>
            <Link to="/login" className="signup-link">
              Đăng nhập
            </Link>
          </footer>
        </div>
      </div>
    </Layout>
  )
}
