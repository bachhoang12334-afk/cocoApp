import { Component, Fragment, Suspense, lazy, useEffect, useState } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom'

import {
  getCurrentAccount,
  subscribeToAuthState,
} from './auth'
import './App.css'
import './ProductV2.css'

const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Profile = lazy(() => import('./pages/Profile'))
const Discover = lazy(() => import('./pages/Discover'))
const Matches = lazy(() => import('./pages/Matches'))
const SafetyCenter = lazy(() => import('./pages/SafetyCenter'))

function RouteLoadingState() {
  return (
    <main className="route-loading-page" role="status" aria-live="polite" aria-busy="true">
      <div className="route-loading-card">
        <span className="route-loading-mark" aria-hidden="true">C</span>
        <div>
          <strong>Đang mở không gian Coco…</strong>
          <span>Chuẩn bị đúng nội dung cho cậu.</span>
        </div>
        <i className="route-loading-progress" aria-hidden="true" />
      </div>
    </main>
  )
}

class RouteErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="route-loading-page">
          <section className="route-loading-card route-loading-error" role="alert">
            <span className="route-loading-mark" aria-hidden="true">C</span>
            <div>
              <strong>Trang này chưa tải được.</strong>
              <span>Kết nối có thể vừa gián đoạn hoặc Coco vừa được cập nhật.</span>
            </div>
            <button type="button" onClick={() => window.location.reload()}>
              Tải lại Coco
            </button>
          </section>
        </main>
      )
    }

    return this.props.children
  }
}

function RequireLogin({ children, account, isCheckingSession }) {
  if (isCheckingSession) return null

  if (!account) {
    return <Navigate to="/login" replace />
  }

  return (
    <Fragment key={account.id}>
      {children}
    </Fragment>
  )
}

function protectedPage(page, account, isCheckingSession) {
  return (
    <RequireLogin
      account={account}
      isCheckingSession={isCheckingSession}
    >
      {page}
    </RequireLogin>
  )
}

export default function App() {
  const [account, setAccount] = useState(null)
  const [isCheckingSession, setIsCheckingSession] = useState(true)

  useEffect(() => {
    let isMounted = true

    getCurrentAccount()
      .then((user) => {
        if (isMounted) setAccount(user)
      })
      .catch(() => {
        if (isMounted) setAccount(null)
      })
      .finally(() => {
        if (isMounted) setIsCheckingSession(false)
      })

    const unsubscribe = subscribeToAuthState((user) => {
      if (isMounted) {
        setAccount(user)
        setIsCheckingSession(false)
      }
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  return (
    <BrowserRouter>
      {isCheckingSession && (
        <div className="auth-session-loading" role="status" aria-live="polite">
          Đang kiểm tra phiên đăng nhập…
        </div>
      )}

      <RouteErrorBoundary>
        <Suspense fallback={<RouteLoadingState />}>
          <Routes>
        <Route
          path="/"
          element={<Navigate to="/dashboard" replace />}
        />

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route
          path="/dashboard"
          element={protectedPage(<Dashboard />, account, isCheckingSession)}
        />

        <Route
          path="/profile"
          element={protectedPage(<Profile />, account, isCheckingSession)}
        />

        <Route
          path="/discover"
          element={protectedPage(<Discover key="discover" />, account, isCheckingSession)}
        />

        <Route
          path="/study"
          element={protectedPage(<Discover key="study" initialPurpose="Học nhóm" />, account, isCheckingSession)}
        />

        <Route
          path="/team"
          element={protectedPage(<Discover key="team" initialPurpose="Team Project" />, account, isCheckingSession)}
        />

        <Route
          path="/roommates"
          element={protectedPage(<Discover key="roommates" initialPurpose="Ghép trọ" />, account, isCheckingSession)}
        />

        <Route
          path="/matches"
          element={protectedPage(<Matches />, account, isCheckingSession)}
        />

        <Route
          path="/safety"
          element={protectedPage(<SafetyCenter />, account, isCheckingSession)}
        />

        <Route
          path="*"
          element={<Navigate to="/dashboard" replace />}
        />
          </Routes>
        </Suspense>
      </RouteErrorBoundary>
    </BrowserRouter>
  )
}
