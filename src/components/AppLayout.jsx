import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getCurrentAccount, logoutAccount } from '../auth'
import { useConnectionRequestRefresh } from '../hooks/useConnectionRequestRefresh'
import {
  getNotificationTarget,
  isCocoPlanNotification,
} from '../lib/notificationNavigation'
import { normalizeNotifications } from '../lib/profileAccess'
import { supabase } from '../lib/supabaseClient'

const notificationCopy = {
  request_received: 'đã gửi cho cậu một lời mời kết nối.',
  request_accepted: 'đã chấp nhận lời mời kết nối của cậu.',
  request_declined: 'đã từ chối lời mời kết nối của cậu.',
  request_cancelled: 'đã hủy lời mời kết nối đã gửi cho cậu.',
  connection_disconnected: 'đã ngắt kết nối với cậu.',
  plan_proposed: 'đã gửi một Coco Plan mới.',
  plan_accepted: 'đã chấp nhận Coco Plan.',
  plan_declined: 'đã từ chối Coco Plan.',
  plan_cancelled: 'đã hủy Coco Plan.',
  plan_completed: 'đã đánh dấu Coco Plan hoàn thành.',
}

function getNotificationMessage(notification) {
  const actorName = notification.actor?.full_name?.trim() || 'Một sinh viên'
  return `${actorName} ${notificationCopy[notification.type] || 'đã cập nhật kết nối với cậu.'}`
}

function formatNotificationTime(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

function getAuthProfileName(user) {
  const name = user?.user_metadata?.fullName || user?.user_metadata?.full_name
  return typeof name === 'string' ? name.trim() : ''
}

const sidebarPreferenceKey = 'cocoapp:sidebar-collapsed'

function getInitialSidebarState() {
  if (typeof window === 'undefined') return false

  try {
    const savedPreference = window.localStorage.getItem(sidebarPreferenceKey)

    if (savedPreference === 'true') return true
    if (savedPreference === 'false') return false
  } catch {
    return false
  }

  return window.matchMedia('(max-width: 1260px)').matches
}

export function Icon({ name }) {
  const paths = {
    dashboard: <><path d="M4 13h6V4H4v9Zm10 7h6v-9h-6v9ZM4 20h6v-3H4v3Zm10-13h6V4h-6v3Z"/></>,
    discover: <><circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/><path d="m13.5 8.5-1.4 3.6-3.6 1.4 1.4-3.6 3.6-1.4Z"/></>,
    study: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22V5.5Z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22V5.5Z"/></>,
    team: <><circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2"/><path d="M16 5.2a3 3 0 0 1 0 5.6"/><path d="M18 13.4A6 6 0 0 1 21 19v2"/></>,
    room: <><path d="m3 11 9-7 9 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M9 14h6"/></>,
    connection: <><path d="M8.5 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M2.5 21v-2a6 6 0 0 1 12 0v2"/><path d="M16 8h5m-2.5-2.5V10.5"/></>,
    safety: <><path d="M12 3 5 6v5c0 4.8 2.8 8.2 7 10 4.2-1.8 7-5.2 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></>,
    profile: <><circle cx="12" cy="8" r="3.2"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></>,
    bell: <><path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    logout: <><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M14 3h4a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-4"/></>,
    menu: <><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></>,
    arrow: <><path d="M5 12h13"/><path d="m13 6 6 6-6 6"/></>,
    spark: <><path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z"/><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z"/></>,
    bookmark: <><path d="M6 4.8A1.8 1.8 0 0 1 7.8 3h8.4A1.8 1.8 0 0 1 18 4.8V21l-6-3.8L6 21V4.8Z"/></>,
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

const menuItems = [
  { to: '/dashboard', icon: 'dashboard', label: 'Tổng quan', hint: 'Trang chủ' },
  { to: '/discover', icon: 'discover', label: 'Khám phá', hint: 'Tìm người phù hợp' },
  { to: '/study', icon: 'study', label: 'Học nhóm', hint: 'Cùng tiến bộ' },
  { to: '/team', icon: 'team', label: 'Team Project', hint: 'Cùng làm dự án' },
  { to: '/roommates', icon: 'room', label: 'Ghép trọ', hint: 'Ở cùng an toàn' },
  { to: '/matches', icon: 'connection', label: 'Kết nối', hint: 'Lời mời & chat' },
  { to: '/safety', icon: 'safety', label: 'An toàn', hint: 'Chặn & báo cáo' },
]

const mobileMenuItems = [
  menuItems[0],
  menuItems[1],
  menuItems[5],
  { to: '/profile', icon: 'profile', label: 'Hồ sơ', hint: 'Thông tin của cậu' },
]

const pageTitles = {
  '/dashboard': 'Tổng quan',
  '/discover': 'Khám phá cộng đồng',
  '/study': 'Tìm bạn học',
  '/team': 'Tìm team project',
  '/roommates': 'Tìm bạn ghép trọ',
  '/matches': 'Kết nối của bạn',
  '/safety': 'Trung tâm an toàn',
  '/profile': 'Hồ sơ cá nhân',
}

export default function AppLayout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const mainRef = useRef(null)
  const notificationRootRef = useRef(null)
  const notificationButtonRef = useRef(null)
  const notificationPanelRef = useRef(null)
  const notificationChannelRef = useRef(null)
  const messageUnreadChannelRef = useRef(null)
  const profileChannelRef = useRef(null)
  const notificationUserIdRef = useRef(null)
  const notificationLoadIdRef = useRef(0)
  const unreadMessageLoadIdRef = useRef(0)
  const hasLoadedNotificationsRef = useRef(false)
  const pendingNotificationReadsRef = useRef(new Map())
  const notificationsMountedRef = useRef(false)
  const [logoutError, setLogoutError] = useState('')
  const [notifications, setNotifications] = useState([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notificationsLoading, setNotificationsLoading] = useState(true)
  const [notificationsLoadError, setNotificationsLoadError] = useState('')
  const [notificationActionFeedback, setNotificationActionFeedback] = useState('')
  const [notificationTransportFeedback, setNotificationTransportFeedback] = useState('')
  const [notificationAnnouncement, setNotificationAnnouncement] = useState('')
  const [unreadMessageCount, setUnreadMessageCount] = useState(0)
  const [profileName, setProfileName] = useState('Sinh viên')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(getInitialSidebarState)
  const fullName = profileName.trim() || 'Sinh viên'
  const avatarLetter = fullName.split(/\s+/).pop()?.[0]?.toUpperCase() || 'S'
  const pageTitle = pageTitles[location.pathname] || 'CocoApp'
  const unreadNotificationCount = notifications.filter(
    (notification) => notification.read_at === null
  ).length

  useEffect(() => {
    try {
      window.localStorage.setItem(sidebarPreferenceKey, String(sidebarCollapsed))
    } catch {
      return
    }
  }, [sidebarCollapsed])

  const loadNotifications = useCallback(async ({ silent = false } = {}) => {
    const userId = notificationUserIdRef.current
    if (!userId) return
    const loadId = ++notificationLoadIdRef.current
    const isCurrentLoad = () => (
      notificationsMountedRef.current
      && notificationUserIdRef.current === userId
      && notificationLoadIdRef.current === loadId
    )

    if (!silent && notificationsMountedRef.current) {
      setNotificationsLoading(true)
      setNotificationsLoadError('')
    }

    try {
      const { data, error } = await supabase
        .rpc('get_my_notifications')

      if (!isCurrentLoad()) return
      if (error) throw error

      const normalizedNotifications = normalizeNotifications(data)
      const pendingReads = pendingNotificationReadsRef.current

      for (const notification of normalizedNotifications) {
        if (notification.read_at !== null) {
          pendingReads.delete(notification.id)
        }
      }

      setNotifications((current) => {
        const currentNotifications = new Map(current.map((item) => [item.id, item]))

        return normalizedNotifications.map((notification) => {
          const pendingRead = pendingReads.get(notification.id)
          if (!pendingRead || notification.read_at !== null) return notification

          const currentReadAt = currentNotifications.get(notification.id)?.read_at
          return { ...notification, read_at: currentReadAt ?? pendingRead.readAt }
        })
      })
      hasLoadedNotificationsRef.current = true
      setNotificationsLoadError('')
      setNotificationTransportFeedback('')
    } catch {
      if (isCurrentLoad()) {
        if (hasLoadedNotificationsRef.current) {
          setNotificationTransportFeedback('Chưa làm mới được thông báo. Danh sách gần nhất vẫn được giữ lại.')
        } else {
          setNotificationsLoadError('Chưa tải được thông báo. Hãy thử lại.')
        }
      }
    } finally {
      if (isCurrentLoad()) {
        setNotificationsLoading(false)
      }
    }
  }, [])

  const loadUnreadMessageCount = useCallback(async () => {
    const userId = notificationUserIdRef.current
    if (!userId) return
    const loadId = ++unreadMessageLoadIdRef.current
    const isCurrentLoad = () => (
      notificationsMountedRef.current
      && notificationUserIdRef.current === userId
      && unreadMessageLoadIdRef.current === loadId
    )

    try {
      const { data: acceptedRequests, error: requestsError } = await supabase
        .from('connection_requests')
        .select('id')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)

      if (!isCurrentLoad() || requestsError) return

      const requestIds = (acceptedRequests || []).map((request) => request.id)
      if (requestIds.length === 0) {
        setUnreadMessageCount(0)
        return
      }

      const { count, error } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .in('connection_request_id', requestIds)
        .neq('sender_id', userId)
        .is('read_at', null)

      if (isCurrentLoad() && !error) {
        setUnreadMessageCount(count || 0)
      }
    } catch {
      // A later realtime event, focus event, or subscription catch-up retries this count.
    }
  }, [])

  const loadProfileIdentity = useCallback(async () => {
    const userId = notificationUserIdRef.current
    if (!userId) return

    const { data, error } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .maybeSingle()

    if (
      notificationsMountedRef.current
      && !error
      && data?.full_name?.trim()
    ) {
      setProfileName(data.full_name.trim())
    }
  }, [])

  useConnectionRequestRefresh(loadUnreadMessageCount, {
    refreshOnMount: false,
    refreshOnFocus: false,
  })

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true })
  }, [location.pathname])

  useEffect(() => {
    let cancelled = false
    let initialNotificationsLoaded = false
    let notificationsSubscribed = false
    const pendingNotificationReads = pendingNotificationReadsRef.current
    notificationsMountedRef.current = true

    function catchUpNotifications() {
      if (
        cancelled
        || !initialNotificationsLoaded
        || !notificationsSubscribed
      ) return

      void loadNotifications({ silent: true })
    }

    async function setupNotifications() {
      try {
        const user = await getCurrentAccount()
        if (!user || cancelled) return

        pendingNotificationReads.clear()
        hasLoadedNotificationsRef.current = false
        notificationUserIdRef.current = user.id
        setProfileName(getAuthProfileName(user) || 'Sinh viên')
        const channel = supabase
          .channel(`notifications:${user.id}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'notifications',
              filter: `recipient_id=eq.${user.id}`,
            },
            (payload) => {
              if (
                cancelled
                || !notificationsMountedRef.current
                || notificationUserIdRef.current !== user.id
              ) return

              if (payload.eventType === 'INSERT') {
                const incoming = { ...payload.new, actor: null }
                setNotifications((current) => (
                  current.some((item) => item.id === incoming.id)
                    ? current
                    : [incoming, ...current].slice(0, 30)
                ))
                setNotificationAnnouncement(getNotificationMessage(incoming))
              } else if (payload.eventType === 'UPDATE') {
                const pendingRead = pendingNotificationReads.get(payload.new.id)

                if (payload.new.read_at !== null) {
                  pendingNotificationReads.delete(payload.new.id)
                }

                setNotifications((current) => current.map((item) => (
                  item.id === payload.new.id
                    ? {
                        ...item,
                        read_at: payload.new.read_at === null && pendingRead
                          ? item.read_at ?? pendingRead.readAt
                          : payload.new.read_at,
                      }
                    : item
                )))
              }

              void loadNotifications({ silent: true })
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED' && !cancelled && notificationsMountedRef.current) {
              notificationsSubscribed = true
              setNotificationTransportFeedback('')
              catchUpNotifications()
            }

            if (status === 'CHANNEL_ERROR' && !cancelled && notificationsMountedRef.current) {
              setNotificationTransportFeedback('Kết nối thông báo trực tiếp đang gián đoạn. Dữ liệu sẽ tải lại khi cậu mở chuông.')
            }
          })

        notificationChannelRef.current = channel

        await Promise.all([
          loadNotifications(),
          loadUnreadMessageCount(),
          loadProfileIdentity(),
        ])
        initialNotificationsLoaded = true
        catchUpNotifications()
        if (cancelled) return

        const messageChannel = supabase
          .channel(`message-unread:${user.id}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'messages' },
            () => {
              if (!cancelled && notificationsMountedRef.current) {
                void loadUnreadMessageCount()
              }
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED' && !cancelled) {
              void loadUnreadMessageCount()
            }
          })

        messageUnreadChannelRef.current = messageChannel

        const profileChannel = supabase
          .channel(`profile-identity:${user.id}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'profiles',
              filter: `id=eq.${user.id}`,
            },
            (payload) => {
              if (cancelled || !notificationsMountedRef.current) return
              const nextName = payload.new?.full_name?.trim()
              if (nextName) setProfileName(nextName)
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') void loadProfileIdentity()
          })

        profileChannelRef.current = profileChannel
      } catch {
        if (notificationsMountedRef.current) {
          setNotificationsLoading(false)
          setNotificationsLoadError('Chưa tải được thông báo. Hãy thử lại.')
        }
      }
    }

    function handleWindowFocus() {
      void loadNotifications({ silent: true })
      void loadUnreadMessageCount()
      void loadProfileIdentity()
    }

    function handleProfileUpdated(event) {
      const nextName = event.detail?.fullName?.trim()
      if (nextName) setProfileName(nextName)
    }

    window.addEventListener('focus', handleWindowFocus)
    window.addEventListener('cocoapp:profile-updated', handleProfileUpdated)
    void setupNotifications()

    return () => {
      cancelled = true
      notificationsMountedRef.current = false
      notificationUserIdRef.current = null
      notificationLoadIdRef.current += 1
      unreadMessageLoadIdRef.current += 1
      hasLoadedNotificationsRef.current = false
      pendingNotificationReads.clear()
      window.removeEventListener('focus', handleWindowFocus)
      window.removeEventListener('cocoapp:profile-updated', handleProfileUpdated)

      if (notificationChannelRef.current) {
        void supabase.removeChannel(notificationChannelRef.current)
        notificationChannelRef.current = null
      }

      if (messageUnreadChannelRef.current) {
        void supabase.removeChannel(messageUnreadChannelRef.current)
        messageUnreadChannelRef.current = null
      }

      if (profileChannelRef.current) {
        void supabase.removeChannel(profileChannelRef.current)
        profileChannelRef.current = null
      }
    }
  }, [loadNotifications, loadProfileIdentity, loadUnreadMessageCount])

  useEffect(() => {
    if (!notificationsOpen) return undefined

    const refreshFrame = window.requestAnimationFrame(() => {
      void loadNotifications({ silent: true })
      notificationPanelRef.current?.querySelector('button:not(:disabled)')?.focus({ preventScroll: true })
    })

    function handlePointerDown(event) {
      if (!notificationRootRef.current?.contains(event.target)) {
        setNotificationsOpen(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setNotificationsOpen(false)
        notificationButtonRef.current?.focus({ preventScroll: true })
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.cancelAnimationFrame(refreshFrame)
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [loadNotifications, notificationsOpen])

  async function persistNotificationRead({ notificationId, readAt, token, userId }) {
    let updateFailed

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: readAt })
        .eq('id', notificationId)
        .eq('recipient_id', userId)
        .is('read_at', null)

      updateFailed = Boolean(error)
    } catch {
      updateFailed = true
    }

    if (!notificationsMountedRef.current) return

    const pendingRead = pendingNotificationReadsRef.current.get(notificationId)
    if (pendingRead?.token !== token) return

    if (!updateFailed) {
      void loadNotifications({ silent: true })
      return
    }

    pendingNotificationReadsRef.current.delete(notificationId)
    setNotifications((current) => current.map((item) => (
      item.id === notificationId && item.read_at === readAt
        ? { ...item, read_at: null }
        : item
    )))

    const errorMessage = 'Chưa đánh dấu được thông báo là đã đọc.'
    setNotificationActionFeedback(errorMessage)
    setNotificationAnnouncement(errorMessage)
  }

  function markNotificationRead(notification) {
    setNotificationsOpen(false)
    setNotificationActionFeedback('')
    const target = getNotificationTarget(notification)
    const notificationId = notification.id
    const userId = notificationUserIdRef.current
    let optimisticRead = null

    if (
      notification.read_at === null
      && notificationId
      && userId
      && !pendingNotificationReadsRef.current.has(notificationId)
    ) {
      const readAt = new Date().toISOString()
      const token = Symbol(notificationId)
      optimisticRead = { notificationId, readAt, token, userId }
      pendingNotificationReadsRef.current.set(notificationId, { readAt, token })
      setNotifications((current) => current.map((item) => (
        item.id === notificationId ? { ...item, read_at: readAt } : item
      )))
    }

    navigate(target)

    if (optimisticRead) {
      void persistNotificationRead(optimisticRead)
    }
  }

  async function markAllNotificationsRead() {
    const userId = notificationUserIdRef.current
    if (!userId || unreadNotificationCount === 0) return

    const readAt = new Date().toISOString()
    setNotificationActionFeedback('')
    setNotifications((current) => current.map((notification) => (
      notification.read_at === null
        ? { ...notification, read_at: readAt }
        : notification
    )))

    let updateFailed

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: readAt })
        .eq('recipient_id', userId)
        .is('read_at', null)

      updateFailed = Boolean(error)
    } catch {
      updateFailed = true
    }

    if (
      !notificationsMountedRef.current
      || notificationUserIdRef.current !== userId
    ) return

    if (updateFailed) {
      setNotificationActionFeedback('Chưa đánh dấu được tất cả thông báo là đã đọc.')
      await loadNotifications({ silent: true })
    }
  }

  async function handleLogout(event) {
    event.preventDefault()

    try {
      await logoutAccount()

      pendingNotificationReadsRef.current.clear()
      notificationUserIdRef.current = null
      if (notificationChannelRef.current) {
        await supabase.removeChannel(notificationChannelRef.current)
        notificationChannelRef.current = null
      }

      if (messageUnreadChannelRef.current) {
        await supabase.removeChannel(messageUnreadChannelRef.current)
        messageUnreadChannelRef.current = null
      }

      if (profileChannelRef.current) {
        await supabase.removeChannel(profileChannelRef.current)
        profileChannelRef.current = null
      }

      window.location.assign('/login')
    } catch {
      setLogoutError('Không thể đăng xuất. Hãy tải lại trang và thử lại.')
    }
  }

  return (
    <div className={`app-shell product-shell ${sidebarCollapsed ? 'sidebar-is-collapsed' : 'sidebar-is-expanded'}`}>
      <aside id="primary-sidebar" className="app-sidebar product-sidebar">
        <Link to="/dashboard" className="app-brand product-brand" aria-label="CocoApp">
          <span className="app-brand-icon">C</span>
          <span className="app-brand-name">Coco<span>.</span></span>
        </Link>

        <div className="workspace-pill">
          <span className="workspace-dot" />
          <div>
            <strong>Campus space</strong>
            <span>Cộng đồng sinh viên</span>
          </div>
        </div>

        <p className="sidebar-label">ĐIỀU HƯỚNG</p>

        <nav className="sidebar-nav" aria-label="Điều hướng chính">
          {menuItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              aria-label={`${item.label}${item.to === '/matches' && unreadMessageCount > 0 ? `, ${unreadMessageCount} tin nhắn chưa đọc` : ''}`}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <span className="sidebar-icon"><Icon name={item.icon}/></span>
              <span className="sidebar-link-copy">
                <strong>{item.label}</strong>
                <small>{item.hint}</small>
              </span>
              {item.to === '/matches' && unreadMessageCount > 0 && (
                <span className="navigation-unread-badge" aria-hidden="true">
                  {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-promo">
          <span><Icon name="spark" /> GỢI Ý</span>
          <strong>Hồ sơ tốt tạo kết nối tốt hơn</strong>
          <Link to="/profile">Hoàn thiện hồ sơ</Link>
        </div>

        <div className="sidebar-bottom">
          <NavLink to="/profile" className="student-card sidebar-user-link">
            <div className="student-avatar">{avatarLetter}</div>
            <div><strong>{fullName}</strong><span>Xem hồ sơ</span></div>
          </NavLink>

          <a href="/login" className="logout-button" onClick={handleLogout} aria-label="Đăng xuất">
            <Icon name="logout"/><span>Đăng xuất</span>
          </a>
        </div>
      </aside>

      <div className="product-main">
        <header className="product-topbar">
          <div className="topbar-leading">
            <button
              type="button"
              className="sidebar-toggle"
              aria-label={sidebarCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
              aria-controls="primary-sidebar"
              aria-expanded={!sidebarCollapsed}
              onClick={() => setSidebarCollapsed((current) => !current)}
            >
              <Icon name="menu" />
            </button>

            <div className="topbar-title">
              <span>COCO COMMUNITY</span>
              <strong>{pageTitle}</strong>
            </div>
          </div>

          <div className="topbar-actions">
            <span className="demo-status"><i /> Prototype</span>
            <div className="notification-menu" ref={notificationRootRef}>
              <button
                ref={notificationButtonRef}
                type="button"
                className="topbar-icon-button"
                aria-label={`Thông báo${unreadNotificationCount > 0 ? `, ${unreadNotificationCount} chưa đọc` : ''}`}
                aria-haspopup="dialog"
                aria-expanded={notificationsOpen}
                aria-controls="notification-panel"
                onClick={() => setNotificationsOpen((current) => !current)}
              >
                <Icon name="bell" />
                {unreadNotificationCount > 0 && (
                  <span className="notification-badge" aria-hidden="true">
                    {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <section
                  ref={notificationPanelRef}
                  id="notification-panel"
                  className="notification-panel"
                  role="dialog"
                  aria-label="Thông báo Coco"
                >
                  <header className="notification-panel-header">
                    <div>
                      <span>COCO CAMPUS</span>
                      <h2>Thông báo</h2>
                    </div>
                    <button
                      type="button"
                      className="notification-mark-all"
                      disabled={unreadNotificationCount === 0}
                      onClick={markAllNotificationsRead}
                    >
                      Đánh dấu tất cả đã đọc
                    </button>
                  </header>

                  {!notificationsLoadError && notificationTransportFeedback && (
                    <p className="notification-error" role="alert">{notificationTransportFeedback}</p>
                  )}
                  {!notificationsLoadError && notificationActionFeedback && (
                    <p className="notification-error" role="alert">{notificationActionFeedback}</p>
                  )}

                  <div className="notification-list" aria-busy={notificationsLoading}>
                    {notificationsLoading ? (
                      <p className="notification-empty" role="status">Đang tải thông báo…</p>
                    ) : notificationsLoadError ? (
                      <div className="notification-empty" role="alert">
                        <p>{notificationsLoadError}</p>
                        <button
                          type="button"
                          className="view-student-button"
                          onClick={() => void loadNotifications()}
                        >
                          Thử tải lại
                        </button>
                      </div>
                    ) : notifications.length === 0 ? (
                      <p className="notification-empty">Chưa có thông báo mới.</p>
                    ) : notifications.map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        className={`notification-item ${notification.read_at === null ? 'is-unread' : ''}`}
                        onClick={() => markNotificationRead(notification)}
                      >
                        <span className="notification-item-icon" aria-hidden="true">
                          <Icon name={isCocoPlanNotification(notification) ? 'spark' : 'connection'} />
                        </span>
                        <span className="notification-item-copy">
                          <strong>{getNotificationMessage(notification)}</strong>
                          <small>{formatNotificationTime(notification.created_at)}</small>
                        </span>
                        {notification.read_at === null && (
                          <span className="notification-unread-dot">
                            <span className="notification-sr-only">Chưa đọc</span>
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>
            <Link to="/profile" className="topbar-account">
              <span className="mobile-avatar">{avatarLetter}</span>
              <span><strong>{fullName}</strong><small>Sinh viên</small></span>
            </Link>
          </div>
        </header>

        {logoutError && (
          <div className="shell-status-message" role="alert" aria-live="assertive">
            {logoutError}
          </div>
        )}

        <p className="notification-live-region" aria-live="polite" aria-atomic="true">
          {notificationAnnouncement}
        </p>

        <main ref={mainRef} className="app-content" tabIndex="-1">{children}</main>
      </div>

      <nav className="mobile-bottom-nav" aria-label="Điều hướng điện thoại">
        {mobileMenuItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => isActive ? 'active' : ''}
            aria-label={`${item.label}${item.to === '/matches' && unreadMessageCount > 0 ? `, ${unreadMessageCount} tin nhắn chưa đọc` : ''}`}
          >
            <Icon name={item.icon}/><span>{item.label}</span>
            {item.to === '/matches' && unreadMessageCount > 0 && (
              <span className="navigation-unread-badge" aria-hidden="true">
                {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
