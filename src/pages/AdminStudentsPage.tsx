import { motion } from "framer-motion"
import { useEffect, useMemo, useState } from "react"
import AdminFrame from "../components/AdminFrame"
import { getAdminLearningPathNotificationCount } from "../lib/learningPathNotifications"
import LearningPathsPage from "./LearningPathsPage"
import {
  createAdminNote,
  deleteAdminStudent,
  deleteAllAdminStudents,
  exportAdminStudentsCsv,
  fetchProjectLearningPaths,
  fetchAdminStudentDetails,
  fetchAdminStudents,
  getStoredAdminAuth,
  verifyAdminStudent,
} from "../lib/api"
import type { AdminStudentDetail, AdminStudentSummary } from "../types"

type YearGroup = { year: string; students: AdminStudentSummary[] }
type ProgramGroup = { program: string; students: AdminStudentSummary[]; years: YearGroup[] }

const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.36 } },
}

const resolveProgram = (s: AdminStudentSummary) => (s.program || "").trim() || "Unassigned Program"
const resolveYear = (s: AdminStudentSummary) => (s.year_level || "").trim() || "Unassigned Year"
const resolveName = (s: AdminStudentSummary) => s.display_name?.trim() || s.username
const formatDate = (raw?: string | null) => (raw ? new Date(raw).toLocaleString() : "-")

function formatLastSeen(raw?: string | null) {
  if (!raw) return "No activity yet"
  const ms = Date.now() - new Date(raw).getTime()
  if (ms < 60000) return "Active just now"
  const mins = Math.max(1, Math.floor(ms / 60000))
  if (mins < 60) return `Active ${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Active ${hrs}h ago`
  return `Active ${Math.floor(hrs / 24)}d ago`
}

function StudentStatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <motion.div whileHover={{ y: -3 }} className="rounded-[18px] border border-[#e6edf5] bg-[#f8fafc] px-4 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#98a2b3]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[#111827]">{value}</p>
    </motion.div>
  )
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-[#e6edf5] bg-[#fbfcfe] px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#101828]">{value}</p>
    </div>
  )
}

export default function AdminStudentsPage() {
  const auth = getStoredAdminAuth()
  const [students, setStudents] = useState<AdminStudentSummary[]>([])
  const [query, setQuery] = useState("")
  const [yearFilter, setYearFilter] = useState("ALL")
  const [collapsedPrograms, setCollapsedPrograms] = useState<Record<string, boolean>>({})
  const [collapsedYears, setCollapsedYears] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [learningPathUnreadByStudent, setLearningPathUnreadByStudent] = useState<Record<string, number>>({})
  const [learningPathNotificationRefreshKey, setLearningPathNotificationRefreshKey] = useState(0)

  const [openStudentId, setOpenStudentId] = useState<number | null>(null)
  const [openLearningPathUsername, setOpenLearningPathUsername] = useState("")
  const [details, setDetails] = useState<AdminStudentDetail | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState("")
  const [note, setNote] = useState("")

  const loadStudents = async () => {
    if (!auth.token) return
    setLoading(true)
    try {
      setStudents((await fetchAdminStudents(auth.token)) || [])
      setError("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load students.")
    } finally {
      setLoading(false)
    }
  }

  const loadDetails = async (studentId: number) => {
    if (!auth.token) return
    setDetailsLoading(true)
    try {
      setDetails((await fetchAdminStudentDetails(auth.token, studentId)) || null)
      setDetailsError("")
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : "Failed to load details.")
    } finally {
      setDetailsLoading(false)
    }
  }

  useEffect(() => {
    loadStudents()
  }, [auth.token])

  useEffect(() => {
    if (!auth.token) return
    const interval = window.setInterval(() => {
      loadStudents()
    }, 15000)
    return () => window.clearInterval(interval)
  }, [auth.token])

  useEffect(() => {
    let cancelled = false
    const usernames = students.map((student) => String(student.username || "").trim()).filter(Boolean)
    if (!usernames.length) {
      setLearningPathUnreadByStudent({})
      return
    }

    Promise.all(
      usernames.map(async (username) => {
        try {
          const response = await fetchProjectLearningPaths(username)
          return [username, getAdminLearningPathNotificationCount(username, response)] as const
        } catch {
          return [username, 0] as const
        }
      })
    ).then((entries) => {
      if (cancelled) return
      setLearningPathUnreadByStudent(
        entries.reduce<Record<string, number>>((accumulator, [username, count]) => {
          accumulator[username] = count
          return accumulator
        }, {})
      )
    })

    return () => {
      cancelled = true
    }
  }, [learningPathNotificationRefreshKey, students])

  useEffect(() => {
    if (!auth.token) return
    const refresh = () => {
      if (document.visibilityState !== "visible") return
      setLearningPathNotificationRefreshKey((value) => value + 1)
    }
    const intervalId = window.setInterval(refresh, 4000)
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", refresh)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", refresh)
    }
  }, [auth.token])

  const yearOptions = useMemo(() => ["ALL", ...Array.from(new Set(students.map(resolveYear))).sort()], [students])

  const filteredStudents = useMemo(() => {
    const term = query.trim().toLowerCase()
    return students
      .filter((s) => (yearFilter === "ALL" ? true : resolveYear(s) === yearFilter))
      .filter((s) => !term || resolveName(s).toLowerCase().includes(term) || s.username.toLowerCase().includes(term))
      .sort((a, b) => resolveName(a).localeCompare(resolveName(b)))
  }, [students, yearFilter, query])

  const groups = useMemo<ProgramGroup[]>(() => {
    const byProgram = new Map<string, AdminStudentSummary[]>()
    filteredStudents.forEach((s) => byProgram.set(resolveProgram(s), [...(byProgram.get(resolveProgram(s)) || []), s]))
    return Array.from(byProgram.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([program, list]) => {
        const byYear = new Map<string, AdminStudentSummary[]>()
        list.forEach((s) => byYear.set(resolveYear(s), [...(byYear.get(resolveYear(s)) || []), s]))
        const years = Array.from(byYear.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([year, studentsInYear]) => ({ year, students: studentsInYear }))
        return { program, students: list, years }
      })
  }, [filteredStudents])

  const totalVerified = filteredStudents.filter((student) => student.is_verified).length
  const openSummary = students.find((s) => s.id === openStudentId) || details?.student || null

  return (
    <AdminFrame>
      <motion.div initial="hidden" animate="visible" className="space-y-5">
        <motion.section variants={sectionVariants} className="admin-surface admin-surface-animated rounded-[24px] border border-[#e6edf5] px-6 py-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#98a2b3]">Students</p>
              <h2 className="mt-2 text-[34px] font-semibold leading-tight text-[#101828]">Operational student directory with grouped review flow</h2>
              <p className="mt-3 text-sm leading-6 text-[#667085]">
                Chronicle-inspired directory surface for verification, detail review, notes, and learning-path access.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <StudentStatCard label="Students" value={students.length} />
              <StudentStatCard label="Verified" value={totalVerified} />
              <StudentStatCard label="Programs" value={groups.length} />
            </div>
          </div>
        </motion.section>

        <motion.section variants={sectionVariants} className="admin-surface admin-surface-animated rounded-[24px] border border-[#e6edf5] p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="grid flex-1 gap-3 md:grid-cols-[1fr_220px]">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or username"
                className="rounded-[16px] border border-[#dbe4ee] bg-white px-4 py-3 text-sm text-[#111827] outline-none"
              />
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="rounded-[16px] border border-[#dbe4ee] bg-white px-4 py-3 text-sm text-[#111827] outline-none"
              >
                {yearOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === "ALL" ? "All Year Levels" : opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || loading}
                onClick={async () => {
                  if (!auth.token) return
                  setBusy(true)
                  try {
                    const { blob, filename } = await exportAdminStudentsCsv(auth.token)
                    const url = URL.createObjectURL(blob)
                    const anchor = document.createElement("a")
                    anchor.href = url
                    anchor.download = filename
                    anchor.click()
                    URL.revokeObjectURL(url)
                  } finally {
                    setBusy(false)
                  }
                }}
                className="rounded-[14px] border border-[#d7dee8] bg-white px-4 py-3 text-sm font-semibold text-[#344054]"
              >
                Export CSV
              </button>
              <button
                type="button"
                disabled={busy || loading || students.length === 0}
                onClick={async () => {
                  if (!auth.token) return
                  const confirmation = window.prompt('Type "DELETE_ALL_STUDENTS" to confirm bulk delete:')
                  if (confirmation !== "DELETE_ALL_STUDENTS") return
                  setBusy(true)
                  try {
                    await deleteAllAdminStudents(auth.token, confirmation)
                    await loadStudents()
                    setOpenStudentId(null)
                    setDetails(null)
                  } finally {
                    setBusy(false)
                  }
                }}
                className="rounded-[14px] border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-sm font-semibold text-[#b42318]"
              >
                Delete All Students
              </button>
            </div>
          </div>

          {loading ? <p className="mt-4 text-sm text-[#667085]">Loading students...</p> : null}
          {!loading && error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}

          <div className="mt-5 space-y-4">
            {groups.map((group) => {
              const pCollapsed = !!collapsedPrograms[group.program]
              return (
                <motion.section
                  key={group.program}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.28 } }}
                  whileHover={{ y: -2 }}
                  className="rounded-[22px] border border-[#e6edf5] bg-[#fbfcfe] p-4"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#98a2b3]">Program</p>
                      <h3 className="mt-2 text-2xl font-semibold text-[#101828]">{group.program}</h3>
                      <p className="mt-1 text-sm text-[#667085]">{group.students.length} students in view</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCollapsedPrograms((current) => ({ ...current, [group.program]: !pCollapsed }))}
                      className="rounded-[14px] border border-[#d7dee8] bg-white px-4 py-2.5 text-sm font-semibold text-[#344054]"
                    >
                      {pCollapsed ? "Expand group" : "Collapse group"}
                    </button>
                  </div>

                  {!pCollapsed ? (
                    <div className="mt-4 space-y-4">
                      {group.years.map((yearGroup) => {
                        const yKey = `${group.program}::${yearGroup.year}`
                        const yCollapsed = !!collapsedYears[yKey]
                        return (
                          <motion.div
                            key={yKey}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0, transition: { duration: 0.24 } }}
                            className="rounded-[18px] border border-[#e6edf5] bg-white p-4"
                          >
                            <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#98a2b3]">Year level</p>
                                <p className="mt-1 text-lg font-semibold text-[#101828]">{yearGroup.year}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setCollapsedYears((current) => ({ ...current, [yKey]: !yCollapsed }))}
                                className="rounded-[14px] border border-[#d7dee8] bg-[#f8fafc] px-4 py-2.5 text-sm font-semibold text-[#344054]"
                              >
                                {yearGroup.students.length} students / {yCollapsed ? "Expand" : "Collapse"}
                              </button>
                            </div>

                            {!yCollapsed ? (
                              <div className="overflow-hidden rounded-[16px] border border-[#e6edf5]">
                                <div className="grid grid-cols-[minmax(220px,1.3fr)_120px_110px_160px_420px] gap-0 border-b border-[#e6edf5] bg-[#f8fafc] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">
                                  <div>Student</div>
                                  <div>Level</div>
                                  <div>Repos</div>
                                  <div>Presence</div>
                                  <div>Actions</div>
                                </div>
                                {yearGroup.students.map((student) => {
                                  const unreadCount = learningPathUnreadByStudent[student.username] || 0
                                  return (
                                  <motion.article
                                    key={student.id}
                                    whileHover={{ backgroundColor: "#f9fbff" }}
                                    className="grid grid-cols-[minmax(220px,1.3fr)_120px_110px_160px_420px] items-center gap-0 border-t border-[#eef2f6] bg-white px-4 py-4 first:border-t-0"
                                  >
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="truncate text-sm font-semibold text-[#101828]">{resolveName(student)}</p>
                                        {unreadCount > 0 ? (
                                          <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-[#ef4444] px-2 py-1 text-[10px] font-bold leading-none text-white">
                                            {unreadCount > 99 ? "99+" : unreadCount}
                                          </span>
                                        ) : null}
                                      </div>
                                      <p className="truncate text-sm text-[#667085]">
                                        @{student.username}
                                      </p>
                                    </div>
                                    <div className="text-sm font-semibold text-[#344054]">{student.level}</div>
                                    <div className="text-sm font-semibold text-[#344054]">{student.repo_count}</div>
                                    <div>
                                      <span
                                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                                          student.online
                                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                            : "border-slate-200 bg-slate-50 text-slate-600"
                                        }`}
                                      >
                                        {student.online ? "Online now" : formatLastSeen(student.last_seen)}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 md:flex-nowrap">
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={async () => {
                                          if (!auth.token) return
                                          setBusy(true)
                                          try {
                                            await verifyAdminStudent(auth.token, {
                                              student_id: student.id,
                                              is_verified: !student.is_verified,
                                            })
                                            setStudents((current) =>
                                              current.map((item) => (item.id === student.id ? { ...item, is_verified: !item.is_verified } : item))
                                            )
                                          } finally {
                                            setBusy(false)
                                          }
                                        }}
                                        className={`rounded-[12px] border px-3 py-2 text-xs font-semibold ${
                                          student.is_verified
                                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                            : "border-amber-200 bg-amber-50 text-amber-700"
                                        }`}
                                      >
                                        {student.is_verified ? "Verified" : "Unverified"}
                                      </button>
                                      <button
                                        type="button"
                                        className="rounded-[12px] border border-[#d7dee8] bg-white px-3 py-2 text-xs font-semibold text-[#344054]"
                                        onClick={async () => {
                                          setOpenStudentId(student.id)
                                          setDetails(null)
                                          await loadDetails(student.id)
                                        }}
                                      >
                                        View info
                                      </button>
                                      <button
                                        type="button"
                                        className="rounded-[12px] border border-[#d7dee8] bg-white px-3 py-2 text-xs font-semibold text-[#344054]"
                                        onClick={() => setOpenLearningPathUsername(student.username)}
                                      >
                                        <span className="inline-flex items-center gap-2">
                                          <span>Learning path</span>
                                          {unreadCount > 0 ? (
                                            <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-[#ef4444] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                                              {unreadCount > 99 ? "99+" : unreadCount}
                                            </span>
                                          ) : null}
                                        </span>
                                      </button>
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={async () => {
                                          if (!auth.token || !window.confirm(`Delete @${student.username}?`)) return
                                          setBusy(true)
                                          try {
                                            await deleteAdminStudent(auth.token, student.id)
                                            setStudents((current) => current.filter((item) => item.id !== student.id))
                                            if (openStudentId === student.id) {
                                              setOpenStudentId(null)
                                              setDetails(null)
                                            }
                                          } finally {
                                            setBusy(false)
                                          }
                                        }}
                                        className="rounded-[12px] border border-[#fecaca] bg-[#fff1f2] px-3 py-2 text-xs font-semibold text-[#b42318]"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </motion.article>
                                  )
                                })}
                              </div>
                            ) : null}
                          </motion.div>
                        )
                      })}
                    </div>
                  ) : null}
                </motion.section>
              )
            })}
          </div>
        </motion.section>
      </motion.div>

      {openStudentId ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 flex justify-end bg-slate-950/30"
        >
          <motion.aside
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1, transition: { duration: 0.26 } }}
            className="h-full w-full max-w-[780px] overflow-y-auto border-l border-[#dde5ee] bg-[#f8fafc] p-5 shadow-[0_24px_64px_rgba(15,23,42,0.16)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#98a2b3]">Student record</p>
                <h3 className="mt-2 text-3xl font-semibold text-[#101828]">{openSummary ? resolveName(openSummary) : "Student"}</h3>
                {openSummary ? <p className="mt-1 text-sm text-[#667085]">@{openSummary.username}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpenStudentId(null)
                  setDetails(null)
                }}
                className="rounded-[14px] border border-[#d7dee8] bg-white px-4 py-3 text-sm font-semibold text-[#344054]"
              >
                Close
              </button>
            </div>

            {detailsLoading ? <p className="mt-4 text-sm text-[#667085]">Loading details...</p> : null}
            {!detailsLoading && detailsError ? <p className="mt-4 text-sm text-rose-600">{detailsError}</p> : null}

            {!detailsLoading && details ? (
              <div className="mt-5 space-y-4">
                <section className="admin-surface rounded-[20px] border border-[#e6edf5] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#98a2b3]">Portfolio snapshot</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <InfoPill label="Student ID" value={details.profile.student_id || "-"} />
                    <InfoPill label="Program" value={details.student.program || "-"} />
                    <InfoPill label="Year Level" value={details.student.year_level || "-"} />
                    <InfoPill label="Target Role" value={details.profile.target_role || "-"} />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <InfoPill label="Career Interest" value={details.profile.career_interest || "-"} />
                    <InfoPill label="Learning Style" value={details.profile.preferred_learning_style || "-"} />
                    <InfoPill
                      label="Profile Completeness"
                      value={`${details.overview.portfolio_completeness || 0}%`}
                    />
                  </div>
                  <div className="mt-4 rounded-[16px] border border-[#e6edf5] bg-[#fbfcfe] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">Bio</p>
                    <p className="mt-2 text-sm leading-6 text-[#344054]">{details.profile.bio || "No portfolio bio yet."}</p>
                  </div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <article className="rounded-[16px] border border-[#e6edf5] bg-[#fbfcfe] p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">Contact</p>
                      <div className="mt-3 space-y-2">
                        <InfoPill label="Email" value={details.profile.email || "-"} />
                        <InfoPill label="Phone" value={details.profile.phone || "-"} />
                        <InfoPill label="LinkedIn" value={details.profile.linkedin || "-"} />
                      </div>
                    </article>
                    <article className="rounded-[16px] border border-[#e6edf5] bg-[#fbfcfe] p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">Tech Stack</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(details.profile.tech_stack || []).length > 0 ? (
                          (details.profile.tech_stack || []).map((item) => (
                            <span
                              key={item}
                              className="rounded-full border border-[#d7dee8] bg-white px-3 py-1.5 text-xs font-semibold text-[#344054]"
                            >
                              {item}
                            </span>
                          ))
                        ) : (
                          <p className="text-sm text-[#667085]">No tech stack saved yet.</p>
                        )}
                      </div>
                    </article>
                  </div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <article className="rounded-[16px] border border-[#e6edf5] bg-[#fbfcfe] p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">Education History</p>
                      <div className="mt-3 space-y-2">
                        {(details.profile.education_history || []).length > 0 ? (
                          (details.profile.education_history || []).map((item, index) => {
                            const title = String(item.title || "").trim()
                            const year = String(item.year || "").trim()
                            return (
                              <div key={`edu-${index}`} className="rounded-[12px] border border-[#e6edf5] bg-white px-3 py-3">
                                <p className="text-sm font-semibold text-[#101828]">{title || "Education entry"}</p>
                                <p className="mt-1 text-xs text-[#667085]">{year || "Year not set"}</p>
                              </div>
                            )
                          })
                        ) : (
                          <p className="text-sm text-[#667085]">No education history saved yet.</p>
                        )}
                      </div>
                    </article>
                    <article className="rounded-[16px] border border-[#e6edf5] bg-[#fbfcfe] p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">Job Experience</p>
                      <div className="mt-3 space-y-2">
                        {(details.profile.job_experience || []).length > 0 ? (
                          (details.profile.job_experience || []).map((item, index) => {
                            const title = String(item.title || "").trim()
                            const company = String(item.company || "").trim()
                            const start = String(item.start || "").trim()
                            const end = String(item.end || "").trim()
                            return (
                              <div key={`job-${index}`} className="rounded-[12px] border border-[#e6edf5] bg-white px-3 py-3">
                                <p className="text-sm font-semibold text-[#101828]">{title || "Job entry"}</p>
                                <p className="mt-1 text-xs text-[#667085]">
                                  {[company, start && end ? `${start} - ${end}` : start || end].filter(Boolean).join(" / ") || "No timeline set"}
                                </p>
                              </div>
                            )
                          })
                        ) : (
                          <p className="text-sm text-[#667085]">No job experience saved yet.</p>
                        )}
                      </div>
                    </article>
                  </div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <article className="rounded-[16px] border border-[#e6edf5] bg-[#fbfcfe] p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">Practice Dimensions</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {details.practice_dimensions.length > 0 ? (
                          details.practice_dimensions.map((dimension) => (
                            <span
                              key={`${dimension.label}-${dimension.confidence}`}
                              className="rounded-full border border-[#d7dee8] bg-white px-3 py-1.5 text-xs font-semibold text-[#344054]"
                            >
                              {dimension.label} {dimension.confidence}%
                            </span>
                          ))
                        ) : (
                          <p className="text-sm text-[#667085]">No detected practice dimensions yet.</p>
                        )}
                      </div>
                    </article>
                    <article className="rounded-[16px] border border-[#e6edf5] bg-[#fbfcfe] p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">Career Suggestions</p>
                      <div className="mt-3 space-y-2">
                        {details.career_suggestions.length > 0 ? (
                          details.career_suggestions.slice(0, 3).map((career) => (
                            <div key={`${career.title}-${career.confidence}`} className="rounded-[12px] border border-[#e6edf5] bg-white px-3 py-3">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold text-[#101828]">{career.title}</p>
                                <span className="rounded-full border border-[#d7dee8] px-2 py-1 text-[10px] font-semibold text-[#344054]">
                                  {career.confidence}%
                                </span>
                              </div>
                              <p className="mt-2 text-xs leading-5 text-[#667085]">{career.reasoning}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-[#667085]">No career suggestions yet.</p>
                        )}
                      </div>
                    </article>
                  </div>
                </section>

                <section className="grid gap-4 md:grid-cols-2">
                  <article className="admin-surface rounded-[20px] border border-[#e6edf5] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#98a2b3]">Top Portfolio Repositories</p>
                    <div className="mt-3 space-y-2">
                      {details.top_repos.length > 0 ? (
                        details.top_repos.map((repo) => (
                          <article key={repo.name} className="rounded-[16px] border border-[#e6edf5] bg-[#fbfcfe] p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-[#101828]">{repo.name}</p>
                              <span className="rounded-full border border-[#d7dee8] bg-white px-2 py-1 text-[10px] font-semibold text-[#344054]">
                                {repo.language || "Unknown"}
                              </span>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-[#667085]">{repo.description || "No description provided."}</p>
                            <p className="mt-2 text-xs text-[#667085]">
                              Commits: {repo.commit_count} / Stars: {repo.stars} / Last push: {repo.last_push ? formatDate(repo.last_push) : "-"}
                            </p>
                          </article>
                        ))
                      ) : (
                        <p className="text-sm text-[#667085]">No repositories available yet.</p>
                      )}
                    </div>
                  </article>

                  <article className="admin-surface rounded-[20px] border border-[#e6edf5] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#98a2b3]">Portfolio Summary</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[16px] border border-[#e6edf5] bg-[#fbfcfe] p-3">
                        <p className="text-xs text-[#667085]">Certificates</p>
                        <p className="mt-2 text-2xl font-semibold text-[#101828]">{details.certificates.length}</p>
                      </div>
                      <div className="rounded-[16px] border border-[#e6edf5] bg-[#fbfcfe] p-3">
                        <p className="text-xs text-[#667085]">Notes</p>
                        <p className="mt-2 text-2xl font-semibold text-[#101828]">{details.notes.length}</p>
                      </div>
                      <div className="rounded-[16px] border border-[#e6edf5] bg-[#fbfcfe] p-3">
                        <p className="text-xs text-[#667085]">Commits</p>
                        <p className="mt-2 text-2xl font-semibold text-[#101828]">{details.overview.total_commits}</p>
                      </div>
                      <div className="rounded-[16px] border border-[#e6edf5] bg-[#fbfcfe] p-3">
                        <p className="text-xs text-[#667085]">Repositories</p>
                        <p className="mt-2 text-2xl font-semibold text-[#101828]">{details.overview.repo_count}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-[#667085]">Reviews: {details.reviews.length}</p>
                  </article>
                </section>

                <section className="admin-surface rounded-[20px] border border-[#e6edf5] p-4">
                  <h4 className="text-sm font-semibold text-[#101828]">freeCodeCamp progress</h4>
                  <p className="mt-1 text-sm text-[#667085]">
                    Overall: {details.fcc_progress_summary?.overall_progress_percent ?? 0}% / Started:{" "}
                    {details.fcc_progress_summary?.modules_started ?? 0}/{details.fcc_progress_summary?.total_modules ?? 0} / Completed:{" "}
                    {details.fcc_progress_summary?.modules_completed ?? 0}/{details.fcc_progress_summary?.total_modules ?? 0}
                  </p>
                  <p className="mt-1 text-sm text-[#667085]">Last updated: {formatDate(details.fcc_progress_summary?.last_updated_at)}</p>
                  <div className="mt-3 space-y-2">
                    {details.fcc_progress.length > 0 ? (
                      details.fcc_progress.map((item) => (
                        <article key={item.id} className="rounded-[16px] border border-[#e6edf5] bg-[#fbfcfe] p-3 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold text-[#101828]">{item.module_title}</p>
                            <span className="rounded-full border border-[#d7dee8] bg-white px-2 py-1 text-[10px] text-[#344054]">
                              {item.progress_percent}%
                            </span>
                          </div>
                          <p className="mt-1 text-[#667085]">
                            Status: {item.status.replace(/_/g, " ")} / Updated: {formatDate(item.updated_at)}
                          </p>
                          {item.notes ? <p className="mt-1 text-[#667085]">Notes: {item.notes}</p> : null}
                        </article>
                      ))
                    ) : (
                      <p className="text-sm text-[#667085]">No freeCodeCamp progress saved yet.</p>
                    )}
                  </div>
                </section>

                <section className="admin-surface rounded-[20px] border border-[#e6edf5] p-4">
                  <h4 className="text-sm font-semibold text-[#101828]">Admin actions</h4>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy || !openSummary || !auth.token}
                      onClick={async () => {
                        if (!auth.token || !openSummary) return
                        setBusy(true)
                        try {
                          await verifyAdminStudent(auth.token, {
                            student_id: openSummary.id,
                            is_verified: !openSummary.is_verified,
                          })
                          setStudents((current) =>
                            current.map((student) => (student.id === openSummary.id ? { ...student, is_verified: !student.is_verified } : student))
                          )
                          await loadDetails(openSummary.id)
                        } finally {
                          setBusy(false)
                        }
                      }}
                      className="rounded-[14px] border border-[#d7dee8] bg-white px-4 py-3 text-sm font-semibold text-[#344054]"
                    >
                      {openSummary?.is_verified ? "Mark unverified" : "Mark verified"}
                    </button>
                    <button
                      type="button"
                      disabled={!openSummary}
                      onClick={() => openSummary && window.open(`/p/${openSummary.username}`, "_blank", "noopener,noreferrer")}
                      className="rounded-[14px] border border-[#d7dee8] bg-white px-4 py-3 text-sm font-semibold text-[#344054]"
                    >
                      Open portfolio
                    </button>
                    <button
                      type="button"
                      disabled={!openSummary}
                      onClick={() => openSummary && setOpenLearningPathUsername(openSummary.username)}
                      className="rounded-[14px] border border-[#d7dee8] bg-white px-4 py-3 text-sm font-semibold text-[#344054]"
                    >
                      View learning path
                    </button>
                  </div>

                  <div className="mt-4 rounded-[16px] border border-[#e6edf5] bg-[#fbfcfe] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#98a2b3]">Add note</p>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      className="mt-3 w-full rounded-[14px] border border-[#dbe4ee] bg-white px-3 py-3 text-sm text-[#111827] outline-none"
                    />
                    <button
                      type="button"
                      disabled={busy || !note.trim() || !openSummary || !auth.token}
                      onClick={async () => {
                        if (!auth.token || !openSummary || !note.trim()) return
                        setBusy(true)
                        try {
                          await createAdminNote(auth.token, { student_id: openSummary.id, note: note.trim() })
                          setNote("")
                          await loadDetails(openSummary.id)
                        } finally {
                          setBusy(false)
                        }
                      }}
                      className="mt-3 rounded-[14px] border border-[#d7dee8] bg-white px-4 py-3 text-xs font-semibold text-[#344054]"
                    >
                      Save note
                    </button>
                  </div>
                </section>

                <section className="admin-surface rounded-[20px] border border-[#e6edf5] p-4">
                  <h4 className="text-sm font-semibold text-[#101828]">Recent notes</h4>
                  <div className="mt-3 space-y-2">
                    {details.notes.slice(0, 5).map((entry) => (
                      <article key={entry.id} className="rounded-[16px] border border-[#e6edf5] bg-[#fbfcfe] p-3 text-xs">
                        <p className="text-[#344054]">{entry.note}</p>
                        <p className="mt-1 text-[#667085]">{formatDate(entry.created_at)}</p>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            ) : null}
          </motion.aside>
        </motion.div>
      ) : null}

      {openLearningPathUsername ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <aside className="h-full w-full max-w-[1180px] overflow-y-auto border-l border-[#dde5ee] bg-[#f5f7fb] shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
            <LearningPathsPage
              adminView
              adminUsername={openLearningPathUsername}
              embedded
              onClose={() => {
                setOpenLearningPathUsername("")
                setLearningPathNotificationRefreshKey((current) => current + 1)
              }}
            />
          </aside>
        </div>
      ) : null}
    </AdminFrame>
  )
}
