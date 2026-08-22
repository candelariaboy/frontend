import { motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import AdminFrame from "../components/AdminFrame"
import {
  fetchAdminAnalytics,
  fetchAdminEvaluationMetrics,
  fetchLoginLive,
  fetchLoginTrends,
  fetchResearchAnalytics,
  getStoredAdminAuth,
  signOutAdmin,
} from "../lib/api"
import type {
  AdminAnalytics,
  AdminEvaluationMetrics,
  LoginActivityTrends,
  ResearchAnalytics,
} from "../types"
import NotFoundPage from "./NotFoundPage"

type StatCardProps = {
  eyebrow: string
  title: string
  value: string
  note: string
}

const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.36 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.32 } },
}

function formatRealtimeDateTime(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  const seconds = String(date.getSeconds()).padStart(2, "0")
  return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`
}

function toIsoDateLocal(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatDateDDMMYYYY(value: string) {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  const day = String(parsed.getDate()).padStart(2, "0")
  const month = String(parsed.getMonth() + 1).padStart(2, "0")
  const year = parsed.getFullYear()
  return `${day}/${month}/${year}`
}

function buildMonthToDateRows(dailyCounts: LoginActivityTrends["daily_counts"]) {
  const countMap = new Map(dailyCounts.map((item) => [item.date, item.count]))
  const today = new Date()
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const rows: Array<{ date: string; count: number }> = []
  for (let cursor = new Date(startOfMonth); cursor <= today; cursor.setDate(cursor.getDate() + 1)) {
    const date = toIsoDateLocal(cursor)
    rows.push({ date, count: countMap.get(date) ?? 0 })
  }
  return rows
}

function StatCard({ eyebrow, title, value, note }: StatCardProps) {
  return (
    <motion.article
      variants={cardVariants}
      whileHover={{ y: -4, boxShadow: "0 20px 40px rgba(15,23,42,0.09)" }}
      className="admin-surface admin-surface-animated rounded-[22px] border border-[#e6edf5] p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#98a2b3]">{eyebrow}</p>
          <p className="mt-2 text-sm font-medium text-[#667085]">{title}</p>
        </div>
        <span className="rounded-full border border-[#d7dee8] bg-[#f8fafc] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#475467]">
          Live
        </span>
      </div>
      <p className="mt-6 text-[34px] font-semibold leading-none text-[#101828]">{value}</p>
      <p className="mt-3 text-sm leading-6 text-[#667085]">{note}</p>
    </motion.article>
  )
}

export default function AdminDashboardPage() {
  const auth = getStoredAdminAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null)
  const [evaluation, setEvaluation] = useState<AdminEvaluationMetrics | null>(null)
  const [research, setResearch] = useState<ResearchAnalytics | null>(null)
  const [loginTrends, setLoginTrends] = useState<LoginActivityTrends | null>(null)
  const [, setLoginLive] = useState(null)
  const [lastRealtimeSync, setLastRealtimeSync] = useState(() => formatRealtimeDateTime())
  const realtimeFetchInFlight = useRef(false)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setLastRealtimeSync(formatRealtimeDateTime())
    }, 1000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!auth.token) return
    let alive = true

    const messageFromError = (value: unknown) => {
      if (value instanceof Error) return value.message
      if (typeof value === "string") return value
      return "Unknown error"
    }

    async function loadDashboard() {
      setLoading(true)
      setError("")
      try {
        const results = await Promise.allSettled([
          fetchAdminAnalytics(auth.token),
          fetchAdminEvaluationMetrics(auth.token),
          fetchResearchAnalytics(auth.token),
          fetchLoginTrends(auth.token),
          fetchLoginLive(auth.token),
        ])
        if (!alive) return

        const [analyticsResult, evaluationResult, researchResult, trendsResult, liveResult] = results

        if (analyticsResult.status === "fulfilled") setAnalytics(analyticsResult.value)
        if (evaluationResult.status === "fulfilled") setEvaluation(evaluationResult.value)
        if (researchResult.status === "fulfilled") setResearch(researchResult.value)
        if (trendsResult.status === "fulfilled") setLoginTrends(trendsResult.value)
        if (liveResult.status === "fulfilled") setLoginLive(liveResult.value)

        const failed = results.filter((result) => result.status === "rejected")
        if (failed.length === results.length) {
          const messages = failed.map((result) => messageFromError(result.reason))
          if (messages.every((message) => message.includes("401"))) {
            signOutAdmin("/admin-login")
            return
          }
          setError("Failed to load admin dashboard data.")
        } else {
          setError("")
        }
      } catch {
        if (!alive) return
        setError("Failed to load admin dashboard data.")
      } finally {
        if (alive) setLoading(false)
      }
    }

    loadDashboard()
    return () => {
      alive = false
    }
  }, [auth.token])

  useEffect(() => {
    if (!auth.token) return
    let alive = true

    const refreshLoginInsights = async () => {
      if (realtimeFetchInFlight.current) return
      realtimeFetchInFlight.current = true
      try {
        const [trendsPayload, livePayload] = await Promise.all([
          fetchLoginTrends(auth.token),
          fetchLoginLive(auth.token),
        ])
        if (!alive) return
        setLoginTrends(trendsPayload)
        setLoginLive(livePayload)
      } catch {
        if (!alive) return
      } finally {
        realtimeFetchInFlight.current = false
      }
    }

    const interval = window.setInterval(refreshLoginInsights, 1000)
    const onFocus = () => refreshLoginInsights()
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshLoginInsights()
    }

    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      alive = false
      window.clearInterval(interval)
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [auth.token])

  const loginChartRows = buildMonthToDateRows(loginTrends?.daily_counts || [])
  const topStreakRows = [...(loginTrends?.streaks || [])].sort((a, b) => b.current_streak - a.current_streak).slice(0, 5)

  if (!auth.token) {
    return <NotFoundPage message="Sign in as admin to view this page." />
  }

  return (
    <AdminFrame showBuiltInToolbar={false}>
      <motion.div initial="hidden" animate="visible" className="space-y-5">
        <motion.section variants={sectionVariants} className="admin-surface admin-surface-animated rounded-[24px] border border-[#e6edf5] px-6 py-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#98a2b3]">Overview</p>
              <h2 className="mt-2 text-[34px] font-semibold leading-tight text-[#101828]">Student activity and portfolio tracking in one view</h2>
              <p className="mt-3 text-sm leading-6 text-[#667085]">
                Admin dashboard for monitoring student accounts, recent activity, and recorded portfolio progress.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-1">
              <div className="rounded-[18px] border border-[#e6edf5] bg-[#f8fafc] px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#98a2b3]">Realtime sync</p>
                <p className="mt-2 text-sm font-semibold text-[#111827]">{lastRealtimeSync}</p>
              </div>
            </div>
          </div>
        </motion.section>

        {error ? <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        <motion.section variants={sectionVariants} className="grid gap-4 lg:grid-cols-3">
          <StatCard
            eyebrow="Enrollment"
            title="Registered Students"
            value={`${analytics?.total_students ?? 0}`}
            note="Current student accounts visible to the admin workspace."
          />
          <StatCard
            eyebrow="Momentum"
            title="Active Users"
            value={`${research?.active_students_14d ?? 0}`}
            note="Students with recent activity during the last two weeks."
          />
          <StatCard
            eyebrow="Profiles"
            title="Tracked Portfolios"
            value={`${evaluation?.tracked_portfolios_total ?? 0}`}
            note="Student portfolios with recorded profile or project data."
          />
        </motion.section>

        <motion.section variants={sectionVariants} className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <motion.article
            variants={cardVariants}
            whileHover={{ y: -3 }}
            className="admin-surface admin-surface-animated rounded-[24px] border border-[#e6edf5] p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#98a2b3]">Login trends</p>
                <h3 className="mt-2 text-xl font-semibold text-[#101828]">Monthly login activity</h3>
              </div>
              <span className="rounded-full border border-[#d7dee8] bg-[#f8fafc] px-3 py-1.5 text-xs font-semibold text-[#475467]">
                Month to date
              </span>
            </div>
            <div className="mt-4 rounded-[20px] border border-[#e8eef5] bg-[#fbfcfe] p-4">
              <div className="h-[290px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={loginChartRows}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5eaf1" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "#667085" }}
                      interval={2}
                      tickFormatter={(value: unknown) => formatDateDDMMYYYY(String(value))}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#667085" }} />
                    <Tooltip
                      formatter={(value: unknown) => [`${value}`, "Logins"]}
                      labelFormatter={(value: unknown) => formatDateDDMMYYYY(String(value))}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      name="Logins"
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      dot={{ r: 2 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {!loading && loginChartRows.length === 0 ? <p className="mt-2 text-xs text-[#667085]">No login trend data yet.</p> : null}
            </div>
          </motion.article>

          <motion.article
            variants={cardVariants}
            whileHover={{ y: -3 }}
            className="admin-surface admin-surface-animated rounded-[24px] border border-[#e6edf5] p-5"
          >
            <div className="rounded-[20px] border border-[#e8eef5] bg-[#fbfcfe] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#98a2b3]">Top streaks</p>
              <ol className="mt-3 max-h-[280px] space-y-2 overflow-y-auto pr-1">
                {topStreakRows.map((item, index) => (
                  <li key={`${item.user_id}-${item.username}`} className="flex items-center justify-between rounded-[16px] border border-[#e4eaf2] bg-white px-3 py-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-8 w-8 place-items-center rounded-[12px] bg-[#111827] text-xs font-semibold text-white">
                        {index + 1}
                      </span>
                      <span className="text-sm font-semibold text-[#101828]">{item.username || "Student"}</span>
                    </div>
                    <span className="text-xs font-semibold text-[#667085]">{item.current_streak} day streak</span>
                  </li>
                ))}
                {!loading && topStreakRows.length === 0 ? <li className="text-xs text-[#667085]">No streak data yet.</li> : null}
              </ol>
            </div>
          </motion.article>
        </motion.section>

        <motion.section variants={sectionVariants} className="grid gap-4 xl:grid-cols-2">
          <motion.article
            variants={cardVariants}
            whileHover={{ y: -3 }}
            className="admin-surface admin-surface-animated rounded-[24px] border border-[#e6edf5] p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#98a2b3]">Login by program</p>
                <h3 className="mt-2 text-xl font-semibold text-[#101828]">Programs with most student logins</h3>
              </div>
              <span className="rounded-full border border-[#d7dee8] bg-[#f8fafc] px-3 py-1.5 text-xs font-semibold text-[#475467]">
                Last 30 days
              </span>
            </div>
            <ol className="mt-4 max-h-[260px] space-y-2 overflow-y-auto pr-1">
              {(loginTrends?.program_logins || []).map((item, index) => (
                <li key={`${item.label}-${index}`} className="flex items-center justify-between rounded-[16px] border border-[#e4eaf2] bg-white px-3 py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-[12px] bg-[#111827] text-xs font-semibold text-white">
                      {index + 1}
                    </span>
                    <span className="text-sm font-semibold text-[#101828]">{item.label}</span>
                  </div>
                  <span className="text-xs font-semibold text-[#667085]">{item.count} logged in</span>
                </li>
              ))}
              {!loading && !(loginTrends?.program_logins || []).length ? (
                <li className="text-xs text-[#667085]">No program login data yet.</li>
              ) : null}
            </ol>
          </motion.article>

          <motion.article
            variants={cardVariants}
            whileHover={{ y: -3 }}
            className="admin-surface admin-surface-animated rounded-[24px] border border-[#e6edf5] p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#98a2b3]">Login by year level</p>
                <h3 className="mt-2 text-xl font-semibold text-[#101828]">Year levels with most student logins</h3>
              </div>
              <span className="rounded-full border border-[#d7dee8] bg-[#f8fafc] px-3 py-1.5 text-xs font-semibold text-[#475467]">
                Last 30 days
              </span>
            </div>
            <ol className="mt-4 max-h-[260px] space-y-2 overflow-y-auto pr-1">
              {(loginTrends?.year_level_logins || []).map((item, index) => (
                <li key={`${item.label}-${index}`} className="flex items-center justify-between rounded-[16px] border border-[#e4eaf2] bg-white px-3 py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-[12px] bg-[#111827] text-xs font-semibold text-white">
                      {index + 1}
                    </span>
                    <span className="text-sm font-semibold text-[#101828]">{item.label}</span>
                  </div>
                  <span className="text-xs font-semibold text-[#667085]">{item.count} logged in</span>
                </li>
              ))}
              {!loading && !(loginTrends?.year_level_logins || []).length ? (
                <li className="text-xs text-[#667085]">No year-level login data yet.</li>
              ) : null}
            </ol>
          </motion.article>
        </motion.section>

      </motion.div>
    </AdminFrame>
  )
}
