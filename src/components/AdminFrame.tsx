import { motion } from "framer-motion"
import { useEffect, useState, type ReactNode } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { fetchAdminStudentDetails, fetchAdminStudents, fetchProjectLearningPaths, getStoredAdminAuth, signOutAdmin } from "../lib/api"
import { getAdminCertificatesNotificationTotal } from "../lib/certificateNotifications"
import { getAdminLearningPathNotificationCount } from "../lib/learningPathNotifications"
import NotFoundPage from "../pages/NotFoundPage"

type AdminFrameProps = {
  children: ReactNode
  showBuiltInToolbar?: boolean
}

type AdminNavItemProps = {
  to: string
  end?: boolean
  eyebrow: string
  label: string
  icon: ReactNode
  count?: number
}

const frameFadeIn = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.38 } },
}

function resolvePageMeta(pathname: string) {
  if (pathname === "/admin") {
    return {
      eyebrow: "Overview",
      title: "Admin command center",
      description: "Monitor students, review quality signals, and keep the academic workspace consistent.",
    }
  }
  if (pathname.startsWith("/admin/students")) {
    return {
      eyebrow: "Directory",
      title: "Student operations",
      description: "Review student records, verification state, and academic activity in one workspace.",
    }
  }
  if (pathname.startsWith("/admin/certificates")) {
    return {
      eyebrow: "Certificates",
      title: "Certificate review",
      description: "Review proof submissions, track verification, and keep certificate records current.",
    }
  }
  if (pathname.startsWith("/admin/ai-evaluation")) {
    return {
      eyebrow: "AI Metrics",
      title: "Evaluation metrics",
      description: "Inspect model quality, recommendation outcomes, and evaluation snapshots.",
    }
  }
  if (pathname.startsWith("/admin/leaderboard")) {
    return {
      eyebrow: "Leaderboard",
      title: "Ranking workspace",
      description: "Track engagement and XP movement across the active student cohort.",
    }
  }
  return {
    eyebrow: "Admin",
    title: "Admin console",
    description: "Manage the student portfolio system from one control surface.",
  }
}

function AdminSidebarNavItem({ to, end, eyebrow, label, icon, count = 0 }: AdminNavItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `admin-nav-item ${isActive ? "admin-nav-item-active" : "admin-nav-item-idle"}`
      }
    >
      {({ isActive }) => (
        <>
          <span className={`admin-nav-badge ${isActive ? "admin-nav-badge-active" : "admin-nav-badge-idle"}`}>{icon}</span>
          <span className="min-w-0 flex-1">
            <span className={`block text-[10px] font-semibold uppercase tracking-[0.18em] ${isActive ? "text-[#6b7280]" : "text-[#7c8aa5]"}`}>
              {eyebrow}
            </span>
            <span className="mt-1 block truncate text-sm font-semibold text-[#111827]">{label}</span>
          </span>
          {count > 0 ? (
            <span className="ml-3 inline-flex min-w-[22px] items-center justify-center rounded-full bg-[#ef4444] px-2 py-1 text-[10px] font-bold leading-none text-white">
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </>
      )}
    </NavLink>
  )
}

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="5" rx="2" />
      <rect x="13" y="10" width="8" height="11" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
    </svg>
  )
}

function StudentsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9.5" cy="7" r="3.2" />
      <path d="M20 21v-2a3.5 3.5 0 0 0-2.5-3.35" />
      <path d="M15.5 3.5a3.2 3.2 0 0 1 0 6.2" />
    </svg>
  )
}

function CertificateIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8" />
      <path d="M8 12h8" />
      <path d="M8 16h5" />
    </svg>
  )
}

function AiMetricsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v4" />
      <path d="M12 17v4" />
      <path d="M3 12h4" />
      <path d="M17 12h4" />
      <rect x="7" y="7" width="10" height="10" rx="2" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  )
}

function LeaderboardIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 20V10" />
      <path d="M12 20V4" />
      <path d="M18 20v-7" />
      <path d="M4 20h16" />
    </svg>
  )
}

function AdminToolbar() {
  const auth = getStoredAdminAuth()
  const location = useLocation()
  const page = resolvePageMeta(location.pathname)

  return (
    <motion.section {...frameFadeIn} className="admin-surface admin-surface-animated rounded-[24px] border border-[#e5ebf3] px-6 py-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7c8aa5]">{page.eyebrow}</p>
          <h1 className="mt-2 text-[30px] font-semibold leading-tight text-[#101828]">{page.title}</h1>
          <p className="mt-2 text-sm leading-6 text-[#667085]">{page.description}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[18px] border border-[#e6edf5] bg-[#f8fafc] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#98a2b3]">Workspace</p>
            <p className="mt-1 text-sm font-semibold text-[#111827]">LSPU portfolio admin</p>
          </div>
          <div className="rounded-[18px] border border-[#e6edf5] bg-[#f8fafc] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#98a2b3]">Signed in</p>
            <p className="mt-1 text-sm font-semibold text-[#111827]">{auth.username || "Admin"}</p>
          </div>
        </div>
      </div>
    </motion.section>
  )
}

export default function AdminFrame({ children, showBuiltInToolbar = true }: AdminFrameProps) {
  const auth = getStoredAdminAuth()
  const [studentNotificationCount, setStudentNotificationCount] = useState(0)
  const [certificateNotificationCount, setCertificateNotificationCount] = useState(0)

  useEffect(() => {
    if (!auth.token) {
      setStudentNotificationCount(0)
      return
    }
    let cancelled = false

    const refreshNotifications = async () => {
      try {
        const students = (await fetchAdminStudents(auth.token)) as Array<{ id: number; username: string }>
        const entries = students
          .map((student) => ({ id: Number(student.id || 0), username: String(student.username || "").trim() }))
          .filter((student) => student.id > 0 && student.username)
        const responses = await Promise.all(
          entries.map(async ({ id, username }) => {
            try {
              const [learningPath, details] = await Promise.all([
                fetchProjectLearningPaths(username),
                fetchAdminStudentDetails(auth.token, id),
              ])
              return {
                learningPath: getAdminLearningPathNotificationCount(username, learningPath),
                certificates: getAdminCertificatesNotificationTotal(username, details?.certificates || []),
              }
            } catch {
              return { learningPath: 0, certificates: 0 }
            }
          })
        )
        if (!cancelled) {
          setStudentNotificationCount(responses.reduce((sum, item) => sum + item.learningPath, 0))
          setCertificateNotificationCount(responses.reduce((sum, item) => sum + item.certificates, 0))
        }
      } catch {
        if (!cancelled) {
          setStudentNotificationCount(0)
          setCertificateNotificationCount(0)
        }
      }
    }

    refreshNotifications()
    const intervalId = window.setInterval(refreshNotifications, 4000)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [auth.token])

  if (!auth.token) {
    return <NotFoundPage message="Sign in as admin to view this page." />
  }

  return (
    <div className="admin-app-root min-h-screen text-[#111827]">
      <div className="admin-grid-shell mx-auto flex min-h-screen max-w-[1680px] gap-6 px-4 py-4 lg:px-6 lg:py-6">
        <aside className="hidden w-[292px] shrink-0 xl:block">
          <motion.div
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0, transition: { duration: 0.4 } }}
            className="admin-sidebar-panel sticky top-6 flex min-h-[calc(100vh-48px)] flex-col rounded-[28px] border border-[#d9e2ec] bg-[#f8fafc] p-4 shadow-[0_18px_44px_rgba(15,23,42,0.08)]"
          >
            <motion.div whileHover={{ y: -2 }} className="rounded-[22px] border border-[#e3e8ef] bg-white p-4">
              <div className="flex items-start gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[16px] border border-[#dbe4ee] bg-[#f8fafc]">
                  <img src="/lspu logo.png" alt="LSPU" className="h-10 w-10 object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#98a2b3]">Admin console</p>
                  <p className="mt-1 text-base font-semibold text-[#111827]">Admin Console</p>
                  <p className="mt-1 text-sm leading-5 text-[#667085]">Students, evaluations, and oversight tools.</p>
                </div>
              </div>
            </motion.div>

            <nav className="mt-4 space-y-2" aria-label="Admin">
              <AdminSidebarNavItem to="/admin" end eyebrow="HQ" label="Dashboard" icon={<DashboardIcon />} />
              <AdminSidebarNavItem to="/admin/students" eyebrow="ST" label="Students" icon={<StudentsIcon />} count={studentNotificationCount} />
              <AdminSidebarNavItem to="/admin/certificates" eyebrow="CR" label="Certificates" icon={<CertificateIcon />} count={certificateNotificationCount} />
              <AdminSidebarNavItem to="/admin/ai-evaluation" eyebrow="AI" label="AI Metrics" icon={<AiMetricsIcon />} />
              <AdminSidebarNavItem to="/admin/leaderboard" eyebrow="LB" label="Leaderboard" icon={<LeaderboardIcon />} />
            </nav>

            <motion.div whileHover={{ y: -2 }} className="mt-auto rounded-[22px] border border-[#e3e8ef] bg-white p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#98a2b3]">Session</p>
              <p className="mt-2 text-sm font-semibold text-[#111827]">{auth.username || "Admin"}</p>
              <p className="mt-1 text-sm leading-5 text-[#667085]">Use the admin panel to review student records and maintain data quality.</p>
              <button
                type="button"
                className="mt-4 w-full rounded-[16px] border border-[#efb4b4] bg-[#c62828] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#b71c1c]"
                onClick={() => signOutAdmin("/")}
              >
                Logout
              </button>
            </motion.div>
          </motion.div>
        </aside>

        <main className="min-w-0 flex-1">
          <motion.div {...frameFadeIn} className="space-y-5">
            {showBuiltInToolbar ? <AdminToolbar /> : null}
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  )
}
