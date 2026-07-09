import { useEffect, useMemo, useRef, useState } from "react"
import AdminFrame from "../components/AdminFrame"
import {
  commentOnCertificate,
  deleteCertificateComment,
  fetchAdminStudentDetails,
  fetchAdminStudents,
  fetchCertificateSuggestions,
  fetchLearningPath,
  fetchProjectLearningPaths,
  getStoredAdminAuth,
  reviewCertificate,
  signOutAdmin,
} from "../lib/api"
import {
  DEFAULT_SUGGESTED_CERTIFICATE_LIMIT,
  inferSuggestedCertificates,
  inferSuggestedCertificatesForCareer,
  matchCertificateToSuggestion,
  matchCertificatesToSuggestion,
} from "../lib/certificateSuggestions"
import {
  getAdminCertificateNotificationCount,
  getLatestAdminCertificateNotificationTimestamp,
  markCertificateNotificationsSeen,
} from "../lib/certificateNotifications"
import type {
  AdminStudentDetail,
  AdminStudentSummary,
  CareerSuggestion,
  CertificateRecord,
  CertificateSuggestion,
  LearningPathResponse,
  LearningPathStep,
  ProjectLearningPathResponse,
} from "../types"

type YearGroup = { year: string; students: AdminStudentSummary[] }
type ProgramGroup = { program: string; students: AdminStudentSummary[]; years: YearGroup[] }

function formatDateTime(value?: string | null) {
  if (!value) return "-"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}

function certificateProofLabel(row?: Pick<CertificateRecord, "certificate_url" | "proof_type"> | null) {
  const proofUrl = String(row?.certificate_url || "").trim()
  if (!proofUrl) return String(row?.proof_type || "Proof")
  const cleanUrl = proofUrl.split("?")[0].split("#")[0]
  const rawName = cleanUrl.split("/").filter(Boolean).pop() || ""
  try {
    const decoded = decodeURIComponent(rawName)
    return decoded || String(row?.proof_type || "Proof")
  } catch {
    return rawName || String(row?.proof_type || "Proof")
  }
}

function certificateProofKind(row?: Pick<CertificateRecord, "certificate_url" | "proof_type"> | null): "image" | "video" | "pdf" | "file" {
  const proofType = String(row?.proof_type || "").trim().toLowerCase()
  if (proofType.includes("image")) return "image"
  if (proofType.includes("video")) return "video"
  if (proofType.includes("pdf")) return "pdf"
  const proofUrl = String(row?.certificate_url || "").trim().toLowerCase()
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/.test(proofUrl)) return "image"
  if (/\.(mp4|webm|mov|m4v|avi)$/.test(proofUrl)) return "video"
  if (/\.pdf$/.test(proofUrl)) return "pdf"
  return "file"
}

function canInlineCertificateProof(row?: Pick<CertificateRecord, "certificate_url" | "proof_type"> | null) {
  const proofKind = certificateProofKind(row)
  const proofUrl = String(row?.certificate_url || "").trim().toLowerCase()
  if (proofKind === "image") return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/.test(proofUrl)
  if (proofKind === "video") return /\.(mp4|webm|mov|m4v|avi)(\?|#|$)/.test(proofUrl)
  if (proofKind === "pdf") return /\.pdf(\?|#|$)/.test(proofUrl)
  return false
}

function isCertificateLinkProof(row?: Pick<CertificateRecord, "proof_type"> | null) {
  const proofType = String(row?.proof_type || "").trim().toLowerCase()
  return proofType.includes("certificate link") || proofType.includes("shareable link")
}

function certificatePrimaryActionLabel(row?: Pick<CertificateRecord, "certificate_url" | "proof_type"> | null) {
  const proofType = String(row?.proof_type || "").trim().toLowerCase()
  if (isCertificateLinkProof(row)) {
    return "Open certificate link"
  }
  if (proofType.includes("image") || proofType.includes("video") || proofType.includes("pdf") || proofType.includes("file")) {
    return "Open proof file"
  }
  return "Open proof"
}

function readableUrl(value?: string | null) {
  return String(value || "").trim()
}

function statusMeta(value: string) {
  const status = (value || "").toLowerCase()
  // Match system-tracked values exactly (for suggested credentials tracking, not certificate submission status)
  if (status === "completed" || status === "complete") {
    return { label: "Complete", className: "bg-[#E8F4F0] text-[#0F6E56]" }
  }
  if (status === "in_progress" || status === "in-progress") {
    return { label: "In progress", className: "bg-[#FFF4E8] text-[#BA7517]" }
  }
  // Default: Not started (includes "not_started" and unmapped values)
  return { label: "Not started", className: "bg-[#F3F4F6] text-[#55607A]" }
}

function certificateSubmissionStatusMeta(value: string) {
  const status = (value || "").toLowerCase()
  if (status === "verified" || status === "accepted") {
    return { label: "Accepted", className: "bg-[#E8F4F0] text-[#0F6E56]" }
  }
  if (status === "rejected") {
    return { label: "Rejected", className: "bg-[#FDECEC] text-[#A32D2D]" }
  }
  return { label: "Pending", className: "bg-[#FFF4E8] text-[#BA7517]" }
}

function certificateReviewActionMeta(value: "pending" | "verified" | "rejected") {
  if (value === "verified") {
    return {
      label: "Accepted",
      idleClassName: "border-[#c9e7dd] bg-white text-[#0F6E56]",
      activeClassName: "border-[#0F6E56] bg-[#E8F4F0] text-[#0F6E56]",
    }
  }
  if (value === "rejected") {
    return {
      label: "Rejected",
      idleClassName: "border-[#f4c7c7] bg-white text-[#A32D2D]",
      activeClassName: "border-[#A32D2D] bg-[#FDECEC] text-[#A32D2D]",
    }
  }
  return {
    label: "Pending",
    idleClassName: "border-[#f4ddbf] bg-white text-[#BA7517]",
    activeClassName: "border-[#BA7517] bg-[#FFF4E8] text-[#BA7517]",
  }
}

function isCompleteStatus(value: string) {
  const normalized = (value || "").toLowerCase()
  return normalized === "completed" || normalized === "complete"
}

function isAutoDetectedCertificate(note?: string | null) {
  return (note || "").startsWith("Auto-detected via freeCodeCamp URL")
}

function normalizeText(value: string) {
  return value.trim().toLowerCase()
}

function resolveProgram(student: AdminStudentSummary) {
  return (student.program || "").trim() || "Unassigned Program"
}

function resolveYear(student: AdminStudentSummary) {
  return (student.year_level || "").trim() || "Unassigned Year"
}

function resolveStudentName(student: AdminStudentSummary) {
  return student.display_name?.trim() || student.username
}

function formatAcademicLabel(program?: string | null, yearLevel?: string | null) {
  const cleanProgram = String(program || "").trim()
  const cleanYearLevel = String(yearLevel || "").trim()
  if (cleanProgram && cleanYearLevel) return `${cleanProgram} - ${cleanYearLevel}`
  return cleanProgram || cleanYearLevel || "Program / Year not set"
}

function actionMatchesTrack(action: { module_title?: string | null; module_url?: string | null }, track: { title: string; url: string }) {
  const actionTitle = normalizeText(String(action.module_title || ""))
  const actionUrl = normalizeText(String(action.module_url || ""))
  const trackTitle = normalizeText(track.title)
  const trackUrl = normalizeText(track.url)
  return actionTitle === trackTitle || actionUrl === trackUrl
}

function summarizeTrackActions(progressRows: Array<{ label: string }>) {
  const total = progressRows.length
  const completed = progressRows.filter((item) => isCompleteStatus(item.label)).length
  const started = progressRows.filter((item) => {
    const label = normalizeText(item.label)
    return label === "in progress" || label === "complete"
  }).length

  return {
    overall: total ? Math.round((completed / total) * 100) : 0,
    started,
    completed,
    total,
    remaining: Math.max(0, total - completed),
  }
}

function learningPathStepsToText(steps: LearningPathStep[]) {
  return steps
    .flatMap((step) => [step.title, step.description, step.reason, ...(step.tags || []), ...(step.evidence || [])])
    .join(" ")
    .toLowerCase()
}

function projectLearningPathsToText(projectPaths: ProjectLearningPathResponse | null) {
  return (projectPaths?.projects || [])
    .map((project) => `${project.repo_name} ${learningPathStepsToText(project.steps || [])}`)
    .join(" ")
    .toLowerCase()
}

function inferSuggestedCertificatesForStudent(
  learningPath: LearningPathResponse | null,
  projectPaths: ProjectLearningPathResponse | null,
  careerSuggestions: CareerSuggestion[]
) {
  const learningPathText = learningPathStepsToText(learningPath?.steps || [])
  const repoPathText = projectLearningPathsToText(projectPaths)
  const combinedLearningPathText = `${learningPathText} ${repoPathText}`.trim()

  const usedIds = new Set<string>()
  const usedTitles = new Set<string>()
  const usedPrimaryGroups = new Set<string>()

  const repoBasedSuggestions = (projectPaths?.projects || [])
    .map((project) => {
      const candidates = inferSuggestedCertificates(`${project.repo_name} ${learningPathStepsToText(project.steps || [])}`)
      const diverseCandidate =
        candidates.find((item) => {
          const titleKey = `${item.provider}:${item.title}`.toLowerCase()
          const primaryGroup = item.groups[0] || ""
          return !usedIds.has(item.id) && !usedTitles.has(titleKey) && (!primaryGroup || !usedPrimaryGroups.has(primaryGroup))
        }) ||
        candidates.find((item) => {
          const titleKey = `${item.provider}:${item.title}`.toLowerCase()
          return !usedIds.has(item.id) && !usedTitles.has(titleKey)
        })

      if (!diverseCandidate) return null
      usedIds.add(diverseCandidate.id)
      usedTitles.add(`${diverseCandidate.provider}:${diverseCandidate.title}`.toLowerCase())
      if (diverseCandidate.groups[0]) usedPrimaryGroups.add(diverseCandidate.groups[0])
      return {
        ...diverseCandidate,
        reasoning: `Recommended from the ${project.repo_name} repo learning path.`,
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  if (repoBasedSuggestions.length > 0) {
    return repoBasedSuggestions.slice(0, DEFAULT_SUGGESTED_CERTIFICATE_LIMIT)
  }

  const topCareer = careerSuggestions[0]
  const careerTrackText = [topCareer?.title, topCareer?.reasoning].filter(Boolean).join(" ").toLowerCase()
  if (careerTrackText) {
    return inferSuggestedCertificatesForCareer(combinedLearningPathText, careerTrackText)
  }

  return inferSuggestedCertificates(combinedLearningPathText)
}

export default function AdminCertificatesPage() {
  const auth = getStoredAdminAuth()
  const [students, setStudents] = useState<AdminStudentSummary[]>([])
  const [query, setQuery] = useState("")
  const [programFilter, setProgramFilter] = useState("ALL")
  const [yearFilter, setYearFilter] = useState("ALL")
  const [collapsedPrograms, setCollapsedPrograms] = useState<Record<string, boolean>>({})
  const [collapsedYears, setCollapsedYears] = useState<Record<string, boolean>>({})
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null)
  const [details, setDetails] = useState<AdminStudentDetail | null>(null)
  const [learningPath, setLearningPath] = useState<LearningPathResponse | null>(null)
  const [projectPaths, setProjectPaths] = useState<ProjectLearningPathResponse | null>(null)
  const [backendSuggestions, setBackendSuggestions] = useState<CertificateSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [studentLoading, setStudentLoading] = useState(false)
  const [error, setError] = useState("")
  const [studentError, setStudentError] = useState("")
  const [selectedCertificate, setSelectedCertificate] = useState<CertificateRecord | null>(null)
  const [selectedCertificateEntries, setSelectedCertificateEntries] = useState<CertificateRecord[]>([])
  const [certificateComment, setCertificateComment] = useState("")
  const [submittingComment, setSubmittingComment] = useState(false)
  const [reviewingCertificateId, setReviewingCertificateId] = useState<number | null>(null)
  const [deletingAdminCommentKey, setDeletingAdminCommentKey] = useState("")
  const [expandedCertificateProofUrl, setExpandedCertificateProofUrl] = useState<string | null>(null)
  const isFetchingRef = useRef(false)

  function replaceCertificateRecord(nextRow: CertificateRecord) {
    setSelectedCertificate((prev) => (prev?.id === nextRow.id ? nextRow : prev))
    setSelectedCertificateEntries((prev) => prev.map((item) => (item.id === nextRow.id ? nextRow : item)))
    setDetails((prev) =>
      prev
        ? {
            ...prev,
            certificates: prev.certificates.map((item) => (item.id === nextRow.id ? nextRow : item)),
          }
        : prev
    )
  }

  const loadStudents = async () => {
    if (!auth.token) return
    setLoading(true)
    try {
      const data = (await fetchAdminStudents(auth.token)) || []
      setStudents(data)
      if (!selectedStudentId && data.length > 0) {
        setSelectedStudentId(data[0].id)
      }
      setError("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load students.")
    } finally {
      setLoading(false)
    }
  }

  // loadStudentView accepts an optional `background` flag. When true,
  // it will fetch data without toggling the visible loading indicator so
  // background refreshes don't show "Loading student certificate review...".
  const loadStudentView = async (student: AdminStudentSummary, background = false) => {
    if (!auth.token || isFetchingRef.current) return
    isFetchingRef.current = true
    if (!background) setStudentLoading(true)
    try {
      const [detailPayload, pathPayload, projectPathPayload] = await Promise.all([
        fetchAdminStudentDetails(auth.token, student.id),
        fetchLearningPath(student.username).catch(() => null),
        fetchProjectLearningPaths(student.username).catch(() => null),
      ])
      setDetails(detailPayload || null)
      setLearningPath(pathPayload || null)
      setProjectPaths(projectPathPayload || null)
      try {
        const suggestionPayload = await fetchCertificateSuggestions(student.username)
        setBackendSuggestions(Array.isArray(suggestionPayload.items) ? suggestionPayload.items : [])
      } catch {
        setBackendSuggestions([])
      }
      setStudentError("")
    } catch (err) {
      setStudentError(err instanceof Error ? err.message : "Failed to load student certificate view.")
    } finally {
      if (!background) setStudentLoading(false)
      isFetchingRef.current = false
    }
  }

  const openCertificateArchive = (row: CertificateRecord, entries?: CertificateRecord[]) => {
    const nextEntries = (entries && entries.length ? entries : [row]).slice()
    const prioritizedEntry =
      nextEntries.find((entry) => getAdminCertificateNotificationCount(entry.username || selectedStudent?.username || "", entry) > 0) || row
    setSelectedCertificate(prioritizedEntry)
    setSelectedCertificateEntries(nextEntries)
    setCertificateComment("")
    setExpandedCertificateProofUrl(null)
    markCertificateNotificationsSeen(
      "admin",
      prioritizedEntry.username || selectedStudent?.username || "",
      prioritizedEntry.id,
      getLatestAdminCertificateNotificationTimestamp(prioritizedEntry)
    )
  }

  const submitCertificateComment = async () => {
    if (!auth.token || !selectedCertificate || !certificateComment.trim()) return
    setSubmittingComment(true)
    try {
      const updated = await commentOnCertificate(auth.token, {
        certificate_id: selectedCertificate.id,
        comment: certificateComment.trim(),
      })
      replaceCertificateRecord(updated as CertificateRecord)
      setCertificateComment("")
    } catch (err) {
      setStudentError(err instanceof Error ? err.message : "Failed to send certificate comment.")
    } finally {
      setSubmittingComment(false)
    }
  }

  const updateCertificateReviewStatus = async (row: CertificateRecord, nextStatus: "pending" | "verified" | "rejected") => {
    if (!auth.token) return
    setReviewingCertificateId(row.id)
    try {
      const updated = await reviewCertificate(auth.token, {
        certificate_id: row.id,
        status: nextStatus,
        reviewer_note: row.reviewer_note || undefined,
      })
      replaceCertificateRecord(updated as CertificateRecord)
      setStudentError("")
    } catch (err) {
      setStudentError(err instanceof Error ? err.message : "Failed to update certificate review status.")
    } finally {
      setReviewingCertificateId(null)
    }
  }

  useEffect(() => {
    loadStudents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.token])

  useEffect(() => {
    if (!error.includes("401") && !error.includes("403") && !studentError.includes("401") && !studentError.includes("403")) return
    signOutAdmin("/admin-login")
  }, [error, studentError])

  useEffect(() => {
    const student = students.find((item) => item.id === selectedStudentId)
    if (!student) return
    loadStudentView(student)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStudentId, students, auth.token])

  // Auto-refresh student details every 5 seconds for real-time tracking status updates
  useEffect(() => {
    if (!selectedStudentId || students.length === 0 || !auth.token) return
    const student = students.find((item) => item.id === selectedStudentId)
    if (!student) return

    let intervalId: ReturnType<typeof setInterval> | null = null
    
    const timeoutId = setTimeout(() => {
      intervalId = setInterval(() => {
        if (selectedCertificate && certificateComment.trim()) return
        // background refresh: do not toggle the visible loading indicator
        loadStudentView(student, true)
      }, 5000)
    }, 1000)

    return () => {
      clearTimeout(timeoutId)
      if (intervalId) clearInterval(intervalId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStudentId, auth.token, selectedCertificate, certificateComment])

  const filteredStudents = useMemo(() => {
    const term = query.trim().toLowerCase()
    return students
      .filter((student) => (programFilter === "ALL" ? true : resolveProgram(student) === programFilter))
      .filter((student) => (yearFilter === "ALL" ? true : resolveYear(student) === yearFilter))
      .filter((student) => {
        if (!term) return true
        const displayName = String(student.display_name || "").toLowerCase()
        const academicLabel = formatAcademicLabel(student.program, student.year_level).toLowerCase()
        return displayName.includes(term) || student.username.toLowerCase().includes(term) || academicLabel.includes(term)
      })
      .sort((a, b) => resolveStudentName(a).localeCompare(resolveStudentName(b)))
  }, [students, query, programFilter, yearFilter])

  const programOptions = useMemo(() => ["ALL", ...Array.from(new Set(students.map(resolveProgram))).sort()], [students])
  const yearOptions = useMemo(() => ["ALL", ...Array.from(new Set(students.map(resolveYear))).sort()], [students])

  const groups = useMemo<ProgramGroup[]>(() => {
    const byProgram = new Map<string, AdminStudentSummary[]>()
    filteredStudents.forEach((student) => {
      const key = resolveProgram(student)
      byProgram.set(key, [...(byProgram.get(key) || []), student])
    })
    return Array.from(byProgram.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([program, programStudents]) => {
        const byYear = new Map<string, AdminStudentSummary[]>()
        programStudents.forEach((student) => {
          const key = resolveYear(student)
          byYear.set(key, [...(byYear.get(key) || []), student])
        })
        const years = Array.from(byYear.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([year, yearStudents]) => ({ year, students: yearStudents }))
        return { program, students: programStudents, years }
      })
  }, [filteredStudents])

  const selectedStudent = students.find((item) => item.id === selectedStudentId) || details?.student || null
  const suggestedCertificates = useMemo(
    () => backendSuggestions.length > 0 ? backendSuggestions : inferSuggestedCertificatesForStudent(learningPath, projectPaths, details?.career_suggestions || []),
    [backendSuggestions, learningPath, projectPaths, details?.career_suggestions]
  )
  const matchedCertificates = useMemo(() => {
    const rows = details?.certificates || []
    return suggestedCertificates
      .map((track) => ({ track, row: matchCertificateToSuggestion(track, rows) || null }))
  }, [details, suggestedCertificates])
  const matchedCertificatesByTrack = useMemo(() => {
    const rows = details?.certificates || []
    const map = new Map<string, CertificateRecord[]>()
    for (const track of suggestedCertificates) {
      const matched = matchCertificatesToSuggestion(track, rows).sort(
        (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
      )
      if (matched.length) {
        map.set(track.id, matched)
      }
    }
    return map
  }, [details, suggestedCertificates])
  const matchedIds = useMemo(
    () =>
      new Set(
        Array.from(matchedCertificatesByTrack.values())
          .flat()
          .map((row) => row.id)
          .filter((value): value is number => typeof value === "number")
      ),
    [matchedCertificatesByTrack]
  )
  const otherCertificates = useMemo(
    () => (details?.certificates || []).filter((row) => !matchedIds.has(row.id)),
    [details, matchedIds]
  )

  const reviewProgressByTrack = useMemo(() => {
    const map = new Map<string, { label: string; className: string }>()
    const recentActions = details?.recent_recommendations || []

    for (const item of matchedCertificates) {
      const latestAction = recentActions.find((row) => actionMatchesTrack(row, item.track))

      // Show ONLY the tracking action status (what student clicked), not certificate submission status
      if (latestAction?.action) {
        map.set(item.track.id, statusMeta(String(latestAction.action)))
      } else {
        map.set(item.track.id, statusMeta("not_started"))
      }
    }
    return map
  }, [details, matchedCertificates])

  const trackerSummary = useMemo(
    () => summarizeTrackActions(matchedCertificates.map((item) => reviewProgressByTrack.get(item.track.id) || statusMeta("not_started"))),
    [matchedCertificates, reviewProgressByTrack]
  )
  const submittedCount = useMemo(() => {
    const rows = details?.certificates || []
    return rows.filter((row) => !isAutoDetectedCertificate(row.reviewer_note)).length
  }, [details])

  return (
    <AdminFrame>
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-ink/50">Certificates</p>
            <h2 className="text-3xl font-semibold">Certificate Monitoring</h2>
            <p className="mt-1 text-sm text-ink/60">Monitor each student's top suggested credential tracks and actual submitted certificates.</p>
          </div>
          {selectedStudent ? (
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-ink/10 px-3 py-1 text-xs">
                Learning Path Steps: {learningPath?.steps?.length || 0}
              </span>
              <span className="rounded-full border border-ink/10 px-3 py-1 text-xs">
                Remaining Suggested Tracks: {trackerSummary.remaining}
              </span>
              <span className="rounded-full border border-ink/10 px-3 py-1 text-xs">
                Total Submitted: {submittedCount > 0 ? submittedCount : "No submissions"}
              </span>
            </div>
          ) : null}
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-ink/10 bg-white/80 p-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-hidden">
            <div className="space-y-3">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search student"
                className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm outline-none"
              />
              <select
                value={programFilter}
                onChange={(event) => setProgramFilter(event.target.value)}
                className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm outline-none"
              >
                {programOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === "ALL" ? "All Programs" : option}
                  </option>
                ))}
              </select>
              <select
                value={yearFilter}
                onChange={(event) => setYearFilter(event.target.value)}
                className="w-full rounded-xl border border-ink/10 px-3 py-2 text-sm outline-none"
              >
                {yearOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === "ALL" ? "All Year Levels" : option}
                  </option>
                ))}
              </select>
            </div>
            {loading ? <p className="mt-4 text-sm text-ink/60">Loading students...</p> : null}
            {!loading && error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
            <div className="mt-4 space-y-3 xl:max-h-[calc(100vh-13.5rem)] xl:overflow-y-auto xl:pr-1">
              {groups.map((group) => {
                const programCollapsed = !!collapsedPrograms[group.program]
                return (
                  <section key={group.program} className="rounded-2xl border border-[#e6edf5] bg-[#fbfcfe] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">Program</p>
                        <h3 className="mt-1 text-base font-semibold text-[#101828]">{group.program}</h3>
                        <p className="mt-1 text-xs text-[#667085]">{group.students.length} students</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCollapsedPrograms((current) => ({ ...current, [group.program]: !programCollapsed }))}
                        className="rounded-full border border-[#d7dee8] bg-white px-3 py-1 text-[11px] font-semibold text-[#344054]"
                      >
                        {programCollapsed ? "Expand" : "Collapse"}
                      </button>
                    </div>
                    {!programCollapsed ? (
                      <div className="mt-3 space-y-3">
                        {group.years.map((yearGroup) => {
                          const yearKey = `${group.program}::${yearGroup.year}`
                          const yearCollapsed = !!collapsedYears[yearKey]
                          return (
                            <div key={yearKey} className="rounded-2xl border border-[#e6edf5] bg-white p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">Year Level</p>
                                  <p className="mt-1 text-sm font-semibold text-[#101828]">{yearGroup.year}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setCollapsedYears((current) => ({ ...current, [yearKey]: !yearCollapsed }))}
                                  className="rounded-full border border-[#d7dee8] bg-[#f8fafc] px-3 py-1 text-[11px] font-semibold text-[#344054]"
                                >
                                  {yearGroup.students.length} / {yearCollapsed ? "Expand" : "Collapse"}
                                </button>
                              </div>
                              {!yearCollapsed ? (
                                <div className="mt-3 space-y-2">
                                  {yearGroup.students.map((student) => {
                                    const isActive = student.id === selectedStudentId
                                    return (
                                      <button
                                        key={student.id}
                                        type="button"
                                        onClick={() => setSelectedStudentId(student.id)}
                                        className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                                          isActive ? "border-violet-300 bg-[#f6f1ff]" : "border-ink/10 bg-white hover:border-violet-200"
                                        }`}
                                      >
                                        <p className="text-sm font-semibold text-[#2d2752]">{resolveStudentName(student)}</p>
                                        <p className="mt-1 text-xs text-ink/60">@{student.username}</p>
                                        <p className="mt-1 text-xs text-[#5e4c85]">{formatAcademicLabel(student.program, student.year_level)}</p>
                                        <p className="mt-1 text-xs text-ink/50">{student.repo_count} repos</p>
                                      </button>
                                    )
                                  })}
                                </div>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                    ) : null}
                  </section>
                )
              })}
            </div>
          </aside>

          <section className="rounded-2xl border border-ink/10 bg-white/80 p-4">
            {!selectedStudent ? <p className="text-sm text-ink/60">Select a student to review certificates.</p> : null}
            {selectedStudent && studentLoading ? <p className="text-sm text-ink/60">Loading student certificate review...</p> : null}
            {selectedStudent && !studentLoading && studentError ? <p className="text-sm text-rose-600">{studentError}</p> : null}

            {selectedStudent && !studentLoading && !studentError ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-violet-100 bg-[#faf7ff] p-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[#7f72a3]">Student Certificate View</p>
                    <h3 className="mt-1 text-2xl font-semibold text-[#2d2752]">
                      {selectedStudent.display_name?.trim() || selectedStudent.username}
                    </h3>
                    <p className="mt-1 text-sm text-[#6f6495]">@{selectedStudent.username}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-violet-200 bg-white px-3 py-1 text-[#5e4c85]">
                        Program: {selectedStudent.program?.trim() || "Not set"}
                      </span>
                      <span className="rounded-full border border-violet-200 bg-white px-3 py-1 text-[#5e4c85]">
                        Year Level: {selectedStudent.year_level?.trim() || "Not set"}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-violet-200 px-3 py-1">
                      Learning Path Steps: {learningPath?.steps?.length || 0}
                    </span>
                    <span className="rounded-full border border-violet-200 px-3 py-1">
                      Remaining Suggested Tracks: {trackerSummary.remaining}
                    </span>
                    <span className="rounded-full border border-violet-200 px-3 py-1">
                      Total Submitted: {submittedCount > 0 ? submittedCount : "No submissions"}
                    </span>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="mb-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6D6AA6]">Learning-path-based credential review</p>
                    <p className="mt-1 text-sm text-[#6A6F88]">Top learning-path suggestions are shown first. Actual student submissions that do not match these suggestions appear below.</p>
                  </div>

                  {suggestedCertificates.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-violet-200 bg-[#fcfbff] p-4 text-sm text-[#6A6F88]">
                      No suggested credential tracks found for this student yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {matchedCertificates.map(({ track, row }) => {
                        const meta = reviewProgressByTrack.get(track.id) || statusMeta(row?.status || "")
                        const submissionMeta = row ? certificateSubmissionStatusMeta(row.status || "pending") : null
                        const showCertificateLink = Boolean(row?.certificate_url)
                        const showProgressPanel = Boolean(row) && !isCompleteStatus(meta.label)
                        const archiveRows = matchedCertificatesByTrack.get(track.id) || []
                        const unreadCertificateUpdates = archiveRows.length
                          ? archiveRows.reduce(
                              (sum, entry) => sum + getAdminCertificateNotificationCount(entry.username || selectedStudent?.username || "", entry),
                              0
                            )
                          : row
                            ? getAdminCertificateNotificationCount(row.username || selectedStudent?.username || "", row)
                            : 0
                        return (
                          <article key={track.id} className="rounded-[14px] border border-[#E1E6FB] bg-white/80 p-3 shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-[13px] font-medium text-[#1E2538]">{track.title}</p>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] ml-2 ${meta.className}`}>{meta.label}</span>
                                {submissionMeta ? (
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${submissionMeta.className}`}>{submissionMeta.label}</span>
                                ) : null}
                                {unreadCertificateUpdates > 0 ? (
                                  <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-[#ef4444] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                                    {unreadCertificateUpdates > 99 ? "99+" : unreadCertificateUpdates}
                                  </span>
                                ) : null}
                              </div>
                              <span className="rounded-full bg-[#EEF2FF] px-3 py-1 text-[11px] font-semibold text-[#4338CA]">
                                {track.rewardXp} XP
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] text-[#6A7288]">{track.provider}</p>
                            {row ? (
                              <p className="mt-2 text-[11px] text-[#55607a]">
                                Submitted on {formatDateTime(row.submitted_at)} with title: {row.title} and provider: {row.provider}
                              </p>
                            ) : (
                              <p className="mt-2 text-[11px] text-[#55607a]">
                                {track.reasoning}
                              </p>
                            )}
                            <p className="mt-2 text-[11px] font-semibold text-[#4338CA]">High-effort reward: {track.rewardXp} XP</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <a
                                href={track.url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-full border border-[#D1D6E3] px-3 py-1 text-[11px] text-[#2E3550]"
                              >
                                Open Learning Track
                              </a>
                              {showCertificateLink && row ? (
                                <a
                                  href={row.certificate_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-full border border-[#C9E7DD] bg-white px-3 py-1 text-[11px] text-[#0F6E56]"
                                >
                                  {certificatePrimaryActionLabel(row)}
                                </a>
                              ) : null}
                            </div>

                            <div className="mt-3 text-[11px] text-[#6A7288]">
                              {row
                                ? isCompleteStatus(meta.label)
                                  ? "Final credential submitted. Check and review this submission only."
                                  : "Progress proof submitted by student. Review the update and add comments if needed."
                                : meta.label === "In progress"
                                  ? "The student marked this credential as in progress, but has not posted an update proof yet."
                                  : "No submission yet. This track stays Not started until student submits a certificate URL."}
                            </div>
                            {row ? (
                              <div className="mt-3 rounded-[12px] border border-[#E1E6FB] bg-[#f8faff] p-3">
                                <div className="rounded-[12px] border border-[#E1E6FB] bg-white px-3 py-3">
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6D6AA6]">
                                        {showProgressPanel ? "Progress Proof Archive" : "Submitted Credential Review"}
                                      </p>
                                      <p className="mt-1 text-[11px] text-[#6A7288]">
                                        {showProgressPanel
                                          ? "Student progress is stored here for admin review and comment follow-up."
                                          : "The student already completed this credential. Review the final submission and leave comments if needed."}
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => openCertificateArchive(row, archiveRows)}
                                      className="rounded-full border border-violet-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-[#5e4c85]"
                                    >
                                      {showProgressPanel ? "View in progress" : "Review submission"}
                                      {getAdminCertificateNotificationCount(row.username || selectedStudent?.username || "", row) > 0 ? ` (${getAdminCertificateNotificationCount(row.username || selectedStudent?.username || "", row)})` : ""}
                                    </button>
                                  </div>
                                  <div className="mt-3">
                                    <span className="inline-flex rounded-full border border-[#D6DCF2] bg-white px-3 py-1 text-[11px] text-[#55607A]">
                                      {formatDateTime(row.submitted_at)}
                                    </span>
                                  </div>
                                  <div className="mt-3 flex flex-wrap items-center gap-2">
                                    {(["pending", "verified", "rejected"] as const).map((value) => {
                                      const actionMeta = certificateReviewActionMeta(value)
                                      const active = (row.status || "pending").toLowerCase() === value
                                      const disabled = reviewingCertificateId === row.id
                                      return (
                                        <button
                                          key={value}
                                          type="button"
                                          disabled={disabled || active}
                                          onClick={() => void updateCertificateReviewStatus(row, value)}
                                          className={`rounded-full border px-3 py-1 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
                                            active ? actionMeta.activeClassName : actionMeta.idleClassName
                                          }`}
                                        >
                                          {disabled && !active ? "Saving..." : actionMeta.label}
                                        </button>
                                      )
                                    })}
                                  </div>
                                </div>
                              </div>
                            ) : meta.label === "In progress" ? (
                              <div className="mt-3 rounded-[12px] border border-[#f2caca] bg-[#fff5f5] px-3 py-3">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#b45454]">No progress proof posted yet</p>
                                <p className="mt-1 text-[11px] text-[#8c4a4a]">
                                  The student has started this credential, but no progress message or update proof has been saved for admin review yet.
                                </p>
                              </div>
                            ) : null}
                          </article>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-8">
                  <div className="mb-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6D6AA6]">Other Submitted Credentials</p>
                    <p className="mt-1 text-sm text-[#6A6F88]">These submissions do not currently match the student's suggested learning-path credentials, but they can still be reviewed here.</p>
                  </div>

                  {otherCertificates.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-violet-200 bg-[#fcfbff] p-4 text-sm text-[#6A6F88]">
                      No additional submitted credentials outside the matched suggestions.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {otherCertificates.map((row) => {
                        const meta = certificateSubmissionStatusMeta(row.status || "pending")
                        const showCertificateLink = Boolean(row.certificate_url)
                        const unreadCertificateUpdates = getAdminCertificateNotificationCount(row.username || selectedStudent?.username || "", row)
                        return (
                          <article key={row.id} className="rounded-2xl border border-ink/10 bg-white p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-lg font-semibold text-[#1E2538]">{row.title}</p>
                                  {unreadCertificateUpdates > 0 ? (
                                    <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-[#ef4444] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                                      {unreadCertificateUpdates > 99 ? "99+" : unreadCertificateUpdates}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <span className="rounded-full border border-ink/10 px-3 py-1 text-xs font-semibold text-[#5e4c85]">
                                    {row.provider}
                                  </span>
                                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${meta.className}`}>
                                    {meta.label}
                                  </span>
                                  {row.proof_type ? (
                                    <span className="rounded-full bg-[#EEF2FF] px-3 py-1 text-xs font-semibold text-[#4253a4]">
                                      {row.proof_type}
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-2 text-sm text-[#6A6F88]">
                                  Submitted on {formatDateTime(row.submitted_at)}.
                                </p>
                                {row.student_note ? (
                                  <p className="mt-1 text-xs text-[#6A6F88]">Student note: {row.student_note}</p>
                                ) : null}
                                {row.certificate_page_url ? (
                                  <p className="mt-1 text-xs text-[#6A6F88]">Certificate URL provided separately for review.</p>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {showCertificateLink ? (
                                  <a
                                    href={row.certificate_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-full border border-violet-200 px-4 py-2 text-xs font-semibold text-[#5e4c85]"
                                  >
                                    {certificatePrimaryActionLabel(row)}
                                  </a>
                                ) : null}
                                {row.certificate_page_url ? (
                                  <a
                                    href={row.certificate_page_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-full border border-violet-200 px-4 py-2 text-xs font-semibold text-[#5e4c85]"
                                  >
                                    Open Certificate URL
                                  </a>
                                ) : null}
                              </div>
                            </div>

                            <div className="mt-3 text-[11px] text-[#6A7288]">
                              Monitoring only: status is based on student certificate submission record and current review state.
                            </div>
                            <div className="mt-3 rounded-[12px] border border-[#E1E6FB] bg-[#f8faff] p-3">
                              <div className="rounded-[12px] border border-[#E1E6FB] bg-white px-3 py-3">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6D6AA6]">Submitted Credential Review</p>
                                    <p className="mt-1 text-[11px] text-[#6A7288]">
                                      Review the submitted credential and leave comments if needed.
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => openCertificateArchive(row)}
                                    className="rounded-full border border-violet-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-[#5e4c85]"
                                  >
                                    Review submission{getAdminCertificateNotificationCount(row.username || selectedStudent?.username || "", row) > 0 ? ` (${getAdminCertificateNotificationCount(row.username || selectedStudent?.username || "", row)})` : ""}
                                  </button>
                                </div>
                                <div className="mt-3">
                                  <span className="inline-flex rounded-full border border-[#D6DCF2] bg-white px-3 py-1 text-[11px] text-[#55607A]">
                                    {formatDateTime(row.submitted_at)}
                                  </span>
                                </div>
                                {showCertificateLink ? (
                                  <div className="mt-3 rounded-[12px] border border-[#D6DCF2] bg-[#f8faff] px-3 py-3">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6D6AA6]">Submitted URL</p>
                                    <a
                                      href={row.certificate_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="mt-1 block break-all text-[12px] font-medium text-[#4338CA] underline underline-offset-2"
                                    >
                                      {readableUrl(row.certificate_url)}
                                    </a>
                                  </div>
                                ) : null}
                                {row.certificate_page_url ? (
                                  <div className="mt-3 rounded-[12px] border border-[#D6DCF2] bg-[#f8faff] px-3 py-3">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6D6AA6]">Certificate Page URL</p>
                                    <a
                                      href={row.certificate_page_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="mt-1 block break-all text-[12px] font-medium text-[#4338CA] underline underline-offset-2"
                                    >
                                      {readableUrl(row.certificate_page_url)}
                                    </a>
                                  </div>
                                ) : null}
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                  {(["pending", "verified", "rejected"] as const).map((value) => {
                                    const actionMeta = certificateReviewActionMeta(value)
                                    const active = (row.status || "pending").toLowerCase() === value
                                    const disabled = reviewingCertificateId === row.id
                                    return (
                                      <button
                                        key={value}
                                        type="button"
                                        disabled={disabled || active}
                                        onClick={() => void updateCertificateReviewStatus(row, value)}
                                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
                                          active ? actionMeta.activeClassName : actionMeta.idleClassName
                                        }`}
                                      >
                                        {disabled && !active ? "Saving..." : actionMeta.label}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </section>
        </div>

        {selectedCertificate ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1f2440]/35 px-4 py-6">
            <div className="w-full max-w-5xl overflow-hidden rounded-[24px] border border-[#f2caca] bg-[#fff8f8] shadow-[0_22px_44px_rgba(73,37,37,0.16)]">
              <div className="flex items-start justify-between gap-3 border-b border-[#f0d7d7] px-5 py-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b45454]">Progress Proof Archive</p>
                  <h3 className="mt-2 text-[24px] font-semibold text-[#7b2424]">{selectedCertificate.title}</h3>
                  <p className="mt-1 text-[12px] text-[#b45454]">
                    {selectedCertificate.username || selectedStudent?.username} - {formatDateTime(selectedCertificate.submitted_at)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full border border-[#f0b8b8] bg-white px-3 py-1 text-[11px] font-semibold text-[#8f3d3d]">
                      Program: {selectedStudent?.program?.trim() || "Not set"}
                    </span>
                    <span className="rounded-full border border-[#f0b8b8] bg-white px-3 py-1 text-[11px] font-semibold text-[#8f3d3d]">
                      Year Level: {selectedStudent?.year_level?.trim() || "Not set"}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${certificateSubmissionStatusMeta(selectedCertificate.status || "pending").className}`}>
                      {certificateSubmissionStatusMeta(selectedCertificate.status || "pending").label}
                    </span>
                    {(["pending", "verified", "rejected"] as const).map((value) => {
                      const actionMeta = certificateReviewActionMeta(value)
                      const active = (selectedCertificate.status || "pending").toLowerCase() === value
                      const disabled = reviewingCertificateId === selectedCertificate.id
                      return (
                        <button
                          key={value}
                          type="button"
                          disabled={disabled || active}
                          onClick={() => void updateCertificateReviewStatus(selectedCertificate, value)}
                          className={`rounded-full border px-3 py-1 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
                            active ? actionMeta.activeClassName : actionMeta.idleClassName
                          }`}
                        >
                          {disabled && !active ? "Saving..." : actionMeta.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCertificate(null)
                    setSelectedCertificateEntries([])
                  }}
                  className="rounded-full border border-[#f0b8b8] bg-white px-3 py-1 text-[11px] font-semibold text-[#b45454]"
                >
                  Close
                </button>
              </div>

              <div className="grid gap-0 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.85fr)]">
                <div className="border-b border-[#f0d7d7] p-5 lg:border-b-0 lg:border-r">
                  {!isCertificateLinkProof(selectedCertificate) && selectedCertificateEntries.length > 1 ? (
                    <div className="mb-4 rounded-[18px] border border-[#eedede] bg-white p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8a94ad]">Posted updates</p>
                      <div className="mt-3 max-h-[180px] space-y-2 overflow-y-auto pr-1">
                        {selectedCertificateEntries.map((entry, index) => {
                          const active = entry.id === selectedCertificate.id
                          const unreadStudentUpdates = getAdminCertificateNotificationCount(entry.username || selectedStudent?.username || "", entry)
                          return (
                            <button
                              key={`${entry.id}-${index}`}
                              type="button"
                              onClick={() => {
                                setSelectedCertificate(entry)
                                setExpandedCertificateProofUrl(null)
                                markCertificateNotificationsSeen(
                                  "admin",
                                  entry.username || selectedStudent?.username || "",
                                  entry.id,
                                  getLatestAdminCertificateNotificationTimestamp(entry)
                                )
                              }}
                              className={`w-full rounded-[12px] border px-3 py-2 text-left ${
                                active
                                  ? "border-[#1f1f1f] bg-[#fff5f5]"
                                  : unreadStudentUpdates > 0
                                    ? "border-[#f3b1b1] bg-[#fff8f8]"
                                    : "border-[#e5e7eb] bg-white"
                              }`}
                            >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-[12px] font-semibold text-[#2A3145]">{certificateProofLabel(entry)}</p>
                                  {unreadStudentUpdates > 0 ? (
                                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#d14343]">
                                      New student update
                                    </p>
                                  ) : null}
                                </div>
                                {unreadStudentUpdates > 0 ? (
                                  <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#ef4444] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                                    {unreadStudentUpdates > 99 ? "99+" : unreadStudentUpdates}
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 text-[11px] text-[#8a94ad]">{formatDateTime(entry.submitted_at)}</p>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}

                  {isCertificateLinkProof(selectedCertificate) ? (
                    <div className="rounded-[18px] border border-[#eedede] bg-white p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8a94ad]">Certificate Link</p>
                      <a
                        href={selectedCertificate.certificate_url || selectedCertificate.certificate_page_url || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-[14px] font-semibold text-[#4338CA] underline underline-offset-2"
                      >
                        Open certificate link
                      </a>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-start justify-between gap-3 rounded-[18px] border border-[#eedede] bg-white p-4">
                        <div>
                          <p className="text-[16px] font-semibold text-[#2A3145]">{certificateProofLabel(selectedCertificate)}</p>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8a94ad]">Student progress</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <a
                            href={selectedCertificate.certificate_url}
                            onClick={(event) => {
                              event.preventDefault()
                              if (!canInlineCertificateProof(selectedCertificate) || certificateProofKind(selectedCertificate) === "pdf") {
                                window.open(selectedCertificate.certificate_url, "_blank", "noopener,noreferrer")
                                return
                              }
                              setExpandedCertificateProofUrl(selectedCertificate.certificate_url)
                            }}
                            className="rounded-full border border-[#cfd6ff] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#3b3a70]"
                          >
                            View
                          </a>
                          {selectedCertificate.certificate_page_url ? (
                            <a
                              href={selectedCertificate.certificate_page_url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-full border border-[#cfd6ff] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#3b3a70]"
                            >
                              Certificate page
                            </a>
                          ) : null}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (!canInlineCertificateProof(selectedCertificate) || certificateProofKind(selectedCertificate) === "pdf") {
                            window.open(selectedCertificate.certificate_url, "_blank", "noopener,noreferrer")
                            return
                          }
                          setExpandedCertificateProofUrl(selectedCertificate.certificate_url)
                        }}
                        className="mt-4 block overflow-hidden rounded-[18px] border border-[#eedede] bg-white"
                      >
                        {certificateProofKind(selectedCertificate) === "image" ? (
                          <img
                            src={selectedCertificate.certificate_url}
                            alt={certificateProofLabel(selectedCertificate)}
                            className="h-[260px] w-full object-cover"
                          />
                        ) : certificateProofKind(selectedCertificate) === "video" ? (
                          <video
                            src={selectedCertificate.certificate_url}
                            muted
                            playsInline
                            controls
                            className="h-[260px] w-full bg-black object-contain"
                          />
                        ) : certificateProofKind(selectedCertificate) === "pdf" ? (
                          <div className="flex h-[260px] w-full items-center justify-center text-[13px] font-semibold text-[#334155]">
                            PDF
                          </div>
                        ) : (
                          <div className="flex h-[260px] w-full items-center justify-center text-[13px] font-semibold text-[#334155]">
                            FILE
                          </div>
                        )}
                      </button>

                      <div className="mt-4 rounded-[18px] border border-[#eedede] bg-white p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b45454]">Student Comment</p>
                        <p className="mt-2 text-[13px] text-[#2A3145]">{selectedCertificate.student_note || "No student comment added for this proof."}</p>
                      </div>
                    </>
                  )}
                </div>

                <div className="p-5 md:flex md:min-h-[520px] md:flex-col md:gap-3">
                  {(() => {
                    const displayCommentThread = selectedCertificate.student_note
                      ? [
                          {
                            comment: selectedCertificate.student_note,
                            by: selectedCertificate.username || selectedStudent?.username || "Student",
                            role: "student",
                            updated_at: selectedCertificate.submitted_at,
                          },
                          ...(selectedCertificate.comment_thread || []),
                        ]
                      : (selectedCertificate.comment_thread || [])
                    return (
                      <>
                  <div className="rounded-[14px] border border-[#e5e7eb] bg-[#fcfdff] p-3 md:flex md:min-h-0 md:flex-1 md:flex-col">
                    <div className="flex shrink-0 items-center justify-between gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8a94ad]">Comment Thread</p>
                      <div className="flex items-center gap-2">
                        {displayCommentThread.some((entry) => entry.role === "admin" && entry.by === auth.username) ? (
                          <button
                            type="button"
                            disabled={deletingAdminCommentKey === `${selectedCertificate?.id || 0}::all`}
                            onClick={async () => {
                              if (!selectedCertificate) return
                              setDeletingAdminCommentKey(`${selectedCertificate.id}::all`)
                              try {
                                const updated = await deleteCertificateComment(auth.token, {
                                  certificate_id: selectedCertificate.id,
                                  delete_all: true,
                                })
                                replaceCertificateRecord(updated as CertificateRecord)
                              } finally {
                                setDeletingAdminCommentKey("")
                              }
                            }}
                            className="rounded-full border border-[#fecaca] bg-white px-3 py-1 text-[10px] font-semibold text-[#b42318] disabled:opacity-60"
                          >
                            {deletingAdminCommentKey === `${selectedCertificate?.id || 0}::all` ? "Deleting..." : "Delete all"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-3 max-h-[340px] space-y-3 overflow-y-auto pr-1 md:min-h-0 md:flex-1">
                    {displayCommentThread.length ? (
                      displayCommentThread.map((entry, index) => (
                        <div
                          key={`${entry.role}-${entry.updated_at || index}`}
                          className={`rounded-[14px] border px-3 py-3 ${entry.role === "admin" ? "border-[#f2caca] bg-[#fff7f7]" : "border-[#d9e2ff] bg-[#f7f9ff]"}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[13px] text-[#2A3145]">{entry.comment}</p>
                            {entry.role === "admin" && entry.updated_at ? (
                              <button
                                type="button"
                                disabled={deletingAdminCommentKey === `${selectedCertificate?.id || 0}::${entry.updated_at || ""}`}
                                onClick={async () => {
                                  if (!selectedCertificate) return
                                  setDeletingAdminCommentKey(`${selectedCertificate.id}::${entry.updated_at || ""}`)
                                  try {
                                    const updated = await deleteCertificateComment(auth.token, {
                                      certificate_id: selectedCertificate.id,
                                      updated_at: entry.updated_at || "",
                                    })
                                    replaceCertificateRecord(updated as CertificateRecord)
                                  } finally {
                                    setDeletingAdminCommentKey("")
                                  }
                                }}
                                className="shrink-0 rounded-full border border-[#fecaca] bg-white px-2 py-1 text-[10px] font-semibold text-[#b42318]"
                              >
                                {deletingAdminCommentKey === `${selectedCertificate?.id || 0}::${entry.updated_at || ""}` ? "Deleting..." : "Delete"}
                              </button>
                            ) : null}
                          </div>
                          <p className={`mt-2 text-[11px] ${entry.role === "admin" ? "text-[#b45454]" : "text-[#4f46e5]"}`}>
                            By {entry.by || (entry.role === "admin" ? "Admin" : "Student")} - {formatDateTime(entry.updated_at)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[14px] border border-dashed border-[#d9deeb] bg-white px-3 py-4 text-[12px] text-[#6A7288]">
                        No admin comments yet for this proof.
                      </div>
                    )}
                    </div>
                  </div>
                      </>
                    )
                  })()}

                  <div className="shrink-0 rounded-[18px] border border-[#f2caca] bg-white p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b45454]">Write Comment</p>
                    <textarea
                      value={certificateComment}
                      onChange={(event) => setCertificateComment(event.target.value)}
                      rows={4}
                      className="mt-3 w-full rounded-[14px] border border-[#d6dcf2] px-3 py-2 text-[12px] outline-none"
                      placeholder="Type admin comment for this proof."
                    />
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        disabled={submittingComment || !certificateComment.trim()}
                        onClick={() => void submitCertificateComment()}
                        className="rounded-full bg-[#b45454] px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60"
                      >
                        {submittingComment ? "Saving..." : "Save comment"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {expandedCertificateProofUrl && selectedCertificate ? (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4 py-6">
            <div className="w-full max-w-6xl overflow-hidden rounded-[20px] bg-white shadow-[0_22px_44px_rgba(0,0,0,0.25)]">
              <div className="flex items-center justify-between border-b border-[#e5e7eb] px-4 py-3">
                <p className="text-[13px] font-semibold text-[#1f2937]">{certificateProofLabel(selectedCertificate)}</p>
                <button
                  type="button"
                  onClick={() => setExpandedCertificateProofUrl(null)}
                  className="rounded-full border border-[#d1d5db] bg-white px-3 py-1 text-[11px] font-semibold text-[#374151]"
                >
                  Close
                </button>
              </div>
              <div className="flex max-h-[80vh] items-center justify-center bg-[#f8fafc] p-4">
                {certificateProofKind(selectedCertificate) === "image" ? (
                  <img
                    src={expandedCertificateProofUrl}
                    alt={certificateProofLabel(selectedCertificate)}
                    className="max-h-[72vh] w-auto max-w-full object-contain"
                  />
                ) : certificateProofKind(selectedCertificate) === "video" ? (
                  <video
                    src={expandedCertificateProofUrl}
                    controls
                    autoPlay
                    className="max-h-[72vh] w-auto max-w-full bg-black"
                  />
                ) : (
                  <iframe
                    src={expandedCertificateProofUrl}
                    title={certificateProofLabel(selectedCertificate)}
                    className="h-[72vh] w-full rounded-[12px] bg-white"
                  />
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AdminFrame>
  )
}
