import { Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom"
import { lazy, Suspense, useEffect, useState } from "react"
import Navbar from "./components/Navbar"
import {
  clearStoredAuth,
  getStoredAuth,
  markUserFirstSeen,
  pingAuth,
  setStoredAuth,
} from "./lib/api"

const AchievementsPage = lazy(() => import("./pages/AchievementsPage"))
const AdminAiEvaluationPage = lazy(() => import("./pages/AdminAiEvaluationPage"))
const AdminCertificatesPage = lazy(() => import("./pages/AdminCertificatesPage"))
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage"))
const AdminLoginPage = lazy(() => import("./pages/AdminLoginPage"))
const AdminStudentsPage = lazy(() => import("./pages/AdminStudentsPage"))
const CertificatesPage = lazy(() => import("./pages/CertificatesPage"))
const DashboardPage = lazy(() => import("./pages/DashboardPage"))
const LandingPage = lazy(() => import("./pages/LandingPage"))
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage"))
const LearningPathsPage = lazy(() => import("./pages/LearningPathsPage"))
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"))
const PublicPortfolioPage = lazy(() => import("./pages/PublicPortfolioPage"))
const RegisterPage = lazy(() => import("./pages/RegisterPage"))
const StudentLeaderboardPage = lazy(() => import("./pages/StudentLeaderboardPage"))

/** Nested admin routes; `key` forces correct child when URL and outlet get out of sync (RR7 edge cases). */
function AdminOutlet() {
  const { pathname } = useLocation()
  return <Outlet key={pathname} />
}

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const isPublicPortfolio = location.pathname.startsWith("/p/")
  const isAdminRoute = location.pathname.startsWith("/admin")
  const isLanding = location.pathname === "/"
  const isAdminLogin = location.pathname === "/admin-login"
  const isRegister = location.pathname.startsWith("/register")
  const showStudentSidebar = !isPublicPortfolio && !isAdminRoute && !isLanding && !isAdminLogin && !isRegister
  const auth = getStoredAuth()
  const [routeLoading, setRouteLoading] = useState(false)
  const [studentSidebarCollapsed, setStudentSidebarCollapsed] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const token = params.get("token") || ""
    const username = params.get("username") || ""
    const avatar = params.get("avatar") || ""
    const stored = getStoredAuth()
    // Accept query params only for real auth callback flows (token present).
    // Ignore standalone username query changes to avoid switching accounts unintentionally.
    if (token && username) {
      setStoredAuth(token, username, avatar || undefined)
      navigate(location.pathname, { replace: true })
      return
    }
    if (token && stored.username) {
      setStoredAuth(token, stored.username, stored.avatarUrl || undefined)
      navigate(location.pathname, { replace: true })
    }
  }, [location.pathname, location.search, navigate])

  useEffect(() => {
    const stored = getStoredAuth()
    if (!stored.username) return
    markUserFirstSeen(stored.username)
  }, [location.pathname])

  useEffect(() => {
    document.documentElement.classList.remove("dark")
    localStorage.removeItem("devpath_theme")
  }, [])

  useEffect(() => {
    setRouteLoading(true)
    const timer = window.setTimeout(() => setRouteLoading(false), 450)
    return () => window.clearTimeout(timer)
  }, [location.pathname])

  useEffect(() => {
    if (isAdminRoute || isPublicPortfolio) {
      return
    }
    const heartbeat = () => {
      const stored = getStoredAuth()
      if (!stored.token) return
      pingAuth(stored.token).catch(() => {})
    }
    heartbeat()
    const interval = window.setInterval(heartbeat, 10000)
    return () => window.clearInterval(interval)
  }, [isAdminRoute, isPublicPortfolio, location.pathname])

  useEffect(() => {
    if (isAdminRoute || isPublicPortfolio) {
      return
    }
    const stored = getStoredAuth()
    if (!stored.token) return
    pingAuth(stored.token).catch(() => {
      clearStoredAuth()
      if (location.pathname !== "/") {
        window.location.href = "/"
      }
    })
  }, [isAdminRoute, isPublicPortfolio, location.pathname])

  const routesNode = (
    <Suspense fallback={<div className="min-h-screen bg-paper" />}>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/admin-login" element={<AdminLoginPage />} />
      <Route
        path="/dashboard"
        element={<DashboardPage />}
      />
      <Route
        path="/learning-paths"
        element={<LearningPathsPage />}
      />
      <Route path="/certificates" element={<CertificatesPage />} />
      <Route
        path="/achievements"
        element={<AchievementsPage />}
      />
      <Route path="/leaderboard" element={<StudentLeaderboardPage />} />
      <Route
        path="/portfolio/:username"
        element={auth.username ? <PublicPortfolioPage mode="owner" /> : <NotFoundPage message="Sign in to view this page." />}
      />
      <Route path="/p/:username" element={<PublicPortfolioPage mode="public" />} />
      <Route
        path="/my-portfolio"
        element={<PublicPortfolioPage mode="owner" />}
      />
      <Route path="/admin/*" element={<AdminOutlet />}>
        <Route index element={<AdminDashboardPage />} />
        <Route path="students" element={<AdminStudentsPage />} />
        <Route path="students/:username/learning-path" element={<LearningPathsPage adminView />} />
        <Route path="certificates" element={<AdminCertificatesPage />} />
        <Route path="ai-evaluation" element={<AdminAiEvaluationPage />} />
        <Route path="leaderboard" element={<LeaderboardPage />} />
      </Route>
      <Route path="/register" element={<RegisterPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </Suspense>
  )

  const routeLoader = routeLoading ? (
    <div className="fixed inset-x-0 top-0 z-[60]">
      <div className="h-[3px] w-full bg-[linear-gradient(90deg,#4f46e5,#38bdf8,#22c55e)] animate-pulse" />
    </div>
  ) : null

  if (showStudentSidebar) {
    return (
      <div className="app-academic-shell student-ui min-h-screen">
        {routeLoader}
        <div
          className={`lg:fixed lg:inset-y-0 lg:left-0 lg:z-20 ${
            studentSidebarCollapsed ? "lg:w-[112px]" : "lg:w-[320px]"
          }`}
        >
          <Navbar
            collapsed={studentSidebarCollapsed}
            onToggle={() => setStudentSidebarCollapsed((value) => !value)}
          />
        </div>
        <div className={`min-w-0 ${studentSidebarCollapsed ? "lg:pl-[112px]" : "lg:pl-[320px]"}`}>
          {routesNode}
        </div>
      </div>
    )
  }

  // Admin UI: skip app-academic-shell fixed pseudo-layers (can interfere with clicks/stacking on some browsers).
  const outerShellClass = isAdminRoute ? "min-h-screen" : "app-academic-shell min-h-screen"
  return (
    <div className={`${outerShellClass}${!isAdminRoute && !isLanding && !isAdminLogin && !isRegister ? " student-ui" : ""}`}>
      {routeLoader}
      {routesNode}
    </div>
  )
}
