import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AppLayout, { Icon } from '../components/AppLayout'
import { getCurrentAccount } from '../auth'
import { useConnectionRequestRefresh } from '../hooks/useConnectionRequestRefresh'
import { supabase } from '../lib/supabaseClient'

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
  'max_distance_km',
]

const purposeLabels = {
  study_group: 'Học nhóm',
  team_project: 'Team Project',
  roommates: 'Ghép trọ',
}

const dashboardProfileSelect = profileFields.join(', ')
const dashboardRequestSelect = 'id, requester_id, recipient_id, purpose, status, created_at, requester:profiles!connection_requests_requester_id_fkey(full_name), recipient:profiles!connection_requests_recipient_id_fkey(full_name)'

const quickActions = [
  {
    to: '/study',
    icon: 'study',
    title: 'Tìm bạn học',
    text: 'Cùng ôn bài, luyện đề và trao đổi kiến thức.',
    color: 'blue',
  },
  {
    to: '/team',
    icon: 'team',
    title: 'Tìm team project',
    text: 'Tìm người có kỹ năng phù hợp với dự án.',
    color: 'orange',
  },
  {
    to: '/roommates',
    icon: 'room',
    title: 'Tìm bạn ghép trọ',
    text: 'Lọc theo giới tính, thành phố và khu vực.',
    color: 'green',
  },
]

function mapDashboardConnection(request, userId) {
  const otherProfile = request.requester_id === userId
    ? request.recipient
    : request.requester

  return {
    id: request.id,
    name: otherProfile?.full_name?.trim() || 'Sinh viên CocoApp',
    purpose: purposeLabels[request.purpose] || 'Kết nối sinh viên',
    status: request.status,
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
        supabase
          .from('connection_requests')
          .select(dashboardRequestSelect)
          .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
          .in('status', ['pending', 'accepted'])
          .order('created_at', { ascending: false }),
      ])

      if (profileResult.error) throw profileResult.error
      if (requestsResult.error) throw requestsResult.error

      if (isMountedRef.current) {
        setData({
          profile: profileResult.data || {},
          connections: (requestsResult.data || []).map((request) => (
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
            <h1>Chào {displayName}, cùng bắt đầu một ngày hiệu quả nhé.</h1>
            <p className="page-description">
              Tìm người đồng hành cho việc học, dự án và cuộc sống sinh viên.
            </p>
          </div>
        </header>

        {isLoading && (
          <div className="dashboard-loading-banner" role="status" aria-live="polite">
            Đang tải dữ liệu tổng quan từ Supabase…
          </div>
        )}

        {loadError && (
          <div className="form-error-banner" role="alert">
            {loadError}
          </div>
        )}

        <div className="dashboard-hero-grid">
          <div className="dashboard-banner">
            <div>
              <span className="banner-tag">
                {completion === 100 ? 'HỒ SƠ ĐÃ SẴN SÀNG' : 'BƯỚC TIẾP THEO'}
              </span>

              <h2>
                {completion === 100
                  ? 'Tìm đúng người cho mục tiêu hôm nay.'
                  : `Hoàn thiện ${completion}% hồ sơ để nhận gợi ý phù hợp hơn.`}
              </h2>

              <p>
                {completion === 100
                  ? 'Khám phá sinh viên theo mục tiêu, kỹ năng và khu vực của cậu.'
                  : 'Thêm một vài thông tin cơ bản để CocoApp hiểu điều cậu đang tìm kiếm.'}
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
              to="/matches"
              className="metric-card metric-orange metric-link"
              aria-label={`Mở kết nối, ${pending} lời mời đang chờ`}
            >
              <span className="metric-label"><Icon name="connection" /> Đang chờ</span>
              <strong>{pending}</strong>
              <small>Lời mời kết nối <Icon name="arrow" /></small>
            </Link>
            <Link
              to="/matches"
              className="metric-card metric-green metric-link"
              aria-label={`Mở kết nối, ${accepted} kết nối đã chấp nhận`}
            >
              <span className="metric-label"><Icon name="connection" /> Đã kết nối</span>
              <strong>{accepted}</strong>
              <small>Có thể trò chuyện <Icon name="arrow" /></small>
            </Link>
          </aside>
        </div>

        <div className="section-heading">
          <h2>Chọn mục tiêu của cậu</h2>
          <p>Bắt đầu từ điều cậu muốn giải quyết hôm nay.</p>
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
              <h3>{action.title}</h3>
              <p>{action.text}</p>
              <span className="card-arrow" aria-hidden="true">→</span>
            </Link>
          ))}
        </div>

        <div className="dashboard-lower-grid">
          <section className="dashboard-panel">
            <div className="panel-title-row">
              <h2>Kết nối của cậu</h2>
                <p>Theo dõi lời mời và những người cậu đã kết nối.</p>
            </div>

            {recentConnections.length === 0 ? (
              <div className="empty-activity">
                <h3>Chưa có lời mời nào</h3>
                <p>Tìm hồ sơ phù hợp rồi gửi lời mời kết nối.</p>
                <Link to="/discover">Khám phá sinh viên →</Link>
              </div>
            ) : (
              <div className="connection-preview-list">
                {recentConnections.map((item) => (
                  <Link
                    key={item.id}
                    to="/matches"
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

            <Link to="/profile">Chỉnh sửa hồ sơ <Icon name="arrow" /></Link>
          </section>
        </div>
      </section>
    </AppLayout>
  )
}
