import { NavLink, Link } from 'react-router-dom'
import { accountStorage, logoutAccount } from '../auth'

function getProfileName() {
  try {
    const profile = JSON.parse(
      accountStorage.getItem('cocoapp.profile.v1') || 'null'
    )
    return typeof profile?.fullName === 'string'
      ? profile.fullName.trim() || 'Sinh viên'
      : 'Sinh viên'
  } catch {
    return 'Sinh viên'
  }
}

function Icon({ name }) {
  const paths = {
    dashboard: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M9.5 20v-6h5v6"/></>,
    discover: <><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.1 4.9-4.9 2.1 2.1-4.9 4.9-2.1Z"/></>,
    study: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22V5.5Z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22V5.5Z"/></>,
    team: <><circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2"/><path d="M16 5.2a3 3 0 0 1 0 5.6"/><path d="M18 13.4A6 6 0 0 1 21 19v2"/></>,
    room: <><path d="m3 11 9-7 9 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M9 14h6"/></>,
    connection: <><circle cx="8" cy="8" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M2.5 21v-2a5.5 5.5 0 0 1 11 0v2"/><path d="M14 16a4.5 4.5 0 0 1 7.5 3.4V21"/></>,
    profile: <><circle cx="12" cy="8" r="3.2"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></>,
    logout: <><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M14 3h4a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-4"/></>,
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

const menuItems = [
  { to: '/dashboard', icon: 'dashboard', label: 'Tổng quan' },
  { to: '/discover', icon: 'discover', label: 'Khám phá' },
  { to: '/study', icon: 'study', label: 'Học nhóm' },
  { to: '/team', icon: 'team', label: 'Team Project' },
  { to: '/roommates', icon: 'room', label: 'Ghép trọ' },
  { to: '/matches', icon: 'connection', label: 'Kết nối' },
]

export default function AppLayout({ children }) {
  const fullName = getProfileName()
  const avatarLetter = fullName.split(/\s+/).pop()[0].toUpperCase()

  function handleLogout(event) {
    try {
      logoutAccount()
    } catch {
      event.preventDefault()
      alert('Không thể đăng xuất. Hãy tải lại trang và thử lại.')
    }
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link to="/dashboard" className="app-brand" aria-label="CocoApp">
          <span className="app-brand-icon">C</span>
          <span className="app-brand-name">Coco<span>.</span></span>
        </Link>

        <p className="sidebar-label">KHÔNG GIAN CỦA BẠN</p>

        <nav className="sidebar-nav" aria-label="Điều hướng chính">
          {menuItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <span className="sidebar-icon"><Icon name={item.icon}/></span>
              <span className="sidebar-link-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <NavLink to="/profile" className="sidebar-link">
            <span className="sidebar-icon"><Icon name="profile"/></span>
            <span className="sidebar-link-label">Hồ sơ của tôi</span>
          </NavLink>

          <Link to="/login" replace className="logout-button" onClick={handleLogout}>
            <Icon name="logout"/><span>Đăng xuất</span>
          </Link>

          <div className="student-card">
            <div className="student-avatar">{avatarLetter}</div>
            <div><strong>{fullName}</strong><span>Sinh viên</span></div>
          </div>
        </div>
      </aside>

      <header className="mobile-app-header">
        <Link to="/dashboard" className="mobile-brand">
          <span className="app-brand-icon">C</span>
          <strong>Coco<span>.</span></strong>
        </Link>
        <div className="mobile-header-actions">
          <NavLink to="/profile" aria-label="Mở hồ sơ"><span className="mobile-avatar">{avatarLetter}</span></NavLink>
          <Link to="/login" replace className="mobile-logout" onClick={handleLogout} aria-label="Đăng xuất"><Icon name="logout"/></Link>
        </div>
      </header>

      <main className="app-content">{children}</main>
    </div>
  )
}
