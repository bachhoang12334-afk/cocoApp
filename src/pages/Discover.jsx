import { useCallback, useDeferredValue, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AppLayout, { Icon } from '../components/AppLayout'
import { getCurrentAccount } from '../auth'
import { supabase } from '../lib/supabaseClient'
import { VIETNAM_LOCATIONS } from '../data/vietnamLocations'
import { useConnectionRequestRefresh } from '../hooks/useConnectionRequestRefresh'
import SafetyActions from '../components/SafetyActions'
import TrustBadge from '../components/TrustBadge'
import { getTrustSignal } from '../lib/trustSignals'
import { getMatchSignals, sortStudentsByMatch } from '../lib/matchSignals'
import ConnectionInviteDialog from '../components/ConnectionInviteDialog'
import {
  getConnectionInviteError,
  normalizeConnectionInvite,
} from '../lib/connectionInvite'
import DataRecoveryState from '../components/DataRecoveryState'

const purposes = ['Tất cả', 'Học nhóm', 'Team Project', 'Ghép trọ']
const purposeValues = {
  'Học nhóm': 'study_group',
  'Team Project': 'team_project',
  'Ghép trọ': 'roommates',
}

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

function uniqueLocations(values) {
  const result = new Map()

  for (const value of values) {
    if (normalize(value)) {
      result.set(normalize(value), value)
    }
  }

  return [...result.values()]
}

function locationText(student) {
  return `${student.city} · ${student.area} · ${student.location}`
}

function stableNumericId(uuid) {
  let hash = 0

  for (const character of uuid) {
    hash = (hash * 31 + character.charCodeAt(0)) % 2147483647
  }

  return hash || 1
}

function mapProfileToStudent(profile) {
  const major = profile.major?.trim() || 'Chưa cập nhật ngành học'
  const city = profile.city?.trim() || 'Chưa cập nhật tỉnh / thành phố'
  const area = profile.area?.trim() || 'Chưa cập nhật khu vực'

  return {
    id: stableNumericId(profile.id),
    profileId: profile.id,
    name: profile.full_name?.trim() || 'Sinh viên CocoApp',
    gender: profile.gender?.trim() || '',
    major,
    purpose: profile.purpose?.trim() || 'Chưa chọn mục tiêu',
    city,
    area,
    location: profile.public_location?.trim() || area,
    distance: null,
    skills: profile.major?.trim() ? [major] : [],
    about: profile.bio?.trim() || 'Chưa có giới thiệu.',
    email_confirmed: profile.email_confirmed === true,
    education_email: profile.education_email === true,
    verification_status: profile.verification_status || 'unverified',
  }
}

function mapProfilePreferences(profile) {
  return {
    gender: profile?.gender?.trim() || '',
    major: profile?.major?.trim() || '',
    purpose: profile?.purpose?.trim() || '',
    city: profile?.city?.trim() || '',
    area: profile?.area?.trim() || '',
    maxDistance: ['1', '3', '5', '10'].includes(String(profile?.max_distance_km))
      ? String(profile.max_distance_km)
      : '5',
  }
}

function getDiscoverErrorMessage(error) {
  if (error?.message?.toLowerCase().includes('row-level security')) {
    return 'Không thể tải hồ sơ do quyền truy cập. Hãy đăng nhập lại và thử lại.'
  }

  return 'Không thể tải hồ sơ từ Supabase. Hãy thử lại sau.'
}

function requestKey(profileId) {
  return profileId
}

function getRequestErrorMessage(error) {
  const message = error?.message?.toLowerCase() || ''

  if (message.includes('roommate requests require matching genders')) {
    return 'Không thể gửi lời mời ghép trọ vì hai hồ sơ chưa cùng giới tính.'
  }

  if (error?.code === '23505') {
    return 'Đã có lời mời đang chờ hoặc kết nối giữa hai tài khoản.'
  }

  if (message.includes('users cannot connect while blocked')) {
    return 'Không thể kết nối với tài khoản này do cài đặt an toàn.'
  }

  if (message.includes('connection request intro')) {
    return 'Lời nhắn cần có từ 8 đến 240 ký tự và không thể để trống.'
  }

  return 'Chưa gửi được lời mời. Hãy thử lại sau.'
}

export default function Discover({ initialPurpose = 'Tất cả' }) {
  const [profile, setProfile] = useState({
    gender: '',
    major: '',
    purpose: '',
    city: '',
    area: '',
    maxDistance: '5',
  })
  const [students, setStudents] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [purpose, setPurpose] = useState(initialPurpose)
  const [city, setCity] = useState(profile.city || '')
  const [area, setArea] = useState(profile.area || '')
  const [maxDistance, setMaxDistance] = useState('5')
  const [sortMode, setSortMode] = useState('fit')
  const [selectedId, setSelectedId] = useState(null)
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [undoStudent, setUndoStudent] = useState(null)
  const [requestNotice, setRequestNotice] = useState('')
  const [safetyStatus, setSafetyStatus] = useState('')
  const [inviteStudent, setInviteStudent] = useState(null)
  const [inviteMessage, setInviteMessage] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [requestStatuses, setRequestStatuses] = useState({})
  const [sendingIds, setSendingIds] = useState({})
  const [hiddenIds, setHiddenIds] = useState([])
  const dialogRef = useRef(null)
  const lastProfileTriggerRef = useRef(null)
  const inviteTriggerRef = useRef(null)
  const isMountedRef = useRef(false)
  const refreshPromiseRef = useRef(null)
  const hasLoadedProfilesRef = useRef(false)

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
    }
  }, [])

  const loadDiscoverProfiles = useCallback(({ resetPreferences = false } = {}) => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current

    const refreshPromise = (async () => {
      try {
        const user = await getCurrentAccount()

        if (!user) throw new Error('Phiên đăng nhập đã hết.')

        const [ownResult, othersResult, requestResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('gender, major, purpose, city, area, max_distance_km')
            .eq('id', user.id)
            .maybeSingle(),
          supabase.rpc('get_discover_profiles'),
          supabase
            .from('connection_requests')
            .select('recipient_id, requester_id, purpose, status')
            .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`),
        ])

        if (ownResult.error) throw ownResult.error
        if (othersResult.error) throw othersResult.error
        if (requestResult.error) throw requestResult.error

        const preferences = mapProfilePreferences(ownResult.data)

        if (isMountedRef.current) {
          setProfile(preferences)
          if (resetPreferences) {
            setCity(preferences.city)
            setArea(preferences.area)
            setMaxDistance(preferences.maxDistance)
          }
          setStudents((othersResult.data || []).map(mapProfileToStudent))
          setRequestStatuses(Object.fromEntries(
            (requestResult.data || [])
              .filter((item) => item.status === 'pending' || item.status === 'accepted')
              .map((item) => [
                requestKey(
                  item.requester_id === user.id ? item.recipient_id : item.requester_id
                ),
                item.status,
              ])
          ))
          setLoadError('')
          hasLoadedProfilesRef.current = true
        }
      } catch (error) {
        if (isMountedRef.current) {
          if (!hasLoadedProfilesRef.current) setStudents([])
          setLoadError(getDiscoverErrorMessage(error))
        }
      } finally {
        if (isMountedRef.current) setIsLoading(false)
      }
    })()

    refreshPromiseRef.current = refreshPromise
    void refreshPromise.finally(() => {
      if (refreshPromiseRef.current === refreshPromise) {
        refreshPromiseRef.current = null
      }
    })

    return refreshPromise
  }, [])

  useConnectionRequestRefresh(() => loadDiscoverProfiles({
    resetPreferences: !hasLoadedProfilesRef.current,
  }))

  async function retryDiscoverProfiles() {
    setIsLoading(true)
    setLoadError('')
    await loadDiscoverProfiles({
      resetPreferences: !hasLoadedProfilesRef.current,
    })
  }

  const canFilterRoommates = ['Nam', 'Nữ', 'Khác'].includes(profile.gender)

  const cities = uniqueLocations([
    ...VIETNAM_LOCATIONS,
    profile.city,
  ])

  const areas = uniqueLocations([
    ...students
      .filter((student) => !city || normalize(student.city) === normalize(city))
      .map((student) => student.area),
    ...(!city || normalize(city) === normalize(profile.city)
      ? [profile.area]
      : []),
  ])

  const filteredStudents = students.filter((student) => {
    const searchableText = normalize([
      student.name,
      student.major,
      student.city,
      student.area,
      student.location,
      ...student.skills,
    ].join(' '))

    // Quy tắc này áp dụng cả khi đang ở tab Tất cả.
    const genderMatches =
      student.purpose !== 'Ghép trọ' ||
      (canFilterRoommates && student.gender === profile.gender)

    return (
      searchableText.includes(normalize(deferredSearch)) &&
      (purpose === 'Tất cả' || student.purpose === purpose) &&
      (!city || normalize(student.city) === normalize(city)) &&
      (!area || normalize(student.area) === normalize(area)) &&
      (student.distance === null || student.distance <= Number(maxDistance)) &&
      genderMatches &&
      !hiddenIds.includes(student.id)
    )
  })

  const fitPreferences = {
    major: profile.major,
    purpose: purpose === 'Tất cả' ? profile.purpose : purpose,
    city: city || profile.city,
    area: area || (!city || normalize(city) === normalize(profile.city)
      ? profile.area
      : ''),
  }

  const rankedStudents = sortMode === 'fit'
    ? sortStudentsByMatch(filteredStudents, fitPreferences)
    : filteredStudents.map((student) => ({
        ...student,
        fit: getMatchSignals(fitPreferences, student),
      }))

  const selectedStudent = rankedStudents.find(
    (student) => student.id === selectedId
  )

  useEffect(() => {
    if (!selectedStudent) return undefined

    dialogRef.current?.focus({ preventScroll: true })

    function handleEscape(event) {
      if (event.key === 'Escape') {
        closeProfile()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [selectedStudent])

  function openProfile(studentId) {
    lastProfileTriggerRef.current = document.activeElement
    setSelectedId(studentId)
  }

  function closeProfile(restoreFocus = true) {
    setSelectedId(null)
    if (restoreFocus) {
      lastProfileTriggerRef.current?.focus({ preventScroll: true })
    }
  }

  function skipProfile() {
    if (!selectedStudent) return

    setHiddenIds((current) => [...current, selectedStudent.id])
    setUndoStudent(selectedStudent)
    closeProfile(false)
  }

  function openInvite(student) {
    const currentStatus = requestStatuses[requestKey(student.profileId)]
    if (currentStatus === 'pending' || currentStatus === 'accepted') return

    inviteTriggerRef.current = selectedStudent
      ? lastProfileTriggerRef.current
      : document.activeElement
    if (selectedStudent) closeProfile(false)
    setInviteStudent(student)
    setInviteMessage('')
    setInviteError('')
    setRequestNotice('')
  }

  const closeInvite = useCallback((restoreFocus = true) => {
    setInviteStudent(null)
    setInviteMessage('')
    setInviteError('')

    if (restoreFocus) {
      window.requestAnimationFrame(() => {
        inviteTriggerRef.current?.focus({ preventScroll: true })
      })
    }
  }, [])

  function updateInviteMessage(value) {
    setInviteMessage(value)
    if (inviteError) setInviteError('')
  }

  async function sendInvite(event) {
    event.preventDefault()
    const student = inviteStudent
    if (!student || !purposeValues[student.purpose]) return

    const messageError = getConnectionInviteError(inviteMessage)
    if (messageError) {
      setInviteError(messageError)
      return
    }

    const key = requestKey(student.profileId)
    const status = requestStatuses[key]

    if (status === 'pending' || status === 'accepted' || sendingIds[key]) return

    setSendingIds((current) => ({ ...current, [key]: true }))
    setRequestNotice('')

    try {
      const user = await getCurrentAccount()
      if (!user) throw new Error('Phiên đăng nhập đã hết.')

      const { error } = await supabase
        .from('connection_requests')
        .insert({
          requester_id: user.id,
          recipient_id: student.profileId,
          purpose: purposeValues[student.purpose],
          status: 'pending',
          intro_message: normalizeConnectionInvite(inviteMessage),
        })

      if (error) throw error

      setRequestStatuses((current) => ({ ...current, [key]: 'pending' }))
      setRequestNotice(`Đã gửi lời mời có lời nhắn tới ${student.name}.`)
      closeInvite()
    } catch (error) {
      setInviteError(getRequestErrorMessage(error))
    } finally {
      setSendingIds((current) => {
        const next = { ...current }
        delete next[key]
        return next
      })
    }
  }

  function resetFilters() {
    setSearch('')
    setPurpose('Tất cả')
    setCity('')
    setArea('')
    setMaxDistance('10')
    setHiddenIds([])
    setUndoStudent(null)
    closeProfile(false)
  }

  function handleBlocked(profileId, name) {
    setStudents((current) => current.filter((student) => student.profileId !== profileId))
    setSelectedId(null)
    setSafetyStatus(`Đã chặn ${name}. Lời mời hoặc kết nối hiện tại đã được đóng.`)
  }

  function handleReported(_profileId, name) {
    setSafetyStatus(`Đã gửi báo cáo về ${name}. Nội dung báo cáo được giữ kín.`)
  }

  return (
    <AppLayout>
      <section className="discover-page">
        <header className="discover-header">
          <div>
            <p className="page-eyebrow">KHÁM PHÁ</p>
            <h1>Những kết nối phù hợp đang ở ngay quanh cậu.</h1>
            <p>Tìm theo mục tiêu, kỹ năng và khu vực — không phải lướt ngẫu nhiên.</p>
          </div>
          <div className="discover-head-actions">
            <span aria-live="polite"><strong>{filteredStudents.length}</strong> kết quả phù hợp</span>
            <Link to="/profile" className="secondary-action">Cập nhật tiêu chí</Link>
          </div>
        </header>

        <p className="discover-demo-note">
          Hồ sơ sinh viên được tải từ Supabase.
          Khoảng cách sẽ được bổ sung khi có dữ liệu vị trí phù hợp.
          Lời mời được lưu trên Supabase.
        </p>

        <div className="discover-trust-bar">
          <div><span><Icon name="profile" /></span><strong>Ẩn số điện thoại</strong><small>Chỉ chia sẻ khi cậu muốn</small></div>
          <div><span><Icon name="room" /></span><strong>Vị trí gần đúng</strong><small>Không hiển thị số nhà</small></div>
          <div><span><Icon name="discover" /></span><strong>Lọc theo mục tiêu</strong><small>Học tập, dự án hoặc ghép trọ</small></div>
        </div>

        {isLoading && (
          <div className="form-error-banner" role="status" aria-live="polite">
            Đang tải hồ sơ từ Supabase…
          </div>
        )}

        {loadError && !isLoading && (
          <DataRecoveryState
            title="Chưa làm mới được danh sách khám phá"
            message={hasLoadedProfilesRef.current
              ? `${loadError} Coco vẫn giữ kết quả gần nhất để cậu không mất ngữ cảnh.`
              : loadError}
            onRetry={retryDiscoverProfiles}
            isRetrying={isLoading}
          />
        )}

        {requestNotice && (
          <div className="matches-status-message" role="status" aria-live="polite">
            <Icon name="connection" /> {requestNotice}
          </div>
        )}

        {safetyStatus && (
          <div className="matches-status-message" role="status" aria-live="polite">
            <Icon name="safety" /> {safetyStatus}
          </div>
        )}

        {(!loadError || hasLoadedProfilesRef.current) && <div className="discover-layout">
          <button
            type="button"
            className="discover-filter-toggle"
            aria-expanded={isFiltersOpen}
            aria-controls="discover-filters"
            onClick={() => setIsFiltersOpen((current) => !current)}
          >
            <span><Icon name="discover" /> Bộ lọc</span>
            <strong>{isFiltersOpen ? 'Thu gọn' : 'Mở bộ lọc'}</strong>
          </button>

          <aside
            id="discover-filters"
            className={`discover-filter-panel ${isFiltersOpen ? 'is-open' : ''}`}
          >
            <div className="filter-title">
              <h2>Bộ lọc</h2>
              <button type="button" onClick={resetFilters}>
                Đặt lại
              </button>
            </div>

            <label className="discover-filter-field">
              <span>Tên, ngành, kỹ năng hoặc địa điểm</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Ví dụ: React, Cầu Giấy"
              />
            </label>

            <label className="discover-filter-field">
              <span>Tỉnh / Thành phố</span>
              <select
                value={city}
                onChange={(event) => {
                  setCity(event.target.value)
                  setArea('')
                  setSelectedId(null)
                }}
              >
                <option value="">Tất cả tỉnh / thành phố</option>
                {cities.map((item) => (
                  <option key={normalize(item)} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="discover-filter-field">
              <span>Khu vực</span>
              <select
                value={area}
                onChange={(event) => {
                  setArea(event.target.value)
                  setSelectedId(null)
                }}
              >
                <option value="">Tất cả khu vực</option>
                {areas.map((item) => (
                  <option key={normalize(item)} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="discover-filter-field">
              <span>Khoảng cách tối đa — số liệu mẫu</span>
              <select
                value={maxDistance}
                onChange={(event) => setMaxDistance(event.target.value)}
              >
                <option value="1">1 km</option>
                <option value="3">3 km</option>
                <option value="5">5 km</option>
                <option value="10">10 km</option>
              </select>
            </label>

            <div className="privacy-filter-note">
              <strong>Giới tính từ Hồ sơ</strong>
              <p>{profile.gender || 'Chưa có thông tin'}</p>
              <Link to="/profile">Chỉnh sửa Hồ sơ</Link>

              <p>
                Hồ sơ ghép trọ chỉ xuất hiện khi cùng giới tính đã lưu.
                Học nhóm và Team Project không bị giới hạn giới tính.
              </p>

              {!canFilterRoommates && (
                <p>
                  Chưa hiển thị hồ sơ ghép trọ vì thiếu thông tin
                  dùng để lọc. Cậu vẫn có thể tìm bạn học và team.
                </p>
              )}

              <p>
                Không công khai số điện thoại hoặc số nhà.
                Lọc giới tính không thay thế việc xác minh danh tính.
              </p>
            </div>
          </aside>

          <div className="discover-results">
            <div className="discover-results-toolbar">
              <div>
                <strong>{filteredStudents.length} kết quả phù hợp</strong>
                <span>Coco Fit giải thích từng điểm chung, không chấm điểm con người</span>
              </div>
              <div className="discover-toolbar-actions">
                <label className="discover-sort-field">
                  <span>Sắp xếp</span>
                  <select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
                    <option value="fit">Coco Fit</option>
                    <option value="newest">Hồ sơ mới</option>
                  </select>
                </label>
                <button type="button" onClick={resetFilters}>Đặt lại bộ lọc</button>
              </div>
            </div>

            <section className="coco-fit-explainer" aria-labelledby="coco-fit-title">
              <span className="coco-fit-explainer-icon" aria-hidden="true"><Icon name="spark" /></span>
              <div>
                <h2 id="coco-fit-title">Biết lý do trước khi gửi lời mời.</h2>
                <p>Coco chỉ so sánh mục tiêu, ngành và khu vực công khai. Kết quả là gợi ý để cậu tự đánh giá, không phải bảo đảm tương hợp hay an toàn.</p>
              </div>
              <Link to="/profile">Cập nhật tiêu chí <Icon name="arrow" /></Link>
            </section>

            <div className="purpose-tabs" aria-label="Mục tiêu kết nối">
              {purposes.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={purpose === item ? 'active' : ''}
                  aria-pressed={purpose === item}
                  onClick={() => {
                    setPurpose(item)
                    closeProfile(false)
                  }}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="student-card-grid">
              {rankedStudents.map((student) => {
                const studentRequestKey = requestKey(
                  student.profileId
                )
                const requestStatus = requestStatuses[studentRequestKey]
                const requestPending = requestStatus === 'pending'
                const requestAccepted = requestStatus === 'accepted'
                const purposeClass = student.purpose === 'Học nhóm'
                  ? 'purpose-study-card'
                  : student.purpose === 'Team Project'
                    ? 'purpose-team-card'
                    : 'purpose-room-card'

                return (
                  <article
                    className={`discover-student-card ${purposeClass}`}
                    key={student.id}
                  >
                    <div className="discover-avatar">
                      {student.name.split(' ').slice(-1)[0][0]}
                    </div>

                    <span className="student-purpose">
                      {student.purpose}
                    </span>

                    <div className="student-main-info">
                      <h2>{student.name}</h2>
                      <p>{student.major}</p>
                      <TrustBadge profile={student} compact />
                    </div>

                    <div className="student-skill-list">
                      {student.skills.map((skill) => (
                        <span key={skill}>{skill}</span>
                      ))}
                    </div>

                    <div className={`coco-fit-summary ${student.fit.level}`}>
                      <span className="coco-fit-label"><Icon name="spark" /> {student.fit.label}</span>
                      <ul aria-label={`Lý do gợi ý ${student.name}`}>
                        {student.fit.reasons.slice(0, 2).map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    </div>

                    <p className="student-location">
                      {locationText(student)}
                      <br />
                      {student.distance === null
                        ? 'Khoảng cách: Chưa có dữ liệu'
                        : `Khoảng cách: ${student.distance.toLocaleString('vi-VN')} km`}
                    </p>

                    <p className="student-about">{student.about}</p>

                    <div className="student-card-actions">
                      <button
                        type="button"
                        className="view-student-button"
                        onClick={() => openProfile(student.id)}
                      >
                        Xem hồ sơ
                      </button>

                      <button
                        type="button"
                        className="connect-student-button"
                        disabled={requestPending || requestAccepted || sendingIds[studentRequestKey]}
                        onClick={() => openInvite(student)}
                      >
                        {requestAccepted
                          ? 'Đã kết nối'
                          : requestPending
                            ? 'Đã gửi lời mời'
                            : sendingIds[studentRequestKey]
                              ? 'Đang gửi…'
                              : 'Kết nối'}
                      </button>

                      <SafetyActions
                        targetId={student.profileId}
                        targetName={student.name}
                        onBlocked={handleBlocked}
                        onReported={handleReported}
                        compact
                      />
                    </div>
                  </article>
                )
              })}
            </div>

            {!isLoading && !loadError && filteredStudents.length === 0 && (
              <div className="discover-empty-state">
                <div className="discover-empty-icon" aria-hidden="true"><Icon name="discover" /></div>
                <h2>{students.length === 0 ? 'Chưa có người dùng khác' : 'Chưa có kết quả phù hợp'}</h2>
                <p>
                  {students.length === 0
                    ? 'Khi có thêm hồ sơ công khai, cậu sẽ thấy các kết nối phù hợp ở đây.'
                    : 'Thử đổi địa điểm, tăng khoảng cách hoặc đặt lại bộ lọc.'}
                </p>
                <button type="button" onClick={resetFilters}>
                  Đặt lại bộ lọc
                </button>
              </div>
            )}

            {undoStudent && (
              <div className="discover-undo-notice" role="status">
                <span>Đã ẩn hồ sơ {undoStudent.name} khỏi kết quả hiện tại.</span>
                <button
                  type="button"
                  onClick={() => {
                    setHiddenIds((current) => current.filter((id) => id !== undoStudent.id))
                    setUndoStudent(null)
                  }}
                >
                  Hoàn tác
                </button>
              </div>
            )}
          </div>
        </div>}

        {selectedStudent && (
          <div className="discover-dialog-backdrop" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeProfile()
          }}>
            <section
              ref={dialogRef}
              className="discover-profile-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="discover-dialog-title"
              tabIndex="-1"
            >
              <header className="discover-dialog-header">
                <div className="discover-avatar">
                  {selectedStudent.name.split(' ').slice(-1)[0][0]}
                </div>
                <div>
                  <p className="discover-dialog-kicker">HỒ SƠ SINH VIÊN</p>
                  <h2 id="discover-dialog-title">{selectedStudent.name}</h2>
                  <p>{selectedStudent.purpose} · {selectedStudent.major}</p>
                  <TrustBadge profile={selectedStudent} compact />
                </div>
                <button type="button" className="discover-dialog-close" onClick={closeProfile}>
                  Đóng
                </button>
              </header>

              <div className="discover-dialog-body">
                <div className="discover-dialog-section">
                  <span>Giới thiệu</span>
                  <p>{selectedStudent.about}</p>
                </div>
                <div className="discover-dialog-section">
                  <span>Lý do Coco Fit</span>
                  <div className={`coco-fit-summary dialog ${selectedStudent.fit.level}`}>
                    <span className="coco-fit-label"><Icon name="spark" /> {selectedStudent.fit.label}</span>
                    <ul>
                      {selectedStudent.fit.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                    </ul>
                  </div>
                  <small>Gợi ý dựa trên thông tin công khai, không phải điểm tương hợp hay xác minh an toàn.</small>
                </div>
                <div className="discover-dialog-section">
                  <span>Tín hiệu Coco Trust</span>
                  <TrustBadge profile={selectedStudent} />
                  <small>{getTrustSignal(selectedStudent).description}</small>
                </div>
                <div className="discover-dialog-section">
                  <span>Khu vực gần đúng</span>
                  <p>{locationText(selectedStudent)}</p>
                  <small>Không hiển thị số nhà hoặc thông tin liên hệ cá nhân.</small>
                </div>
                <div className="discover-dialog-section">
                  <span>Kỹ năng và điểm chung</span>
                  <div className="student-skill-list">
                    {selectedStudent.skills.map((skill) => <span key={skill}>{skill}</span>)}
                  </div>
                </div>
              </div>

              <footer className="discover-dialog-actions">
                <button type="button" className="view-student-button" onClick={skipProfile}>
                  Bỏ qua hồ sơ
                </button>
                <button
                  type="button"
                  className="connect-student-button"
                  disabled={
                    requestStatuses[requestKey(
                      selectedStudent.profileId
                    )] === 'pending' ||
                    requestStatuses[requestKey(
                      selectedStudent.profileId
                    )] === 'accepted' ||
                    sendingIds[requestKey(
                      selectedStudent.profileId
                    )]
                  }
                  onClick={() => openInvite(selectedStudent)}
                >
                  {requestStatuses[requestKey(
                    selectedStudent.profileId
                  )] === 'accepted'
                    ? 'Đã kết nối'
                    : requestStatuses[requestKey(
                      selectedStudent.profileId
                    )] === 'pending'
                      ? 'Đã gửi lời mời'
                      : sendingIds[requestKey(
                        selectedStudent.profileId
                      )]
                        ? 'Đang gửi…'
                        : 'Gửi lời mời'}
                </button>
              </footer>
            </section>
          </div>
        )}

        {inviteStudent && (
          <ConnectionInviteDialog
            student={inviteStudent}
            message={inviteMessage}
            error={inviteError}
            isSending={Boolean(sendingIds[requestKey(inviteStudent.profileId)])}
            onChange={updateInviteMessage}
            onBlur={() => {
              if (inviteMessage.trim()) {
                setInviteError(getConnectionInviteError(inviteMessage))
              }
            }}
            onClose={closeInvite}
            onSubmit={sendInvite}
          />
        )}
      </section>
    </AppLayout>
  )
}
