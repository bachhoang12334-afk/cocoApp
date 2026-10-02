import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AppLayout, { Icon } from '../components/AppLayout'
import { getCurrentAccount } from '../auth'
import { useConnectionRequestRefresh } from '../hooks/useConnectionRequestRefresh'
import { supabase } from '../lib/supabaseClient'
import TrustBadge from '../components/TrustBadge'
import CocoCompass from '../components/CocoCompass'
import DataRecoveryState from '../components/DataRecoveryState'
import { normalizeConnectionRequests } from '../lib/profileAccess'
import { getTrustSignal } from '../lib/trustSignals'
import {
  getDashboardConnectionTarget,
  MATCHES_ACCEPTED_TARGET,
  MATCHES_PENDING_TARGET,
} from '../lib/appNavigation'

const profileFields = [
  'full_name',
  'university',
  'major',
  'study_year',
  'gender',
  'purpose',
  'bio',
  'city',
  'area',
  'public_location',
  'proximity_scope',
]

const purposeLabels = {
  study_group: 'Học nhóm',
  team_project: 'Team Project',
  roommates: 'Ghép trọ',
}

const dashboardProfileSelect = [
  ...profileFields,
  'email_confirmed',
  'education_email',
  'verification_status',
].join(', ')
const quickActions = [
  {
    to: '/study',
    icon: 'study',
    eyebrow: 'HỌC TỐT HƠN',
    title: 'Tìm bạn học',
    text: 'Cùng ôn bài, luyện đề và trao đổi kiến thức.',
    color: 'blue',
  },
  {
    to: '/team',
    icon: 'team',
    eyebrow: 'LÀM CÙNG NHAU',
    title: 'Tìm team project',
    text: 'Tìm người có kỹ năng phù hợp với dự án.',
    color: 'orange',
  },
  {
    to: '/roommates',
    icon: 'room',
    eyebrow: 'SỐNG AN TÂM HƠN',
    title: 'Tìm bạn ghép trọ',
    text: 'Lọc theo giới tính, thành phố và khu vực.',
    color: 'green',
  },
]

function mapDashboardConnection(request, userId) {
  const isIncoming = request.recipient_id === userId
  const otherProfile = isIncoming ? request.requester : request.recipient

  return {
    id: request.id,
    name: otherProfile?.full_name?.trim() || 'Sinh viên CocoApp',
    purpose: purposeLabels[request.purpose] || 'Kết nối sinh viên',
    status: request.status,
    isIncoming,
  }
}

function hasProfileValue(value) {
  if (typeof value === 'number') return Number.isFinite(value)
  return typeof value === 'string' && value.trim() !== ''
}

export default function Dashboard() {
  const [data, setData] = useState({ profile: {}, connections: [] })
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [hasLoadedDashboard, setHasLoadedDashboard] = useState(false)
  const isMountedRef = useRef(false)
  const { profile, connections } = data

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const loadDashboard = useCallback(async () => {
    try {
      const user = await getCurrentAccount()
      if (!user) throw new Error('Phiên đăng nhập đã hết.')

      const [profileResult, requestsResult] = await Promise.all([
        supabase
          .from('profiles')
          .select(dashboardProfileSelect)
          .eq('id', user.id)
          .maybeSingle(),
        supabase.rpc('get_my_connection_requests'),
      ])

      if (profileResult.error) throw profileResult.error
      if (requestsResult.error) throw requestsResult.error

      if (isMountedRef.current) {
        setHasLoadedDashboard(true)
        setData({
          profile: profileResult.data || {},
          connections: normalizeConnectionRequests(requestsResult.data).map((request) => (
            mapDashboardConnection(request, user.id)
          )),
        })
        setLoadError('')
      }
    } finally {
      if (isMountedRef.current) setIsLoading(false)
    }
  }, [])

  useConnectionRequestRefresh(loadDashboard, {
    onError: () => {
      if (isMountedRef.current) {
        setLoadError('Không thể tải dữ liệu tổng quan từ Supabase. Hãy thử lại sau.')
      }
    },
  })

  async function retryDashboard() {
    setIsLoading(true)
    setLoadError('')

    try {
      await loadDashboard()
    } catch {
      if (isMountedRef.current) {
        setLoadError('Không thể tải dữ liệu tổng quan từ Supabase. Hãy thử lại sau.')
      }
    }
  }

  const fullName =
    typeof profile.full_name === 'string'
      ? profile.full_name.trim()
      : ''

  const displayName = fullName
    ? fullName.split(/\s+/).pop()
    : 'cậu'

  const completedFields = profileFields.filter(
    (key) => hasProfileValue(profile[key])
  ).length

  const completion = Math.round(
    (completedFields / profileFields.length) * 100
  )

  const pending = connections.filter(
    (item) => item.status === 'pending'
  ).length

  const accepted = connections.filter(
    (item) => item.status === 'accepted'
  ).length

  const recentConnections = connections.slice(0, 3)

  const dateLabel = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

  return (
    <AppLayout>
      <section className="dashboard-page">
        <header className="dashboard-topbar">
          <div>
            <p className="page-eyebrow">{dateLabel}</p>
            <h1>Chào {displayName}. Việc đúng sẽ dễ hơn khi gặp đúng người.</h1>
            <p className="page-description">
              Coco biến một mục tiêu thật thành một kết nối có lý do để bắt đầu.
            </p>
          </div>
        </header>

        {isLoading && (
          <div className="dashboard-loading-banner" role="status" aria-live="polite">
            Đang tải dữ liệu tổng quan từ Supabase…
          </div>
        )}

        {loadError && !isLoading && (
          <DataRecoveryState
            title="Chưa tải được tổng quan của cậu"
            message={hasLoadedDashboard
              ? `${loadError} Coco vẫn giữ dữ liệu gần nhất để cậu không mất ngữ cảnh.`
              : `${loadError} Các con số tạm được ẩn để tránh hiển thị trạng thái sai.`}
            onRetry={retryDashboard}
            isRetrying={isLoading}
          />
        )}

        {!isLoading && (!loadError || hasLoadedDashboard) && (
          <>
            <div className="dashboard-hero-grid">
          <div className="dashboard-banner">
            <div>
              <span className="banner-tag">
                COCO CAMPUS
              </span>

              <h2>
                Tìm đúng người cho đúng việc — trong cộng đồng sinh viên.
              </h2>

              <p>
                Không cần đăng bài rồi chờ may mắn. Chọn mục tiêu, xem thông tin phù hợp và chỉ kết nối khi cả hai cùng đồng ý.
              </p>

              <Link
                to={completion === 100 ? '/discover' : '/profile'}
                className="banner-button"
              >
                {completion === 100 ? 'Khám phá ngay' : 'Cập nhật hồ sơ'}
                <Icon name="arrow" />
              </Link>
            </div>
          </div>

          <aside className="dashboard-metrics" aria-label="Tóm tắt tài khoản">
            <article className="metric-card metric-purple">
              <span className="metric-label"><Icon name="profile" /> Hồ sơ</span>
              <strong>{completion}%</strong>
              <small>{completedFields}/{profileFields.length} thông tin</small>
            </article>
            <Link
              to={MATCHES_PENDING_TARGET}
              className="metric-card metric-orange metric-link"
              aria-label={`Mở kết nối, ${pending} lời mời đang chờ`}
            >
              <span className="metric-label"><Icon name="connection" /> Đang chờ</span>
              <strong>{pending}</strong>
              <small>Lời mời kết nối <Icon name="arrow" /></small>
            </Link>
            <Link
              to={MATCHES_ACCEPTED_TARGET}
              className="metric-card metric-green metric-link"
              aria-label={`Mở kết nối, ${accepted} kết nối đã chấp nhận`}
            >
              <span className="metric-label"><Icon name="connection" /> Đã kết nối</span>
              <strong>{accepted}</strong>
              <small>Có thể trò chuyện <Icon name="arrow" /></small>
            </Link>
          </aside>
            </div>

            <CocoCompass
              completion={completion}
              emailConfirmed={Boolean(profile.email_confirmed)}
              accepted={accepted}
              pending={pending}
            />
          </>
        )}

        <div className="section-heading">
          <p className="section-kicker">BẮT ĐẦU TỪ NHU CẦU THẬT</p>
          <h2>Cậu muốn tìm người cho việc gì?</h2>
          <p>Mỗi mục tiêu dùng đúng bộ lọc và ngữ cảnh để bớt những kết nối không liên quan.</p>
        </div>

        <div className="quick-action-grid">
          {quickActions.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className={`quick-action-card ${action.color}`}
            >
              <span className="quick-action-icon" aria-hidden="true">
                <Icon name={action.icon} />
              </span>
              <span className="quick-action-eyebrow">{action.eyebrow}</span>
              <h3>{action.title}</h3>
              <p>{action.text}</p>
              <span className="card-arrow" aria-hidden="true"><Icon name="arrow" /></span>
            </Link>
          ))}
        </div>

        {!isLoading && (!loadError || hasLoadedDashboard) && (
          <div className="dashboard-lower-grid">
          <section className="dashboard-panel">
            <div className="panel-title-row">
              <h2>Kết nối của cậu</h2>
                <p>Theo dõi lời mời và những người cậu đã kết nối.</p>
            </div>

            {recentConnections.length === 0 ? (
              <div className="empty-activity">
                <div className="empty-connection-art" aria-hidden="true">
                  <span>C</span>
                  <i />
                  <span>{displayName[0]?.toUpperCase() || 'B'}</span>
                </div>
                <div>
                  <h3>Kết nối đầu tiên nên bắt đầu bằng một lý do rõ ràng.</h3>
                  <p>Chọn mục tiêu, xem hồ sơ và gửi lời mời cho người thật sự phù hợp.</p>
                  <Link to="/discover">Khám phá có mục tiêu <Icon name="arrow" /></Link>
                </div>
              </div>
            ) : (
              <div className="connection-preview-list">
                {recentConnections.map((item) => (
                  <Link
                    key={item.id}
                    to={getDashboardConnectionTarget(item)}
                    className="connection-preview-item"
                  >
                    <span className="connection-mini-avatar">
                      {item.name.trim().split(/\s+/).pop()?.[0] || '?'}
                    </span>
                    <span className="connection-preview-copy">
                      <strong>{item.name}</strong>
                      <small>{item.purpose || 'Kết nối sinh viên'}</small>
                    </span>
                    <span className={`connection-status ${item.status}`}>
                      {item.status === 'pending'
                        ? 'Đang chờ'
                        : 'Đã kết nối'}
                    </span>
                  </Link>
                ))}

                <Link
                  to="/matches"
                  className="panel-text-link"
                >
                  Xem tất cả kết nối <Icon name="arrow" />
                </Link>
              </div>
            )}
          </section>

          <section className="dashboard-panel profile-progress">
            <p className="progress-label">MỨC ĐỘ HOÀN THIỆN</p>

            <div className="progress-number">
              <strong>{completion}%</strong>
              <span>Thông tin đã điền</span>
            </div>

            <div
              className="progress-track"
              role="progressbar"
              aria-label="Mức độ hoàn thiện hồ sơ đã lưu"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={completion}
            >
              <span style={{ width: `${completion}%` }} />
            </div>

            <p>
              {completedFields}/{profileFields.length} mục đã điền.
              Mức độ hoàn thiện không có nghĩa là tài khoản đã xác minh.
            </p>

            <div className="dashboard-trust-summary" aria-live="polite">
              <TrustBadge profile={profile} />
              <small>{getTrustSignal(profile).description}</small>
            </div>

            <Link to="/profile">Chỉnh sửa hồ sơ <Icon name="arrow" /></Link>
          </section>
          </div>
        )}
      </section>
    </AppLayout>
  )
}
