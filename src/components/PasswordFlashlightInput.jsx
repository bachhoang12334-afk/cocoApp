import { useRef, useState } from 'react'

function EyeIcon({ isActive }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.8" />
      {isActive && <path d="m4 4 16 16" />}
    </svg>
  )
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <rect x="4" y="10" width="16" height="11" rx="3" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

export default function PasswordFlashlightInput({
  id,
  name,
  value,
  onChange,
  placeholder,
  autoComplete,
  disabled = false,
  invalid = false,
  describedBy,
  minLength,
  maxLength,
  variant = 'register',
}) {
  const [isFlashlightOn, setIsFlashlightOn] = useState(false)
  const [isKeyboardReveal, setIsKeyboardReveal] = useState(false)
  const wrapperRef = useRef(null)
  const maskedValue = '•'.repeat([...value].length)

  function handlePointerMove(event) {
    if (!isFlashlightOn || event.pointerType === 'touch') return

    const wrapper = wrapperRef.current
    if (!wrapper) return

    const bounds = wrapper.getBoundingClientRect()
    const x = Math.max(0, Math.min(event.clientX - bounds.left, bounds.width))
    const y = Math.max(0, Math.min(event.clientY - bounds.top, bounds.height))

    wrapper.style.setProperty('--password-spot-x', `${x}px`)
    wrapper.style.setProperty('--password-spot-y', `${y}px`)
    wrapper.dataset.coco = y <= bounds.height * 0.34 ? 'true' : 'false'
    wrapper.dataset.pointerInside = 'true'
  }

  function handlePointerLeave() {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    wrapper.dataset.coco = 'false'
    wrapper.dataset.pointerInside = 'false'
  }

  function handleInputScroll(event) {
    wrapperRef.current?.style.setProperty(
      '--password-scroll',
      `${-event.currentTarget.scrollLeft}px`
    )
  }

  function toggleFlashlight(event) {
    const nextState = !isFlashlightOn
    setIsFlashlightOn(nextState)
    setIsKeyboardReveal(nextState && event.detail === 0)

    if (!nextState && wrapperRef.current) {
      wrapperRef.current.dataset.coco = 'false'
      wrapperRef.current.dataset.pointerInside = 'false'
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape' && isFlashlightOn) {
      setIsFlashlightOn(false)
      setIsKeyboardReveal(false)
    }
  }

  return (
    <div
      ref={wrapperRef}
      className={`password-flashlight ${variant === 'login' ? 'login-input-wrapper has-leading-icon' : ''} ${isFlashlightOn ? 'is-flashlight-active' : ''} ${isKeyboardReveal ? 'is-keyboard-reveal' : ''}`}
      data-coco="false"
      data-pointer-inside="false"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onKeyDown={handleKeyDown}
    >
      {variant === 'login' && <LockIcon />}

      <input
        id={id}
        name={name}
        type={isFlashlightOn ? 'text' : 'password'}
        className={variant === 'register' ? 'form-input password-flashlight-input' : 'password-flashlight-input'}
        value={value}
        onChange={onChange}
        onScroll={handleInputScroll}
        placeholder={placeholder}
        autoComplete={autoComplete}
        minLength={minLength}
        maxLength={maxLength}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={describedBy}
      />

      {isFlashlightOn && value && (
        <span className="password-visual-layer" aria-hidden="true">
          <span className="password-mask-layer">{maskedValue}</span>
          <span className="password-reveal-layer">{value}</span>
        </span>
      )}

      <span className="password-coco-orb" aria-hidden="true">
        C<span>.</span>
      </span>

      <button
        type="button"
        className="password-toggle password-eye-button"
        aria-label={isFlashlightOn ? 'Tắt đèn pin mật khẩu' : 'Bật đèn pin mật khẩu'}
        aria-pressed={isFlashlightOn}
        title={isFlashlightOn ? 'Tắt đèn pin mật khẩu' : 'Bật đèn pin mật khẩu'}
        disabled={disabled}
        onPointerDown={(event) => event.preventDefault()}
        onClick={toggleFlashlight}
      >
        <EyeIcon isActive={isFlashlightOn} />
      </button>

      <span className="password-sr-only" aria-live="polite">
        {isFlashlightOn
          ? 'Đèn pin mật khẩu đang bật. Rê chuột trên ô để xem từng vùng; nhấn Escape để tắt.'
          : 'Mật khẩu đang được ẩn.'}
      </span>
    </div>
  )
}
