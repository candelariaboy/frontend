import { useEffect, useState } from "react"
import { NavLink } from "react-router-dom"
import { clearAllStoredAppData, fetchMyCertificates, fetchOwnerPortfolio, fetchProjectLearningPaths, getStoredAuth, logoutAuth, pingAuth, setStoredAuth } from "../lib/api"
import { getStudentCertificatesNotificationTotal } from "../lib/certificateNotifications"
import { getStudentLearningPathNotificationCount } from "../lib/learningPathNotifications"

export default function Navbar({
  collapsed: collapsedProp,
  onToggle,
}: {
  collapsed?: boolean
  onToggle?: () => void
} = {}) {
  const storedAuth = getStoredAuth()
  const username = storedAuth.username
  const token = storedAuth.token
  const isUserLoggedIn = Boolean(storedAuth.token && storedAuth.username)
  const [localCollapsed, setLocalCollapsed] = useState(false)
  const collapsed = typeof collapsedProp === "boolean" ? collapsedProp : localCollapsed
  const [avatarUrl, setAvatarUrl] = useState(storedAuth.avatarUrl)
  const [claimableBadgeCount, setClaimableBadgeCount] = useState(0)
  const [unreadFeedbackCount, setUnreadFeedbackCount] = useState(0)
  const [unreadCertificateCount, setUnreadCertificateCount] = useState(0)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const userInitial = (username || "U").trim().charAt(0).toUpperCase()

  const navItems = [
    { to: "/dashboard", label: "Dashboard", icon: "home" },
    { to: "/learning-paths", label: "Learning Paths", icon: "book", count: unreadFeedbackCount },
    { to: "/certificates", label: "Certificates", icon: "certificate", count: unreadCertificateCount },
    { to: "/achievements", label: "Achievements", icon: "trophy", count: claimableBadgeCount },
    { to: "/leaderboard", label: "Leaderboard", icon: "leaderboard" },
    { to: "/my-portfolio", label: "Portfolio", icon: "folder" },
  ]

  function Icon({ name, active }: { name: string; active: boolean }) {
    const cls = `h-5 w-5 flex-shrink-0 ${active ? "text-white" : "text-[#5b6b86] group-hover:text-[#2d3b5a]"}`
    switch (name) {
      case "home":
        return (
          <svg className={cls} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="M3 10.5L12 4l9 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 21V12h6v9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )
      case "book":
        return (
          <svg className={cls} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 7v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )
      case "clipboard":
        return (
          <svg className={cls} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <rect x="7" y="4" width="10" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M9 8h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )
      case "trophy":
        return (
          <svg className={cls} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="M8 3h8v3a4 4 0 01-4 4H12a4 4 0 01-4-4V3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 7a6 6 0 006 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M20 7a6 6 0 01-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 21h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )
      case "folder":
        return (
          <svg className={cls} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )
      case "leaderboard":
        return (
          <svg className={cls} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="M6 20V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 20V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M18 20v-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 20h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )
      case "certificate":
        return (
          <svg className={cls} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="M4 7a2 2 0 012-2h12a2 2 0 012 2v7a2 2 0 01-2 2H6a2 2 0 01-2-2V7z" stroke="currentColor" strokeWidth="1.5" />
            <path d="M9 10h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M10 16l2 4 2-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )
      default:
        return <span className={cls} />
    }
  }

  useEffect(() => {
    const stored = getStoredAuth()
    if (!stored.token) return
    pingAuth(stored.token).catch(() => {
      clearAllStoredAppData()
    })
  }, [])

  useEffect(() => {
    setAvatarUrl(storedAuth.avatarUrl)
  }, [storedAuth.avatarUrl])

  useEffect(() => {
    if (!token || !username || avatarUrl) return
    let cancelled = false

    fetchOwnerPortfolio(token)
      .then((data) => {
        const nextAvatar = data?.profile?.avatarUrl?.trim() || ""
        if (!nextAvatar || cancelled) return
        setAvatarUrl(nextAvatar)
        setStoredAuth(token, username, nextAvatar)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [avatarUrl, token, username])

  useEffect(() => {
    if (!token) {
      setClaimableBadgeCount(0)
      return
    }
    let cancelled = false

    const refreshClaimableBadges = () => {
      fetchOwnerPortfolio(token)
        .then((data) => {
          if (cancelled) return
          const count = (data?.badges || []).filter((badge) => badge.achieved && !badge.claimed).length
          setClaimableBadgeCount(count)
        })
        .catch(() => {
          if (cancelled) return
          setClaimableBadgeCount(0)
        })
    }

    refreshClaimableBadges()
    const intervalId = window.setInterval(refreshClaimableBadges, 4000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [token])

  useEffect(() => {
    const handleClaimableBadgesUpdate = (event: Event) => {
      const nextCount = Number((event as CustomEvent<{ count?: number }>).detail?.count ?? 0)
      setClaimableBadgeCount(Number.isFinite(nextCount) ? nextCount : 0)
    }

    window.addEventListener("devpath:claimable-badges", handleClaimableBadgesUpdate as EventListener)
    return () => {
      window.removeEventListener("devpath:claimable-badges", handleClaimableBadgesUpdate as EventListener)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const refreshUnread = () => {
      const { username: currentUsername } = getStoredAuth()
      if (!currentUsername) {
        if (cancelled) return
        setUnreadFeedbackCount(0)
        return
      }
      fetchProjectLearningPaths(currentUsername)
        .then((data) => {
          if (cancelled) return
          setUnreadFeedbackCount(getStudentLearningPathNotificationCount(currentUsername, data))
        })
        .catch(() => {
          if (cancelled) return
          setUnreadFeedbackCount(0)
        })
    }

    refreshUnread()
    const intervalId = window.setInterval(refreshUnread, 4000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    if (!token || !username) {
      setUnreadCertificateCount(0)
      return
    }
    let cancelled = false

    const refreshUnread = () => {
      fetchMyCertificates(token)
        .then((data) => {
          if (cancelled) return
          setUnreadCertificateCount(getStudentCertificatesNotificationTotal(username, Array.isArray(data) ? data : []))
        })
        .catch(() => {
          if (cancelled) return
          setUnreadCertificateCount(0)
        })
    }

    refreshUnread()
    const intervalId = window.setInterval(refreshUnread, 4000)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [token, username])

  function toggleCollapsed() {
    if (onToggle) {
      onToggle()
    } else {
      setLocalCollapsed((s) => !s)
    }
  }

  async function handleLogout() {
    try {
      const stored = getStoredAuth()
      if (stored && stored.token) {
        await logoutAuth(stored.token)
      }
    } catch (e) {
      // ignore logout errors
    }
    clearAllStoredAppData()
    window.location.href = "/"
  }

  return (
    <aside
      className={`h-full w-full text-[#2a2f45] transition-all duration-300 ease-in-out lg:${collapsed ? "w-28" : "w-[320px]"}`}
      aria-expanded={!collapsed}
    >
      <div className="relative h-full">
        <div className="relative z-10 flex h-full flex-col px-3 py-5">
          <div className="pointer-events-none absolute -left-4 top-10 h-24 w-24 rounded-full bg-[#c7d2fe] opacity-40 blur-2xl" />
          <div className="pointer-events-none absolute -right-6 bottom-8 h-24 w-24 rounded-full bg-[#bae6fd] opacity-40 blur-2xl" />
          <div className="flex h-full flex-col rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(246,249,255,0.9))] p-3 shadow-[0_18px_40px_rgba(64,85,140,0.18)] backdrop-blur">
            {/* Header */}
            <button
              type="button"
              aria-pressed={collapsed}
              onClick={toggleCollapsed}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={`mb-4 flex w-full items-center rounded-2xl border border-[#e4ebff] bg-white/90 p-3 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7aa2ff] ${
                collapsed ? "gap-3 lg:h-[72px] lg:justify-center lg:rounded-[24px] lg:p-0" : "gap-3"
              }`}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={username || "Student"}
                  className="h-12 w-12 rounded-full object-cover shadow-[0_10px_18px_rgba(73,96,169,0.35)]"
                />
              ) : (
                <div className="grid h-12 w-12 place-items-center rounded-full bg-[linear-gradient(135deg,#5b6cff,#8ad9ff)] text-sm font-semibold text-white shadow-[0_10px_18px_rgba(73,96,169,0.35)]">
                  {userInitial}
                </div>
              )}
              {!collapsed ? (
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[#8b93aa]">Good Day</p>
                  <p className="text-[16px] font-semibold text-[#1f2435]">{username || "Student"}</p>
                </div>
              ) : null}
            </button>

            {!collapsed ? <p className="px-2 text-[11px] uppercase tracking-[0.2em] text-[#9aa0b5]">Menu</p> : null}

            {/* Menu */}
            <nav className="mt-3 flex-1">
              <ul className="space-y-2">
                {navItems.map((item) => (
                  <li key={item.to}>
                    <NavLink to={item.to} className="block">
                      {({ isActive }) => (
                        <div
                          className={`group relative flex w-full items-center rounded-2xl px-3 py-2.5 transition-all duration-200 ease-in-out ${
                            isActive
                              ? "bg-[#3b82f6] text-white shadow-[0_12px_26px_rgba(59,130,246,0.35)]"
                              : "text-[#4b5563] hover:bg-[#eef4ff]"
                          } ${collapsed ? "gap-3 lg:justify-center" : "gap-3"}`}
                        >
                          <span className={`grid h-9 w-9 place-items-center rounded-xl ${isActive ? "bg-white/20" : "bg-white"}`}>
                            <Icon name={item.icon} active={isActive} />
                          </span>
                          {!collapsed ? <span className="truncate text-[13px] font-medium">{item.label}</span> : null}
                          {Number(item.count || 0) > 0 ? (
                            <span
                              className={`sidebar-notification-badge ml-auto inline-flex min-w-[22px] items-center justify-center rounded-full bg-[#ef4444] px-1.5 py-0.5 text-[11px] font-semibold text-white ${
                                collapsed ? "lg:absolute lg:right-2 lg:top-2 lg:min-w-[18px] lg:px-1 lg:py-0 lg:text-[10px]" : ""
                              }`}
                            >
                              {item.count}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Footer / Controls */}
            <div className="mt-auto pt-5">
              <div className={`mt-3 flex ${collapsed ? "flex-col items-center gap-2" : "flex-col gap-2"}`}>
                {isUserLoggedIn ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowLogoutConfirm(true)}
                      title="Logout"
                      aria-label="Logout"
                      className={`flex items-center gap-2 rounded-2xl border border-[#f3b4b4] bg-[#c62828] px-3 py-2 text-white shadow-sm transition hover:bg-[#b71c1c] ${collapsed ? "h-11 w-11 justify-center" : "h-11"}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor">
                        <path d="M16 17l5-5-5-5" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M21 12H9" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M13 19H6a2 2 0 01-2-2V7a2 2 0 012-2h7" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {!collapsed ? <span className="text-[12px] font-medium">Logout</span> : null}
                    </button>
                  </>
                ) : (
                  <div className="h-10 w-10" />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {showLogoutConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/35 px-4">
          <div className="w-full max-w-[340px] rounded-[24px] border border-[#e5e7eb] bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
            <p className="text-[16px] font-semibold text-[#1f2435]">Are you sure want to logout?</p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="rounded-2xl border border-[#d7deea] bg-white px-4 py-2 text-[13px] font-medium text-[#344054] transition hover:bg-[#f8fafc]"
              >
                No
              </button>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="rounded-2xl border border-[#f3b4b4] bg-[#c62828] px-4 py-2 text-[13px] font-medium text-white transition hover:bg-[#b71c1c]"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  )
}
