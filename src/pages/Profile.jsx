import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useBlocker, useLocation } from 'react-router-dom'
import AppLayout, { Icon } from '../components/AppLayout'
import { getCurrentAccount } from '../auth'
import { supabase } from '../lib/supabaseClient'
import TrustBadge from '../components/TrustBadge'
import { getTrustSignal } from '../lib/trustSignals'
import DataRecoveryState from '../components/DataRecoveryState'
import AccountDangerZone from '../components/AccountDangerZone'
import AccountDataExport from '../components/AccountDataExport'
import {
  AVAILABILITY_OPTIONS,
  COLLABORATION_STYLE_OPTIONS,
  COMMITMENT_LEVEL_OPTIONS,
  getPreferenceOption,
  normalizeAvailabilitySlots,
} from '../lib/matchingPreferences'
import {
  getProximityScopeOption,
  normalizeProximityScope,
  PROXIMITY_SCOPE_OPTIONS,
} from '../lib/proximityMatching'
import { VIETNAM_LOCATIONS } from '../data/vietnamLocations'
import {
  getProfileReadiness,
  getPurposeDestination,
  REQUIRED_PROFILE_FIELDS,
} from '../lib/profileReadiness'
import { shouldBlockProfileNavigation } from '../lib/profileNavigationGuard'

const defaultProfile = {
  fullName: '',
  university: '',
  major: '',
  studyYear: '',
  gender: '',
  purpose: '',
  bio: '',
  city: '',
  area: '',
  publicLocation: '',
  proximityScope: 'same_city',
  availabilitySlots: [],
  collaborationStyle: '',
  commitmentLevel: '',
  acceptingConnections: true,
}

const selectOptions = {
  studyYear: ['Năm 1', 'Năm 2', 'Năm 3', 'Năm 4', 'Khác'],
  gender: ['Nam', 'Nữ', 'Khác', 'Không muốn công khai'],
  purpose: ['Học nhóm', 'Team Project', 'Ghép trọ'],
}

const requiredFields = REQUIRED_PROFILE_FIELDS.map((field) => field.key)
const fieldLabels = Object.fromEntries(
  REQUIRED_PROFILE_FIELDS.map((field) => [field.key, field.label])
)

function profileFromSupabase(profile) {
  if (!profile) return { ...defaultProfile }

  return {
    fullName: profile.full_name || '',
    university: profile.university || '',
    major: profile.major || '',
    studyYear: profile.study_year || '',
    gender: profile.gender || '',
    purpose: profile.purpose || '',
    bio: (profile.bio || '').slice(0, 180),
    city: profile.city || '',
    area: profile.area || '',
    publicLocation: profile.public_location || '',
    proximityScope: normalizeProximityScope(profile.proximity_scope),
    availabilitySlots: normalizeAvailabilitySlots(profile.availability_slots),
    collaborationStyle: profile.collaboration_style || '',
    commitmentLevel: profile.commitment_level || '',
    acceptingConnections: profile.accepting_connections !== false,
  }
}

function getProfileErrorMessage(error, action) {
  const message = error?.message?.toLowerCase() || ''

  if (message.includes('row-level security')) {
    return `Không thể ${action} hồ sơ do quyền truy cập. Hãy đăng nhập lại và thử lại.`
  }

  return `Không thể ${action} hồ sơ. Hãy thử lại sau.`
}

export default function Profile({ onAccountDeleted }) {
  const location = useLocation()
  const [formData, setFormData] = useState(() => ({ ...defaultProfile }))
  const [savedProfile, setSavedProfile] = useState(() => ({ ...defaultProfile }))
  const [saved, setSaved] = useState(false)
  const [trustProfile, setTrustProfile] = useState({
    email_confirmed: false,
    education_email: false,
    verification_status: 'unverified',
  })
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [privateProfile, setPrivateProfile] = useState({
    phone: null,
    exact_address: null,
    hide_phone: true,
    hide_exact_address: true,
  })
  const [phone, setPhone] = useState('')
  const [savedPhone, setSavedPhone] = useState('')
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const statusRef = useRef(null)
  const connectionAvailabilityRef = useRef(null)
  const profileMountedRef = useRef(false)
  const leaveDialogRef = useRef(null)
  const stayButtonRef = useRef(null)
  const blockedNavigationTriggerRef = useRef(null)

  const isDirty = JSON.stringify(formData) !== JSON.stringify(savedProfile) ||
    phone !== savedPhone
  const blockProfileNavigation = useCallback(
    ({ currentLocation, nextLocation }) => shouldBlockProfileNavigation({
      isDirty,
      currentPathname: currentLocation.pathname,
      nextPathname: nextLocation.pathname,
    }),
    [isDirty]
  )
  const blocker = useBlocker(blockProfileNavigation)

  const readiness = getProfileReadiness(formData)
  const completion = readiness.completionPercent
  const isPersistedReady = readiness.isReady && !isDirty
  const purposeDestination = getPurposeDestination(formData.purpose)
  const showWelcome = location.state?.welcome === true ||
    new URLSearchParams(location.search).get('welcome') === '1'

  const lastName = formData.fullName.trim().split(/\s+/).pop()
  const avatarLetter = lastName ? lastName[0].toUpperCase() : '?'
  const collaborationStyle = getPreferenceOption(
    COLLABORATION_STYLE_OPTIONS,
    formData.collaborationStyle
  )
  const commitmentLevel = getPreferenceOption(
    COMMITMENT_LEVEL_OPTIONS,
    formData.commitmentLevel
  )

  const loadProfile = useCallback(async () => {
    setIsLoadingProfile(true)
    setLoadError('')

    try {
      const user = await getCurrentAccount()

      if (!user) {
        throw new Error('Phiên đăng nhập đã hết.')
      }

      const [{ data: publicProfile, error: publicError }, { data: privateData, error: privateError }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, university, major, study_year, gender, purpose, bio, city, area, public_location, proximity_scope, availability_slots, collaboration_style, commitment_level, accepting_connections, email_confirmed, education_email, verification_status')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('profile_private')
          .select('phone, exact_address, hide_phone, hide_exact_address')
          .eq('profile_id', user.id)
          .maybeSingle(),
      ])

      if (publicError) throw publicError
      if (privateError) throw privateError

      const loadedProfile = profileFromSupabase(publicProfile)

      if (profileMountedRef.current) {
        setFormData(loadedProfile)
        setSavedProfile(loadedProfile)
        setTrustProfile({
          email_confirmed: publicProfile?.email_confirmed === true,
          education_email: publicProfile?.education_email === true,
          verification_status: publicProfile?.verification_status || 'unverified',
        })
        setPrivateProfile(privateData || {
          phone: null,
          exact_address: null,
          hide_phone: true,
          hide_exact_address: true,
        })
        setPhone(privateData?.phone || '')
        setSavedPhone(privateData?.phone || '')
        setSaved(false)
        setError('')
        setLoadError('')
      }
    } catch (profileLoadError) {
      if (profileMountedRef.current) {
        setLoadError(getProfileErrorMessage(profileLoadError, 'tải'))
      }
    } finally {
      if (profileMountedRef.current) setIsLoadingProfile(false)
    }
  }, [])

  useEffect(() => {
    profileMountedRef.current = true
    void Promise.resolve().then(loadProfile)

    return () => {
      profileMountedRef.current = false
    }
  }, [loadProfile])

  useEffect(() => {
    function handleBeforeUnload(event) {
      if (!isDirty) return

      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  useEffect(() => {
    if (blocker.state !== 'blocked') return undefined

    blockedNavigationTriggerRef.current = document.activeElement
    const focusFrame = window.requestAnimationFrame(() => {
      stayButtonRef.current?.focus({ preventScroll: true })
    })

    function handleDialogKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        blocker.reset()
        window.requestAnimationFrame(() => {
          blockedNavigationTriggerRef.current?.focus?.({ preventScroll: true })
        })
        return
      }

      if (event.key !== 'Tab') return

      const focusable = leaveDialogRef.current?.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
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

    document.addEventListener('keydown', handleDialogKeyDown)

    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleDialogKeyDown)
    }
  }, [blocker])

  useEffect(() => {
    if (error) {
      statusRef.current?.focus({ preventScroll: true })
    }
  }, [error])

  useEffect(() => {
    if (isLoadingProfile || location.hash !== '#connection-availability') return

    const frame = window.requestAnimationFrame(() => {
      const section = connectionAvailabilityRef.current
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

      section?.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'center',
      })
      section?.querySelector('input')?.focus({ preventScroll: true })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [isLoadingProfile, location.hash])

  function validateForm(data) {
    const nextErrors = {}

    for (const field of getProfileReadiness(data).missingFields) {
      nextErrors[field.key] = `${field.label} là thông tin bắt buộc.`
    }

    return nextErrors
  }

  function handleChange(event) {
    const { name, value } = event.target

    if (name === 'phone') {
      setPhone(value)
    } else {
      setFormData((current) => ({
        ...current,
        [name]: value,
      }))
    }

    setSaved(false)
    setError('')
    setFieldErrors((current) => {
      if (!current[name]) return current

      const next = { ...current }
      delete next[name]
      return next
    })
  }

  function handleAvailabilityChange(event) {
    const { checked, value } = event.target

    setFormData((current) => ({
      ...current,
      availabilitySlots: checked
        ? normalizeAvailabilitySlots([...current.availabilitySlots, value])
        : current.availabilitySlots.filter((slot) => slot !== value),
    }))
    setSaved(false)
    setError('')
  }

  function handleBlur(event) {
    const { name, value } = event.target

    if (name === 'phone') {
      const normalizedPhone = value.replace(/[ .-]/g, '')
      const isValidPhone = !value.trim() ||
        /^0\d{9}$/.test(normalizedPhone) ||
        /^\+84\d{9}$/.test(normalizedPhone)

      setFieldErrors((current) => {
        const next = { ...current }

        if (isValidPhone) {
          delete next.phone
        } else {
          next.phone = 'Số điện thoại cần có dạng 0xxxxxxxxx hoặc +84xxxxxxxxx.'
        }

        return next
      })
      return
    }

    if (requiredFields.includes(name) && !value.trim()) {
      setFieldErrors((current) => ({
        ...current,
        [name]: `${fieldLabels[name]} là thông tin bắt buộc.`,
      }))
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (isSaving || isLoadingProfile || loadError) return
    setSaved(false)

    const cleaned = Object.fromEntries(
      Object.entries(formData).map(([key, value]) => [
        key,
        Array.isArray(value)
          ? normalizeAvailabilitySlots(value)
          : typeof value === 'string'
            ? value.trim()
            : value,
      ])
    )

    const cleanedPhone = phone.trim()
    const nextErrors = validateForm(cleaned)
    const normalizedPhone = cleanedPhone.replace(/[ .-]/g, '')
    const isValidPhone = !phone.trim() ||
      /^0\d{9}$/.test(normalizedPhone) ||
      /^\+84\d{9}$/.test(normalizedPhone)

    if (!isValidPhone) {
      nextErrors.phone = 'Số điện thoại cần có dạng 0xxxxxxxxx hoặc +84xxxxxxxxx.'
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors)
      setError(
        Object.keys(nextErrors).every((field) => field === 'phone')
          ? ''
          : 'Hãy bổ sung các thông tin bắt buộc được đánh dấu bên dưới.'
      )
      return
    }

    setIsSaving(true)

    try {
      const user = await getCurrentAccount()

      if (!user) {
        throw new Error('Phiên đăng nhập đã hết.')
      }

      const { data: savedPublicProfile, error: publicError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: cleaned.fullName,
          university: cleaned.university,
          major: cleaned.major,
          study_year: cleaned.studyYear,
          gender: cleaned.gender,
          purpose: cleaned.purpose,
          bio: cleaned.bio,
          city: cleaned.city,
          area: cleaned.area,
          public_location: cleaned.publicLocation,
          proximity_scope: normalizeProximityScope(cleaned.proximityScope),
          availability_slots: cleaned.availabilitySlots,
          collaboration_style: cleaned.collaborationStyle,
          commitment_level: cleaned.commitmentLevel,
          accepting_connections: cleaned.acceptingConnections,
        })
        .select('id, full_name, university, major, study_year, gender, purpose, bio, city, area, public_location, proximity_scope, availability_slots, collaboration_style, commitment_level, accepting_connections, email_confirmed, education_email, verification_status')
        .single()

      if (publicError) throw publicError

      const { data: savedPrivateProfile, error: privateError } = await supabase
        .from('profile_private')
        .upsert({
          profile_id: user.id,
          phone: cleanedPhone || null,
          exact_address: privateProfile.exact_address,
          hide_phone: privateProfile.hide_phone,
          hide_exact_address: privateProfile.hide_exact_address,
        })
        .select('phone, exact_address, hide_phone, hide_exact_address')
        .single()

      if (privateError) throw privateError

      const savedData = profileFromSupabase(savedPublicProfile)
      setFormData(savedData)
      setSavedProfile(savedData)
      setTrustProfile({
        email_confirmed: savedPublicProfile.email_confirmed === true,
        education_email: savedPublicProfile.education_email === true,
        verification_status: savedPublicProfile.verification_status || 'unverified',
      })
      setPrivateProfile(savedPrivateProfile || privateProfile)
      setPhone(savedPrivateProfile?.phone || cleanedPhone)
      setSavedPhone(savedPrivateProfile?.phone || cleanedPhone)
      setFieldErrors({})
      setError('')
      setSaved(true)
      window.dispatchEvent(new CustomEvent('cocoapp:profile-updated', {
        detail: { fullName: savedData.fullName },
      }))
    } catch (saveError) {
      setError(getProfileErrorMessage(saveError, 'lưu'))
    } finally {
      setIsSaving(false)
    }
  }

  function renderSelect(name, label) {
    const errorId = `${name}-error`

    return (
      <label className="profile-field">
        <span>{label} <em>Bắt buộc</em></span>
        <select
          id={`profile-${name}`}
          name={name}
          value={formData[name]}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-invalid={Boolean(fieldErrors[name])}
          aria-describedby={fieldErrors[name] ? errorId : undefined}
        >
          <option value="">Chọn thông tin</option>

          {selectOptions[name].map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {fieldErrors[name] && <small id={errorId} className="profile-field-error">{fieldErrors[name]}</small>}
      </label>
    )
  }

  function renderPreferenceSelect(name, label, options) {
    return (
      <label className="profile-field">
        {fieldLabel(name, label, true)}
        <select id={`profile-${name}`} name={name} value={formData[name]} onChange={handleChange}>
          <option value="">Chưa chọn</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        {formData[name] && (
          <small className="profile-field-hint">
            {getPreferenceOption(options, formData[name])?.description}
          </small>
        )}
      </label>
    )
  }

  function renderProximityScopeSelect() {
    const option = getProximityScopeOption(formData.proximityScope)

    return (
      <label className="profile-field">
        {fieldLabel('proximityScope', 'Phạm vi tìm kiếm')}
        <select
          id="profile-proximityScope"
          name="proximityScope"
          value={formData.proximityScope}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-invalid={Boolean(fieldErrors.proximityScope)}
          aria-describedby={fieldErrors.proximityScope
            ? 'proximity-scope-hint proximity-scope-error'
            : 'proximity-scope-hint'}
        >
          {PROXIMITY_SCOPE_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
        <small id="proximity-scope-hint" className="profile-field-hint">
          {option?.description}
        </small>
        {fieldErrors.proximityScope && (
          <small id="proximity-scope-error" className="profile-field-error">
            {fieldErrors.proximityScope}
          </small>
        )}
      </label>
    )
  }

  function fieldLabel(name, label, optional = false) {
    return <span>{label} <em>{optional ? 'Không bắt buộc' : 'Bắt buộc'}</em></span>
  }

  function stayOnProfile() {
    blocker.reset?.()
    window.requestAnimationFrame(() => {
      blockedNavigationTriggerRef.current?.focus?.({ preventScroll: true })
    })
  }

  function leaveProfile() {
    blocker.proceed?.()
  }

  return (
    <AppLayout>
      <section className="profile-page">
        <header className="profile-page-header profile-hero">
          <div className="profile-hero-copy">
            <span className="profile-hero-label">COCO PROFILE</span>
            <h1>Xây dựng hồ sơ khiến người phù hợp muốn kết nối.</h1>
            <p>
              Thể hiện mục tiêu, kỹ năng và khu vực của cậu. Thông tin
              riêng tư vẫn luôn được bảo vệ.
            </p>
          </div>

          <div className="profile-hero-actions">
            <span className={`profile-visibility ${formData.acceptingConnections ? '' : 'is-paused'}`}>
              <i /> {formData.acceptingConnections
                ? 'Đang nhận kết nối mới'
                : 'Đang tạm dừng kết nối mới'}
            </span>
            <button
              type="submit"
              form="profile-form"
              className="profile-save-button"
              disabled={isLoadingProfile || isSaving || Boolean(loadError)}
            >
              {isSaving ? 'Đang lưu hồ sơ…' : saved ? 'Đã lưu thay đổi' : 'Lưu hồ sơ'}
              <Icon name="arrow" />
            </button>
          </div>

          <div className="profile-hero-art" aria-hidden="true">
            <span>{avatarLetter}</span>
            <i className="profile-art-one" />
            <i className="profile-art-two" />
          </div>
        </header>

        {!isLoadingProfile && !loadError && (
          <div className="profile-insight-row profile-mobile-summary" aria-label="Tóm tắt hồ sơ">
            <div><span>Mức hoàn thiện</span><strong>{completion}%</strong></div>
            <div><span>Mục tiêu</span><strong>{formData.purpose || 'Chưa chọn'}</strong></div>
            <div><span>Khu vực</span><strong>{formData.area || formData.city || 'Chưa điền'}</strong></div>
            <div>
              <span>Khám phá</span>
              <strong>{formData.acceptingConnections ? 'Đang hiển thị' : 'Đã tạm ẩn'}</strong>
            </div>
          </div>
        )}

        {!isLoadingProfile && !loadError && (showWelcome || !isPersistedReady) && (
          <section
            className={`profile-readiness-card ${readiness.isReady ? 'is-ready' : ''}`}
            aria-labelledby="profile-readiness-title"
          >
            <div className="profile-readiness-copy">
              <p>KHỞI ĐỘNG KẾT NỐI</p>
              <h2 id="profile-readiness-title">
                {readiness.isReady
                  ? isDirty
                    ? 'Hồ sơ đã đủ thông tin — lưu để kích hoạt.'
                    : formData.acceptingConnections
                      ? 'Hồ sơ đã sẵn sàng để tìm đúng người.'
                      : 'Hồ sơ đủ thông tin nhưng đang tạm dừng kết nối mới.'
                  : `Còn ${readiness.missingFields.length} mục trước khi cậu có thể kết nối.`}
              </h2>
              <span>
                Coco chỉ cần thông tin công khai đủ rõ; số điện thoại và địa chỉ chính xác không nằm trong checklist này.
              </span>
            </div>

            <div className="profile-readiness-progress">
              <strong>{readiness.completedRequired}/{readiness.requiredTotal}</strong>
              <span>mục bắt buộc</span>
              <div
                role="progressbar"
                aria-label="Tiến độ hồ sơ sẵn sàng kết nối"
                aria-valuemin={0}
                aria-valuemax={readiness.requiredTotal}
                aria-valuenow={readiness.completedRequired}
              >
                <span style={{ width: `${(readiness.completedRequired / readiness.requiredTotal) * 100}%` }} />
              </div>
            </div>

            {readiness.missingFields.length > 0 && (
              <ul className="profile-readiness-missing" aria-label="Thông tin còn thiếu">
                {readiness.missingFields.map((field) => (
                  <li key={field.key}>
                    <a href={`#profile-${field.key}`}>{field.label}</a>
                  </li>
                ))}
              </ul>
            )}

            {readiness.isReady && (
              isDirty ? (
                <button type="submit" form="profile-form" className="profile-readiness-action">
                  Lưu để sẵn sàng <Icon name="arrow" />
                </button>
              ) : !formData.acceptingConnections ? (
                <a href="#connection-availability" className="profile-readiness-action">
                  Bật lại kết nối mới <Icon name="arrow" />
                </a>
              ) : (
                <Link to={purposeDestination} className="profile-readiness-action">
                  Bắt đầu {formData.purpose.toLowerCase()} <Icon name="arrow" />
                </Link>
              )
            )}
          </section>
        )}

        {isLoadingProfile && (
          <div className="profile-loading-message" role="status" aria-live="polite">
            Đang tải hồ sơ…
          </div>
        )}

        {loadError && !isLoadingProfile && (
          <DataRecoveryState
            title="Hồ sơ chưa được tải an toàn"
            message={`${loadError} Form được khóa để tránh lưu đè dữ liệu đang có.`}
            onRetry={loadProfile}
            isRetrying={isLoadingProfile}
          />
        )}

        {error && (
          <div ref={statusRef} className="form-error-banner" role="alert" aria-live="assertive" tabIndex="-1">
            {error}
          </div>
        )}

        {saved && (
          <div className="profile-success-message" role="status" aria-live="polite">
            <span>
              {formData.acceptingConnections
                ? 'Đã lưu hồ sơ vào Supabase. Hồ sơ của cậu đang nhận kết nối mới.'
                : 'Đã lưu. Hồ sơ được ẩn khỏi Khám phá; kết nối và tin nhắn hiện có vẫn giữ nguyên.'}
            </span>
            {formData.acceptingConnections && (
              <Link to={purposeDestination}>
                Tìm người cho {formData.purpose.toLowerCase()} <Icon name="arrow" />
              </Link>
            )}
          </div>
        )}

        {isDirty && !loadError && (
          <div className="profile-unsaved-notice" role="status" aria-live="polite">
            <span><Icon name="profile" /> Cậu có thay đổi chưa được lưu.</span>
            <button type="submit" form="profile-form">Lưu thay đổi</button>
          </div>
        )}

        {!isLoadingProfile && !loadError && <div className="profile-layout">
          <aside className="profile-summary-card">
            <div className="profile-avatar-large">
              {avatarLetter}
            </div>

            <h2>{formData.fullName || 'Hồ sơ của cậu'}</h2>
            <p>{formData.major || 'Chưa điền ngành học'}</p>

            <div className="profile-trust-summary" aria-live="polite">
              <p>Coco Trust</p>
              <TrustBadge profile={trustProfile} />
              <small>{getTrustSignal(trustProfile).description}</small>
            </div>

            <div className="profile-completion">
              <div className="completion-heading">
                <span>Mức độ phong phú hồ sơ</span>
                <strong>{completion}%</strong>
              </div>

              <div
                className="completion-track"
                role="progressbar"
                aria-label="Mức độ hoàn thiện hồ sơ"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={completion}
              >
                <span style={{ width: `${completion}%` }} />
              </div>
            </div>

            <div className="profile-summary-information">
              <div>
                <span>Trường</span>
                <strong>{formData.university || 'Chưa điền'}</strong>
              </div>
              <div>
                <span>Năm học</span>
                <strong>{formData.studyYear || 'Chưa chọn'}</strong>
              </div>
              <div>
                <span>Giới tính</span>
                <strong>{formData.gender || 'Chưa chọn'}</strong>
              </div>
              <div>
                <span>Mục tiêu</span>
                <strong>{formData.purpose || 'Chưa chọn'}</strong>
              </div>
              <div>
                <span>Cách cộng tác</span>
                <strong>{collaborationStyle?.label || 'Chưa chọn'}</strong>
              </div>
              <div>
                <span>Mức cam kết</span>
                <strong>{commitmentLevel?.label || 'Chưa chọn'}</strong>
              </div>
            </div>
          </aside>

          <form
            id="profile-form"
            className="profile-form-card"
            onSubmit={handleSubmit}
            aria-busy={isLoadingProfile || isSaving}
            noValidate
          >
            <div className="profile-form-section">
              <div className="profile-section-heading">
                <span>01</span>
                <div>
                  <h2>Thông tin cơ bản</h2>
                  <p>
                    Phần tóm tắt bên trái thay đổi theo nội dung đang nhập.
                    Bấm Lưu để giữ thay đổi.
                  </p>
                </div>
              </div>

              <div className="profile-form-grid">
                <label className="profile-field">
                  {fieldLabel('fullName', 'Họ và tên')}
                  <input
                    id="profile-fullName"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    aria-invalid={Boolean(fieldErrors.fullName)}
                    aria-describedby={fieldErrors.fullName ? 'fullName-error' : undefined}
                    placeholder="Tên sinh viên mẫu"
                    maxLength={80}
                  />
                  {fieldErrors.fullName && <small id="fullName-error" className="profile-field-error">{fieldErrors.fullName}</small>}
                </label>

                <label className="profile-field">
                  {fieldLabel('university', 'Trường đại học')}
                  <input
                    id="profile-university"
                    name="university"
                    value={formData.university}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    aria-invalid={Boolean(fieldErrors.university)}
                    aria-describedby={fieldErrors.university ? 'university-error' : undefined}
                    placeholder="Nhập tên trường"
                    maxLength={120}
                  />
                  {fieldErrors.university && <small id="university-error" className="profile-field-error">{fieldErrors.university}</small>}
                </label>

                <label className="profile-field">
                  {fieldLabel('major', 'Ngành học')}
                  <input
                    id="profile-major"
                    name="major"
                    value={formData.major}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    aria-invalid={Boolean(fieldErrors.major)}
                    aria-describedby={fieldErrors.major ? 'major-error' : undefined}
                    placeholder="Nhập ngành học"
                    maxLength={100}
                  />
                  {fieldErrors.major && <small id="major-error" className="profile-field-error">{fieldErrors.major}</small>}
                </label>

                {renderSelect('studyYear', 'Năm học')}
              </div>

              <label className="profile-field profile-field-full">
                {fieldLabel('bio', 'Giới thiệu ngắn', true)}
                <textarea
                  id="profile-bio"
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Ví dụ: Mình tìm bạn cùng ôn Cấu trúc dữ liệu."
                  maxLength={180}
                />
                <small>{formData.bio.length}/180 ký tự</small>
              </label>
            </div>

            <div className="profile-form-section">
              <div className="profile-section-heading">
                <span>02</span>
                <div>
                  <h2>Giới tính và mục tiêu</h2>
                  <p>Chọn mục tiêu để nhận gợi ý phù hợp hơn.</p>
                </div>
              </div>

              <div className="profile-form-grid">
                {renderSelect('gender', 'Giới tính')}
                {renderSelect('purpose', 'Mục tiêu hiện tại')}
              </div>

              <div className="gender-safety-note">
                <p>
                  <Icon name="room" />
                  Lọc cùng giới tính là quy tắc ghép trọ của bản
                  demo, không phải xác minh danh tính hay bảo đảm
                  an toàn. Không áp dụng giới hạn này cho học nhóm
                  và team project.
                </p>
              </div>
            </div>

            <div className="profile-form-section">
              <div className="profile-section-heading">
                <span>03</span>
                <div>
                  <h2>Nhịp làm việc phù hợp</h2>
                  <p>Chia sẻ khung giờ rộng và cách cộng tác để Coco Fit tìm điểm chung thực tế hơn.</p>
                </div>
              </div>

              <fieldset className="profile-choice-field" aria-describedby="availability-help">
                <legend>
                  Khung giờ thường rảnh <em>Không bắt buộc</em>
                </legend>
                <p id="availability-help">
                  Chỉ chọn buổi chung; không nhập lịch học, phòng học hoặc địa điểm cụ thể.
                </p>
                <div className="profile-choice-list">
                  {AVAILABILITY_OPTIONS.map((option) => (
                    <label className="profile-choice-card" key={option.value}>
                      <input
                        type="checkbox"
                        value={option.value}
                        checked={formData.availabilitySlots.includes(option.value)}
                        onChange={handleAvailabilityChange}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="profile-form-grid profile-preference-grid">
                {renderPreferenceSelect(
                  'collaborationStyle',
                  'Phong cách cộng tác',
                  COLLABORATION_STYLE_OPTIONS
                )}
                {renderPreferenceSelect(
                  'commitmentLevel',
                  'Mức cam kết mỗi tuần',
                  COMMITMENT_LEVEL_OPTIONS
                )}
              </div>

              <div className="profile-preference-note">
                <Icon name="spark" />
                <p>
                  Coco chỉ dùng các lựa chọn công khai này để giải thích điểm chung.
                  Đây không phải điểm đánh giá con người hay cam kết bắt buộc.
                </p>
              </div>
            </div>

            <div className="profile-form-section">
              <div className="profile-section-heading">
                <span>04</span>
                <div>
                  <h2>Khu vực và quyền riêng tư</h2>
                  <p>Số điện thoại và địa chỉ chính xác được bảo vệ riêng tư.</p>
                </div>
              </div>

                           <div className="profile-form-grid">
                <label className="profile-field">
                  {fieldLabel('city', 'Tỉnh / Thành phố')}
                  <input
                    id="profile-city"
                    name="city"
                    list="profile-city-options"
                    value={formData.city}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    aria-invalid={Boolean(fieldErrors.city)}
                    aria-describedby={fieldErrors.city ? 'city-error' : undefined}
                    placeholder="Ví dụ: Hà Nội"
                    maxLength={80}
                  />
                  <datalist id="profile-city-options">
                    {VIETNAM_LOCATIONS.map((location) => (
                      <option key={location} value={location} />
                    ))}
                  </datalist>
                  {fieldErrors.city && <small id="city-error" className="profile-field-error">{fieldErrors.city}</small>}
                </label>

                <label className="profile-field">
                  {fieldLabel('area', 'Khu vực trong tỉnh / thành phố')}
                  <input
                    id="profile-area"
                    name="area"
                    value={formData.area}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    aria-invalid={Boolean(fieldErrors.area)}
                    aria-describedby={fieldErrors.area ? 'area-hint area-error' : 'area-hint'}
                    placeholder="Ví dụ: Cầu Giấy"
                    maxLength={100}
                  />
                  <small id="area-hint" className="profile-field-hint">
                    Chỉ nhập một quận, huyện hoặc khu vực rộng; không nhập số nhà.
                  </small>
                  {fieldErrors.area && <small id="area-error" className="profile-field-error">{fieldErrors.area}</small>}
                </label>

                <label className="profile-field">
                  {fieldLabel('publicLocation', 'Tên đường hoặc địa danh gần đó', true)}
                  <input
                    id="profile-publicLocation"
                    name="publicLocation"
                    value={formData.publicLocation}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    aria-describedby="public-location-hint"
                    placeholder="Ví dụ: gần trường, tên đường"
                    maxLength={160}
                  />
                  <small id="public-location-hint" className="profile-field-hint">
                    Chỉ ghi địa danh rộng; không nhập số nhà, phòng trọ hoặc vị trí hiện tại.
                  </small>
                </label>

                <label className="profile-field">
                  {fieldLabel('phone', 'Số điện thoại', true)}
                  <input
                    id="profile-phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    aria-invalid={Boolean(fieldErrors.phone)}
                    aria-describedby={fieldErrors.phone ? 'phone-error' : undefined}
                    placeholder="Ví dụ: 0912 345 678"
                    maxLength={20}
                  />
                  {fieldErrors.phone && <small id="phone-error" className="profile-field-error">{fieldErrors.phone}</small>}
                </label>

                {renderProximityScopeSelect()}
              </div>

              <div className="profile-preference-note">
                <Icon name="discover" />
                <p>
                  Coco chỉ so khớp tỉnh/thành phố và khu vực gần đúng. Ứng dụng
                  không thu GPS hoặc đọc trường địa chỉ chính xác khi khám phá.
                </p>
              </div>

              <div className="privacy-options">
                <label
                  ref={connectionAvailabilityRef}
                  id="connection-availability"
                  className={`privacy-option privacy-availability-option ${formData.acceptingConnections ? 'is-active' : 'is-paused'}`}
                >
                  <div>
                    <strong><Icon name="discover" /> Nhận kết nối mới</strong>
                    <span id="connection-availability-description">
                      {formData.acceptingConnections
                        ? 'Hồ sơ đủ thông tin có thể xuất hiện trong Khám phá và gửi hoặc nhận lời mời mới.'
                        : 'Hồ sơ bị ẩn khỏi Khám phá. Các kết nối, Coco Plan và tin nhắn hiện có không bị xóa.'}
                    </span>
                  </div>
                  <span className="profile-switch-control">
                    <input
                      type="checkbox"
                      name="acceptingConnections"
                      checked={formData.acceptingConnections}
                      onChange={(event) => {
                        setFormData((current) => ({
                          ...current,
                          acceptingConnections: event.target.checked,
                        }))
                        setSaved(false)
                        setError('')
                      }}
                      aria-describedby="connection-availability-description"
                    />
                    <span aria-hidden="true"><i /></span>
                    <em>{formData.acceptingConnections ? 'Đang bật' : 'Đã tắt'}</em>
                  </span>
                </label>

                <div className="privacy-option">
                  <div>
                      <strong><Icon name="profile" /> Không công khai số điện thoại</strong>
                    <span>
                        Số điện thoại được lưu riêng tư và chỉ cậu có thể xem hoặc chỉnh sửa.
                    </span>
                  </div>
                  <span>Luôn bật</span>
                </div>

                <div className="privacy-option">
                  <div>
                      <strong><Icon name="room" /> Không công khai địa chỉ chính xác</strong>
                    <span>
                      Chỉ nhập địa danh gần đó hoặc tên đường.
                    </span>
                  </div>
                  <span>Luôn bật</span>
                </div>
              </div>
            </div>
          </form>
          <AccountDataExport />
          <AccountDangerZone onAccountDeleted={onAccountDeleted} />
        </div>}
      </section>

      {blocker.state === 'blocked' && (
        <div
          className="discover-dialog-backdrop profile-leave-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) stayOnProfile()
          }}
        >
          <section
            ref={leaveDialogRef}
            className="discover-profile-dialog profile-leave-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="profile-leave-title"
            aria-describedby="profile-leave-description"
            tabIndex="-1"
          >
            <div className="discover-dialog-body profile-leave-dialog-body">
              <p className="discover-dialog-kicker">THAY ĐỔI CHƯA LƯU</p>
              <h2 id="profile-leave-title">Rời Hồ sơ và bỏ thay đổi?</h2>
              <p id="profile-leave-description">
                Nội dung cậu vừa sửa chưa được lưu. Ở lại để lưu hồ sơ, hoặc rời trang và bỏ các thay đổi này.
              </p>
            </div>
            <footer className="discover-dialog-actions profile-leave-dialog-actions">
              <button
                ref={stayButtonRef}
                type="button"
                className="view-student-button"
                onClick={stayOnProfile}
              >
                Ở lại chỉnh sửa
              </button>
              <button
                type="button"
                className="safety-danger-button"
                onClick={leaveProfile}
              >
                Rời trang
              </button>
            </footer>
          </section>
        </div>
      )}
    </AppLayout>
  )
}
