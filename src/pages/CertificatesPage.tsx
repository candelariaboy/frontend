import { useEffect, useMemo, useRef, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import {
  claimCertificateReward,
  deleteMyCertificateCommentReply,
  deleteCertificateProgress,
  fetchCertificateSuggestions,
  fetchOwnerPortfolio,
  fetchLearningPath,
  fetchProjectLearningPaths,
  fetchMyCertificates,
  getStoredAuth,
  replyCertificateComment,
  submitCertificate,
  trackRecommendationAction,
} from "../lib/api"
import { cinematicStagger, softFloat } from "../lib/motion"
import {
  DEFAULT_SUGGESTED_CERTIFICATE_LIMIT,
  inferSuggestedCertificates,
  inferSuggestedCertificatesForCareer,
  matchCertificateToSuggestion,
  matchCertificatesToSuggestion,
  summarizeSuggestionProgress,
} from "../lib/certificateSuggestions"
import {
  getLatestStudentCertificateNotificationTimestamp,
  getStudentCertificateNotificationCount,
  markCertificateNotificationsSeen,
} from "../lib/certificateNotifications"
import type {
  CertificateRecord,
  CertificateSuggestion,
  LearningPathStep,
  ProjectLearningPathResponse,
} from "../types"

function statusMeta(value: string) {
  const status = (value || "").toLowerCase()
  if (status === "verified") return { label: "Verified", className: "bg-[#E8F4F0] text-[#0F6E56]" }
  if (status === "rejected") return { label: "Rejected", className: "bg-[#FDECEC] text-[#A32D2D]" }
  return { label: "Pending", className: "bg-[#FFF4E8] text-[#BA7517]" }
}

function formatDateTime(value?: string | null) {
  if (!value) return "-"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}

function inferProofTypeFromUrl(value?: string | null) {
  const url = String(value || "").trim().toLowerCase()
  if (!url) return "Shareable Link"
  if (/\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/.test(url)) return "Image"
  if (/\.(mp4|webm|mov|m4v|avi)(\?|#|$)/.test(url)) return "Video"
  if (/\.pdf(\?|#|$)/.test(url)) return "PDF"
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "Video Link"
  if (url.includes("drive.google.com")) return "Drive Link"
  return "Shareable Link"
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

function certificatePrimaryActionLabel(row?: Pick<CertificateRecord, "certificate_url" | "proof_type"> | null) {
  const proofType = String(row?.proof_type || "").trim().toLowerCase()
  if (proofType.includes("certificate link") || proofType.includes("shareable link")) {
    return "Open certificate link"
  }
  if (proofType.includes("image") || proofType.includes("video") || proofType.includes("pdf") || proofType.includes("file")) {
    return "Open proof file"
  }
  return "Open proof"
}

function canDeleteCertificate(row?: Pick<CertificateRecord, "status"> | null) {
  return String(row?.status || "").trim().toLowerCase() !== "verified"
}

function canClaimCertificateReward(row?: Pick<CertificateRecord, "completion_locked" | "completion_reward_xp" | "rewarded_at"> | null) {
  return Boolean(row?.completion_locked) && Number(row?.completion_reward_xp || 0) > 0 && !row?.rewarded_at
}

function scrollToSection(sectionId: string) {
  if (typeof window === "undefined") return
  const node = document.getElementById(sectionId)
  if (!node) return
  node.scrollIntoView({ behavior: "smooth", block: "start" })
}

function isSuggestionLocked(item?: unknown) {
  if (!item || typeof item !== "object") return false
  const row = item as Record<string, unknown>
  return Boolean(row.completed || row.locked)
}

function normalizeSubmittedCertificate(
  payload: unknown,
  fallback: {
    title: string
    provider: string
    proofType?: string | null
    proofLink: string
    certificatePageUrl?: string | null
    studentNote?: string | null
    username: string
  }
): CertificateRecord {
  const row = (payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {}) || {}
  return {
    id: Number(row.id) || Date.now(),
    user_id: Number(row.user_id) || 0,
    username: String(row.username || fallback.username || ""),
    title: String(row.title || fallback.title),
    provider: String(row.provider || fallback.provider),
    proof_type: String(row.proof_type || fallback.proofType || ""),
    certificate_url: String(row.certificate_url || fallback.proofLink),
    certificate_page_url: String(row.certificate_page_url || fallback.certificatePageUrl || ""),
    student_note: String(row.student_note || fallback.studentNote || ""),
    suggestion_track_id: typeof row.suggestion_track_id === "string" ? row.suggestion_track_id : null,
    suggestion_module_url: typeof row.suggestion_module_url === "string" ? row.suggestion_module_url : null,
    completion_locked: Boolean(row.completion_locked),
    completion_reward_xp: typeof row.completion_reward_xp === "number" ? row.completion_reward_xp : null,
    rewarded_at: typeof row.rewarded_at === "string" ? row.rewarded_at : null,
    hidden_from_student: Boolean(row.hidden_from_student),
    status: String(row.status || "pending"),
    reviewer_note: (row.reviewer_note as string | null | undefined) || null,
    submitted_at: String(row.submitted_at || new Date().toISOString()),
    verified_at: (row.verified_at as string | null | undefined) || null,
    comment_thread: Array.isArray(row.comment_thread) ? (row.comment_thread as CertificateRecord["comment_thread"]) : [],
    latest_admin_comment_at: (row.latest_admin_comment_at as string | null | undefined) || null,
    latest_student_reply_at: (row.latest_student_reply_at as string | null | undefined) || null,
  }
}

function learningPathStepsToText(steps: LearningPathStep[]) {
  return steps
    .map((step) =>
      [
        step.title,
        step.description,
        step.reason,
        step.tag,
        step.dimension,
        step.dimension_key,
        step.type,
        ...(step.tags || []),
        ...(step.evidence || []),
        ...(step.resources?.courses || []).map((item) => item.name),
        ...(step.resources?.tools || []).map((item) => item.name),
        ...(step.resources?.documentation || []).map((item) => item.name),
      ]
        .filter(Boolean)
        .join(" ")
    )
    .join(" ")
    .toLowerCase()
}

function projectLearningPathsToText(projectPaths: ProjectLearningPathResponse | null) {
  return (projectPaths?.projects || [])
    .map((project) => `${project.repo_name} ${learningPathStepsToText(project.steps || [])}`)
    .join(" ")
    .toLowerCase()
}

export default function CertificatesPage() {
  const reduceMotion = useReducedMotion()
  const containerMotion = reduceMotion ? {} : { variants: cinematicStagger, initial: "hidden", animate: "visible" }
  const sectionMotion = reduceMotion ? {} : { variants: softFloat }
  const auth = getStoredAuth()
  const [rows, setRows] = useState<CertificateRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState("")
  const [title, setTitle] = useState("")
  const [provider, setProvider] = useState("")
  const [proofLink, setProofLink] = useState("")
  const [certificatePageUrl, setCertificatePageUrl] = useState("")
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string>("")
  const [learningPathText, setLearningPathText] = useState("")
  const [projectPaths, setProjectPaths] = useState<ProjectLearningPathResponse | null>(null)
  const [pathLoading, setPathLoading] = useState(false)
  const [pathError, setPathError] = useState("")
  const [careerTrackText, setCareerTrackText] = useState("")
  const [backendSuggestions, setBackendSuggestions] = useState<CertificateSuggestion[]>([])
  const [suggestionProgress, setSuggestionProgress] = useState<Record<string, "not-started" | "in-progress" | "complete">>({})
  const [suggestionDrafts, setSuggestionDrafts] = useState<
    Record<string, { proofLink: string; certificatePageUrl: string; comment: string }>
  >({})
  const [selectedArchiveCertificate, setSelectedArchiveCertificate] = useState<CertificateRecord | null>(null)
  const [selectedArchiveEntries, setSelectedArchiveEntries] = useState<CertificateRecord[]>([])
  const [archiveHasUnreadAdminNotice, setArchiveHasUnreadAdminNotice] = useState(false)
  const [archiveViewLabel, setArchiveViewLabel] = useState("Submission history")
  const [archiveCommentReadOnly, setArchiveCommentReadOnly] = useState(false)
  const [certificateReply, setCertificateReply] = useState("")
  const [replyingCertificateId, setReplyingCertificateId] = useState<number | null>(null)
  const [claimingCertificateId, setClaimingCertificateId] = useState<number | null>(null)
  const [deletingCertificateProgressId, setDeletingCertificateProgressId] = useState<number | null>(null)
  const [deletingCertificateReplyKey, setDeletingCertificateReplyKey] = useState("")
  const [expandedCertificateProofUrl, setExpandedCertificateProofUrl] = useState<string | null>(null)
  const [showInstructions, setShowInstructions] = useState(false)
  const lastAdminNotificationTotalRef = useRef(0)

  function replaceCertificateRecord(nextRow: CertificateRecord) {
    setRows((prev) => prev.map((item) => (item.id === nextRow.id ? nextRow : item)))
    setSelectedArchiveCertificate((prev) => (prev?.id === nextRow.id ? nextRow : prev))
    setSelectedArchiveEntries((prev) => prev.map((item) => (item.id === nextRow.id ? nextRow : item)))
  }

  const claimReward = async (row: CertificateRecord) => {
    if (!auth.token) return
    setClaimingCertificateId(row.id)
    try {
      const updated = await claimCertificateReward(auth.token, { certificate_id: row.id })
      const nextRow = normalizeSubmittedCertificate(updated, {
        title: row.title,
        provider: row.provider,
        proofType: row.proof_type,
        proofLink: row.certificate_url,
        certificatePageUrl: row.certificate_page_url || null,
        studentNote: row.student_note || null,
        username: auth.username,
      })
      replaceCertificateRecord(nextRow)
      setToast(`You claimed ${nextRow.completion_reward_xp || 0} XP for "${nextRow.title}".`)
      void load()
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Failed to claim certificate reward.")
    } finally {
      setClaimingCertificateId(null)
    }
  }

  const load = async () => {
    if (!auth.token) return
    setLoading(true)
    try {
      const payload = await fetchMyCertificates(auth.token)
      setRows(Array.isArray(payload) ? payload : [])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!auth.token) {
      setRows([])
      return
    }
    void load()
  }, [auth.token])

  useEffect(() => {
    if (!auth.username) {
      return
    }
    let cancelled = false
    const loadLearningPath = async () => {
      setPathLoading(true)
      setPathError("")
      try {
        const [learningPathResult, projectPathResult] = await Promise.allSettled([
          fetchLearningPath(auth.username),
          fetchProjectLearningPaths(auth.username),
        ])
        if (cancelled) return
        const lp = learningPathResult.status === "fulfilled" ? learningPathResult.value : null
        const nextProjectPaths = projectPathResult.status === "fulfilled" ? projectPathResult.value : null
        const steps = Array.isArray(lp?.steps) ? lp.steps : []
        const repoPathText = projectLearningPathsToText(nextProjectPaths)
        setProjectPaths(nextProjectPaths)
        setLearningPathText(`${learningPathStepsToText(steps)} ${repoPathText}`.trim())
        if (learningPathResult.status === "rejected" && projectPathResult.status === "rejected") {
          setPathError("Unable to load learning path data right now. Try recomputing insights or refreshing later.")
        } else if (projectPathResult.status === "rejected") {
          setPathError("Repo learning paths could not be loaded, so certificate suggestions are using your general learning path for now.")
        } else if (learningPathResult.status === "rejected") {
          setPathError("General learning path could not be loaded, so certificate suggestions are using repo learning paths for now.")
        }
      } catch {
        if (!cancelled) {
          setLearningPathText("")
          setProjectPaths(null)
          setPathError("Unable to load learning path data right now. Try recomputing insights or refreshing later.")
        }
      } finally {
        if (!cancelled) setPathLoading(false)
      }
    }
    void loadLearningPath()
    return () => {
      cancelled = true
    }
  }, [auth.username])

  useEffect(() => {
    if (!auth.username) {
      setBackendSuggestions([])
      return
    }
    let cancelled = false
    const loadCertificateSuggestions = async () => {
      try {
        const payload = await fetchCertificateSuggestions(auth.username)
        if (cancelled) return
        setBackendSuggestions(Array.isArray(payload.items) ? payload.items : [])
      } catch {
        if (!cancelled) setBackendSuggestions([])
      }
    }
    void loadCertificateSuggestions()
    return () => {
      cancelled = true
    }
  }, [auth.username])

  useEffect(() => {
    if (!auth.token) {
      setCareerTrackText("")
      return
    }
    let cancelled = false
    const loadCareerTrack = async () => {
      try {
        const portfolio = await fetchOwnerPortfolio(auth.token)
        if (cancelled) return
        const topCareer = portfolio?.career_suggestions?.[0]
        const focusDomain = portfolio?.focus_domain?.domain
        const text = [topCareer?.title, topCareer?.reasoning, focusDomain]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
        setCareerTrackText(text)
      } catch {
        if (!cancelled) setCareerTrackText("")
      }
    }
    void loadCareerTrack()
    return () => {
      cancelled = true
    }
  }, [auth.token])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(""), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!auth.username) return
    const nextTotal = rows.reduce((sum, row) => sum + getStudentCertificateNotificationCount(auth.username, row), 0)
    if (lastAdminNotificationTotalRef.current > 0 && nextTotal > lastAdminNotificationTotalRef.current) {
      setToast("New admin comment on your submitted credential. Open View submission to review it.")
    }
    lastAdminNotificationTotalRef.current = nextTotal
  }, [rows, auth.username])

  const counts = useMemo(() => {
    const visibleRows = rows.filter((item) => !item.hidden_from_student)
    const total = visibleRows.length
    const verified = visibleRows.filter((item) => (item.status || "").toLowerCase() === "verified").length
    const rejected = visibleRows.filter((item) => (item.status || "").toLowerCase() === "rejected").length
    return { total, verified, rejected, pending: Math.max(0, total - verified - rejected) }
  }, [rows])

  const visibleRows = useMemo(() => rows.filter((row) => !row.hidden_from_student), [rows])
  const submittedCredentialRows = useMemo(
    () =>
      visibleRows.filter((row) => {
        const belongsToSuggestedTrack = Boolean(String(row.suggestion_track_id || "").trim() || String(row.suggestion_module_url || "").trim())
        if (!belongsToSuggestedTrack) return true
        return Boolean(row.completion_locked)
      }),
    [visibleRows]
  )

  const suggestedCertificates = useMemo(() => {
    if (backendSuggestions.length > 0) return backendSuggestions

    const usedIds = new Set<string>()
    const usedTitles = new Set<string>()
    const usedPrimaryGroups = new Set<string>()
    const repoBasedSuggestions = (projectPaths?.projects || [])
      .map((project) => {
        const candidates = inferSuggestedCertificates(`${project.repo_name} ${learningPathStepsToText(project.steps || [])}`)
        const diverseCandidate = candidates.find((item) => {
          const titleKey = `${item.provider}:${item.title}`.toLowerCase()
          const primaryGroup = item.groups[0] || ""
          return !usedIds.has(item.id) && !usedTitles.has(titleKey) && (!primaryGroup || !usedPrimaryGroups.has(primaryGroup))
        }) || candidates.find((item) => {
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

    if (repoBasedSuggestions.length > 0) return repoBasedSuggestions.slice(0, DEFAULT_SUGGESTED_CERTIFICATE_LIMIT)

    if (careerTrackText) {
      return inferSuggestedCertificatesForCareer(learningPathText, careerTrackText)
    }
    return inferSuggestedCertificates(learningPathText)
  }, [backendSuggestions, learningPathText, careerTrackText, projectPaths])

  const trackedModules = useMemo(() => {
    return suggestedCertificates
  }, [suggestedCertificates])

  const detectedCertificateByTrack = useMemo(() => {
    const map = new Map<string, CertificateRecord>()
    for (const track of trackedModules) {
      const matched = matchCertificateToSuggestion(track, rows)
      if (matched) {
        map.set(track.id, matched)
      }
    }
    return map
  }, [rows, trackedModules])

  const detectedCertificatesByTrack = useMemo(() => {
    const map = new Map<string, CertificateRecord[]>()
    for (const track of trackedModules) {
      const matched = matchCertificatesToSuggestion(track, rows).sort(
        (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
      )
      if (matched.length) {
        map.set(track.id, matched)
      }
    }
    return map
  }, [rows, trackedModules])

  const trackerSummary = useMemo(() => {
    return summarizeSuggestionProgress(trackedModules, rows)
  }, [trackedModules, rows])

  function getSuggestionLocalStatus(itemId: string) {
    const tracked = trackedModules.find((item) => item.id === itemId)
    if (isSuggestionLocked(tracked)) {
      return "complete"
    }
    if (detectedCertificateByTrack.has(itemId)) {
      const matched = detectedCertificateByTrack.get(itemId)
      return matched?.completion_locked || String(matched?.status || "").trim().toLowerCase() === "verified" ? "complete" : "in-progress"
    }
    return suggestionProgress[itemId] || "not-started"
  }

  async function trackSuggestionStatus(item: { title: string; url: string }, actionType: "not_started" | "in_progress" | "completed") {
    if (!auth.token) return
    try {
      await trackRecommendationAction(auth.token, {
        module_title: item.title,
        module_url: item.url,
        action_type: actionType,
      })
    } catch {
      // Non-blocking analytics/tracking call.
    }
  }

  const markNotStarted = (item: { id: string; title: string; url: string }) => {
    if (isSuggestionLocked(trackedModules.find((entry) => entry.id === item.id))) return
    setSuggestionProgress((prev) => ({ ...prev, [item.id]: "not-started" }))
    void trackSuggestionStatus(item, "not_started")
  }

  const markInProgress = (item: { id: string; title: string; url: string }) => {
    if (isSuggestionLocked(trackedModules.find((entry) => entry.id === item.id))) return
    setSuggestionProgress((prev) => ({ ...prev, [item.id]: "in-progress" }))
    setSuggestionDrafts((prev) => ({
      ...prev,
      [item.id]: prev[item.id] || { proofLink: "", certificatePageUrl: "", comment: "" },
    }))
    setToast(`You can now add proof directly under "${item.title}".`)
    void trackSuggestionStatus(item, "in_progress")
  }

  const markComplete = async (item: { id: string; title: string; provider: string; url?: string; rewardXp?: number }) => {
    if (isSuggestionLocked(trackedModules.find((entry) => entry.id === item.id))) return
    // Prefill the submit area, but keep the final proof choice with the student.
    setTitle(item.title)
    setProvider(item.provider)
    setProofLink("")
    setCertificatePageUrl("")
    setSelectedSuggestionId(item.id)
    setSuggestionProgress((prev) => ({ ...prev, [item.id]: "complete" }))
    scrollToSubmit()
    setToast(`"${item.title}" marked complete. Submit your credential first, then you can claim the XP reward.`)
  }

  const scrollToSubmit = () => {
    const section = document.getElementById("certificate-submit")
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  const submitSuggestionProof = async (item: { id: string; title: string; provider: string; url: string }) => {
    if (!auth.token) return
    const draft = suggestionDrafts[item.id] || { proofLink: "", certificatePageUrl: "", comment: "" }
    const linkValue = draft.proofLink.trim()
    if (!linkValue) {
      setToast("Add a proof link before sending proof.")
      return
    }

    setSubmitting(true)
    try {
      const proofUrl = linkValue
      const created = await submitCertificate(auth.token, {
        title: item.title,
        provider: item.provider,
        proof_type: inferProofTypeFromUrl(proofUrl),
        certificate_url: proofUrl,
        certificate_page_url: draft.certificatePageUrl.trim() || undefined,
        student_note: draft.comment.trim() || undefined,
        suggestion_track_id: item.id,
        suggestion_module_url: item.url,
      })

      const inserted = normalizeSubmittedCertificate(created, {
        title: item.title,
        provider: item.provider,
        proofType: inferProofTypeFromUrl(proofUrl),
        proofLink: proofUrl,
        certificatePageUrl: draft.certificatePageUrl.trim() || null,
        studentNote: draft.comment.trim() || null,
        username: auth.username,
      })
      setRows((prev) => [inserted, ...prev.filter((row) => row.id !== inserted.id)])
      setSuggestionProgress((prev) => ({ ...prev, [item.id]: "in-progress" }))
      setSuggestionDrafts((prev) => ({
        ...prev,
        [item.id]: { proofLink: "", certificatePageUrl: "", comment: "" },
      }))
      setToast(`Progress proof submitted for "${item.title}".`)
    } catch {
      setToast("Failed to send proof for this credential.")
    } finally {
      setSubmitting(false)
    }
  }

  const openCertificateArchive = (
    row: CertificateRecord,
    entries?: CertificateRecord[],
    viewLabel: string = "Submission history",
    commentReadOnly: boolean = false
  ) => {
    const nextEntries = (entries && entries.length ? entries : [row]).slice()
    const prioritizedEntry =
      nextEntries.find((entry) => getStudentCertificateNotificationCount(auth.username, entry) > 0) || row
    setArchiveHasUnreadAdminNotice(getStudentCertificateNotificationCount(auth.username, prioritizedEntry) > 0)
    setArchiveViewLabel(viewLabel)
    setArchiveCommentReadOnly(commentReadOnly)
    setSelectedArchiveCertificate(prioritizedEntry)
    setSelectedArchiveEntries(nextEntries)
    setCertificateReply("")
    setExpandedCertificateProofUrl(null)
    markCertificateNotificationsSeen("student", auth.username, prioritizedEntry.id, getLatestStudentCertificateNotificationTimestamp(prioritizedEntry))
  }

  const submitCertificateReply = async () => {
    if (!auth.token || !selectedArchiveCertificate || !certificateReply.trim()) return
    setReplyingCertificateId(selectedArchiveCertificate.id)
    try {
      const updated = await replyCertificateComment(auth.token, {
        certificate_id: selectedArchiveCertificate.id,
        comment: certificateReply.trim(),
      })
      const normalized = normalizeSubmittedCertificate(updated, {
        title: selectedArchiveCertificate.title,
        provider: selectedArchiveCertificate.provider,
        proofType: selectedArchiveCertificate.proof_type,
        proofLink: selectedArchiveCertificate.certificate_url,
        certificatePageUrl: selectedArchiveCertificate.certificate_page_url || null,
        studentNote: selectedArchiveCertificate.student_note || null,
        username: auth.username,
      })
      replaceCertificateRecord(normalized)
      setCertificateReply("")
      setToast("Reply sent to admin comments.")
    } catch {
      setToast("Failed to send reply for this certificate proof.")
    } finally {
      setReplyingCertificateId(null)
    }
  }

  const clearCertificateComment = async () => {
    if (!auth.token || !selectedArchiveCertificate) return
    setDeletingCertificateProgressId(selectedArchiveCertificate.id)
    try {
      const updated = await deleteCertificateProgress(auth.token, {
        certificate_id: selectedArchiveCertificate.id,
        clear_comment: true,
      })
      const normalized = normalizeSubmittedCertificate(updated, {
        title: selectedArchiveCertificate.title,
        provider: selectedArchiveCertificate.provider,
        proofType: selectedArchiveCertificate.proof_type,
        proofLink: selectedArchiveCertificate.certificate_url,
        certificatePageUrl: selectedArchiveCertificate.certificate_page_url || null,
        studentNote: null,
        username: auth.username,
      })
      replaceCertificateRecord(normalized)
      setToast("Certificate progress comment deleted.")
    } catch {
      setToast("Failed to delete certificate progress comment.")
    } finally {
      setDeletingCertificateProgressId(null)
    }
  }

  const deleteCertificateReply = async (updatedAt?: string | null) => {
    if (!auth.token || !selectedArchiveCertificate || !updatedAt) return
    const deleteKey = `${selectedArchiveCertificate.id}::${updatedAt}`
    setDeletingCertificateReplyKey(deleteKey)
    try {
      const updated = await deleteMyCertificateCommentReply(auth.token, {
        certificate_id: selectedArchiveCertificate.id,
        updated_at: updatedAt,
      })
      const normalized = normalizeSubmittedCertificate(updated, {
        title: selectedArchiveCertificate.title,
        provider: selectedArchiveCertificate.provider,
        proofType: selectedArchiveCertificate.proof_type,
        proofLink: selectedArchiveCertificate.certificate_url,
        certificatePageUrl: selectedArchiveCertificate.certificate_page_url || null,
        studentNote: selectedArchiveCertificate.student_note || null,
        username: auth.username,
      })
      replaceCertificateRecord(normalized)
      setToast("Reply deleted.")
    } catch {
      setToast("Failed to delete this reply.")
    } finally {
      setDeletingCertificateReplyKey("")
    }
  }

  const deleteAllCertificateReplies = async () => {
    if (!auth.token || !selectedArchiveCertificate) return
    const deleteKey = `${selectedArchiveCertificate.id}::all`
    setDeletingCertificateReplyKey(deleteKey)
    try {
      const updated = await deleteMyCertificateCommentReply(auth.token, {
        certificate_id: selectedArchiveCertificate.id,
        delete_all: true,
      })
      const normalized = normalizeSubmittedCertificate(updated, {
        title: selectedArchiveCertificate.title,
        provider: selectedArchiveCertificate.provider,
        proofType: selectedArchiveCertificate.proof_type,
        proofLink: selectedArchiveCertificate.certificate_url,
        certificatePageUrl: selectedArchiveCertificate.certificate_page_url || null,
        studentNote: selectedArchiveCertificate.student_note || null,
        username: auth.username,
      })
      replaceCertificateRecord(normalized)
      setToast("All your replies were deleted.")
    } catch {
      setToast("Failed to delete your replies.")
    } finally {
      setDeletingCertificateReplyKey("")
    }
  }

  const deleteCertificateProof = async (targetCertificate?: CertificateRecord | null) => {
    if (!auth.token) return
    const certificate = targetCertificate || selectedArchiveCertificate
    if (!certificate) return
    setDeletingCertificateProgressId(certificate.id)
    try {
      const result = await deleteCertificateProgress(auth.token, {
        certificate_id: certificate.id,
        delete_proof: true,
      })
      if (result && typeof result === "object" && "id" in (result as Record<string, unknown>)) {
        const normalized = normalizeSubmittedCertificate(result, {
          title: certificate.title,
          provider: certificate.provider,
          proofType: certificate.proof_type,
          proofLink: certificate.certificate_url,
          certificatePageUrl: certificate.certificate_page_url || null,
          studentNote: certificate.student_note || null,
          username: auth.username,
        })
        replaceCertificateRecord(normalized)
        if (selectedArchiveCertificate?.id === certificate.id) {
          setSelectedArchiveCertificate(null)
          setSelectedArchiveEntries([])
          setArchiveHasUnreadAdminNotice(false)
        }
        setToast("Certificate removed from My Submitted Credentials, but its completed reward state stays saved.")
      } else {
        setRows((prev) => prev.filter((item) => item.id !== certificate.id))
        if (selectedArchiveCertificate?.id === certificate.id) {
          const remaining = selectedArchiveEntries.filter((item) => item.id !== certificate.id)
          setSelectedArchiveEntries(remaining)
          setSelectedArchiveCertificate(remaining[0] || null)
        }
        setToast("Certificate progress proof deleted.")
      }
    } catch {
      setToast("Failed to delete certificate progress proof.")
    } finally {
      setDeletingCertificateProgressId(null)
    }
  }

  if (!auth.token) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-[#DDE1EB] bg-white p-4 text-[13px] text-[#4B5368]">
          Sign in with GitHub first to manage your certificates.
        </div>
      </div>
    )
  }

  return (
    <motion.div {...containerMotion} className="mx-auto max-w-[1240px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      {toast ? (
        <div className="fixed right-5 top-5 z-50 rounded-[12px] border border-[#DDE1EB] bg-white px-4 py-2 text-[12px] text-[#2A3145]">
          {toast}
        </div>
      ) : null}

      <motion.section {...sectionMotion} className="relative overflow-hidden rounded-[26px] border border-[#dfe6fb] bg-[linear-gradient(135deg,#f2f6ff,#eef6ff_55%,#f8fbff)] p-6 shadow-[0_20px_40px_rgba(76,81,164,0.12)]">
        <div className="pointer-events-none absolute -right-6 top-6 h-24 w-24 rounded-full bg-[#c7d2fe] opacity-40 blur-2xl" />
        <div className="pointer-events-none absolute -left-8 bottom-0 h-20 w-20 rounded-full bg-[#bae6fd] opacity-40 blur-2xl" />
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#6D6AA6]">Certificate Hub</p>
            <h1 className="mt-2 text-[26px] font-semibold text-[#1E1A3C]">Submit and track learning credentials</h1>
            <p className="mt-1 text-[12px] text-[#6A6F88]">Upload certificate links, badge pages, or public achievement proof and keep your portfolio review-ready.</p>
          </div>
          <button
            type="button"
            className="rounded-full border border-[#cfd6ff] bg-white px-4 py-2 text-[11px] font-semibold text-[#3b3a70] shadow-sm"
            onClick={() => void load()}
          >
            {loading ? "Refreshing..." : "Refresh status"}
          </button>
        </div>
      </motion.section>

      <motion.section {...sectionMotion} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total", value: counts.total, tone: "bg-white/85" },
          { label: "Verified", value: counts.verified, tone: "bg-[#ecfdf3]" },
          { label: "Pending", value: counts.pending, tone: "bg-[#fff7ed]" },
          { label: "Rejected", value: counts.rejected, tone: "bg-[#fef2f2]" },
        ].map((card) => (
          <div key={card.label} className={`rounded-2xl border border-[#e1e6fb] ${card.tone} px-4 py-3 shadow-sm`}>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[#6D6AA6]">{card.label}</p>
            <p className="mt-2 text-[20px] font-semibold text-[#1E1A3C]">{card.value}</p>
          </div>
        ))}
      </motion.section>

      <motion.section {...sectionMotion} className="rounded-[18px] border border-[#dbeafe] bg-[linear-gradient(180deg,#f8fbff_0%,#f1f7ff_100%)] p-4 shadow-[0_16px_28px_rgba(63,66,120,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#3b82f6]">Need help?</p>
            <p className="mt-1 text-[12px] text-[#52667a]">Open the step-by-step guide if you want instructions before submitting.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowInstructions(true)}
            className="rounded-full border border-[#bfdbfe] bg-white px-4 py-2 text-[11px] font-semibold text-[#1d4ed8]"
          >
            View instructions
          </button>
        </div>
      </motion.section>

      <motion.section {...sectionMotion} id="certificate-submit" className="rounded-[22px] border border-[#e2e6fb] bg-white/85 p-5 shadow-[0_16px_28px_rgba(63,66,120,0.12)]">
        <h3 className="text-[15px] font-medium text-[#1E2538]">Submit Certificate or Learning Achievement</h3>
        <p className="mt-1 text-[12px] text-[#6A7288]">
          Submit your certificate info first, then add a shareable certification link and an optional viewable proof URL for image, PDF, or public page references.
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="rounded-[10px] border border-[#D6DCF2] bg-white px-3 py-2 text-[12px] outline-none"
            placeholder="Certificate or badge title"
          />
          <input
            value={provider}
            onChange={(event) => setProvider(event.target.value)}
            className="rounded-[10px] border border-[#D6DCF2] bg-white px-3 py-2 text-[12px] outline-none"
            placeholder="Provider (e.g. freeCodeCamp)"
          />
          <input
            value={proofLink}
            onChange={(event) => setProofLink(event.target.value)}
            className="rounded-[10px] border border-[#D6DCF2] bg-white px-3 py-2 text-[12px] outline-none"
            placeholder="Shareable certification link"
          />
          <div className="rounded-[10px] border border-[#D6DCF2] bg-white px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8a94ad]">Submission Type</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full border border-[#cfd6ff] bg-[#eef2ff] px-3 py-1 text-[11px] font-semibold text-[#4338CA]">
                Shareable Link Only
              </span>
            </div>
          </div>
          <input
            value={certificatePageUrl}
            onChange={(event) => setCertificatePageUrl(event.target.value)}
            className="rounded-[10px] border border-[#D6DCF2] bg-white px-3 py-2 text-[12px] outline-none"
            placeholder="Optional viewable proof URL (image, PDF, public page)"
          />
        </div>
        <p className="mt-2 text-[11px] text-[#6A7288]">
          Use a shareable certification link the admin can open directly. If you have a separate image, PDF, or public certificate page, paste it in the optional URL field.
        </p>

        <button
          type="button"
          disabled={submitting}
          onClick={async () => {
            if (!auth.token) return
            if (!title.trim() || !provider.trim() || !proofLink.trim()) {
              setToast("Title, provider, and shareable certification link are required.")
              return
            }
            setSubmitting(true)
            try {
              const titleValue = title.trim()
              const providerValue = provider.trim()
              const proofLinkValue = proofLink.trim()
              const certificatePageUrlValue = certificatePageUrl.trim()
              const matchedSuggestion = trackedModules.find((item) => item.id === selectedSuggestionId)
                || trackedModules.find((item) =>
                  item.title.trim().toLowerCase() === titleValue.toLowerCase()
                  || item.provider.trim().toLowerCase() === providerValue.toLowerCase()
                )
              const isSuggestedCompletion = Boolean(matchedSuggestion)
              const created = await submitCertificate(auth.token, {
                title: titleValue,
                provider: providerValue,
                proof_type: inferProofTypeFromUrl(proofLinkValue),
                certificate_url: proofLinkValue,
                certificate_page_url: certificatePageUrlValue || undefined,
                suggestion_track_id: matchedSuggestion?.id,
                suggestion_module_url: matchedSuggestion?.url,
                final_completion: isSuggestedCompletion,
                reward_xp: isSuggestedCompletion ? matchedSuggestion?.rewardXp || 0 : undefined,
              })

              if (matchedSuggestion) {
                setSuggestionProgress((prev) => ({ ...prev, [matchedSuggestion.id]: "complete" }))
                void trackSuggestionStatus({ title: matchedSuggestion.title, url: matchedSuggestion.url }, "completed")
              }

              const inserted = normalizeSubmittedCertificate(created, {
                title: titleValue,
                provider: providerValue,
                proofType: inferProofTypeFromUrl(proofLinkValue),
                proofLink: proofLinkValue,
                certificatePageUrl: certificatePageUrlValue || null,
                studentNote: null,
                username: auth.username,
              })
              setRows((prev) => [inserted, ...prev.filter((item) => item.id !== inserted.id)])
              setTitle("")
              setProvider("")
              setProofLink("")
              setCertificatePageUrl("")
              setSelectedSuggestionId("")
              setToast(
                isSuggestedCompletion
                  ? `Credential completed. ${matchedSuggestion?.rewardXp || 0} XP is ready to claim and this suggested track is now locked.`
                  : "Learning credential submitted."
              )
              void load()
            } catch (error) {
              setToast(error instanceof Error ? error.message : "Failed to submit learning credential.")
            } finally {
              setSubmitting(false)
            }
          }}
          className="mt-3 rounded-full bg-[#4f46e5] px-4 py-2 text-[11px] font-semibold text-white shadow-[0_12px_24px_rgba(79,70,229,0.28)] disabled:opacity-60"
        >
          {submitting ? "Submitting..." : "Submit credential to unlock claim"}
        </button>
      </motion.section>

      <motion.section {...sectionMotion} id="certificate-suggestions" className="rounded-[22px] border border-[#e2e6fb] bg-white/85 p-5 shadow-[0_16px_28px_rgba(63,66,120,0.12)]">
        <h3 className="text-[15px] font-medium text-[#1E2538]">Suggested Free Credentials (Learning-Path Based)</h3>
        <p className="mt-1 text-[12px] text-[#6A7288]">
          These free learning providers are collected from your repo learning paths, with duplicates removed and similar tracks reduced.
        </p>
        {pathLoading ? (
          <div className="mt-3 rounded-[10px] border border-[#d6dcef] bg-[#f8fafc] px-3 py-2 text-[12px] text-[#55607A]">
            Loading repo learning paths for certificate suggestions...
          </div>
        ) : null}
        {pathError ? (
          <div className="mt-3 rounded-[10px] border border-[#f3d29a] bg-[#fff8e6] px-3 py-2 text-[12px] text-[#8a5a00]">
            {pathError}
          </div>
        ) : null}
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#E1E6FB] bg-white px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[#6D6AA6]">Completed Progress</p>
            <p className="mt-2 text-[20px] font-semibold text-[#1E1A3C]">{trackerSummary.overall}%</p>
          </div>
          <div className="rounded-2xl border border-[#E1E6FB] bg-white px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[#6D6AA6]">Started / Completed</p>
            <p className="mt-2 text-[20px] font-semibold text-[#1E1A3C]">
              {trackerSummary.started}/{trackerSummary.completed}
            </p>
          </div>
          <div className="rounded-2xl border border-[#E1E6FB] bg-white px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[#6D6AA6]">Remaining Suggested Tracks</p>
            <p className="mt-2 text-[20px] font-semibold text-[#1E1A3C]">
              {trackerSummary.remaining}
            </p>
          </div>
        </div>
        {trackedModules.length === 0 ? (
          <p className="mt-3 text-[12px] text-[#6A7288]">
            {pathLoading
              ? "Preparing personalized credential suggestions..."
              : "No personalized credential suggestions yet. Add GitHub activity and recompute your learning path first."}
          </p>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {trackedModules.map((item) => {
              const matchedCertificate = detectedCertificateByTrack.get(item.id)
              const draft = suggestionDrafts[item.id] || { proofLink: "", certificatePageUrl: "", comment: "" }
              const localStatus = getSuggestionLocalStatus(item.id)
              const displayTitle = matchedCertificate?.title || item.title
              const displayProvider = matchedCertificate?.provider || item.provider
              const matchedCertificateStatus = String(matchedCertificate?.status || "").trim().toLowerCase()
              const effectiveStatus = matchedCertificate
                ? matchedCertificateStatus === "verified" || localStatus === "complete"
                  ? "complete"
                  : "in-progress"
                : localStatus
              const badgeClass =
                effectiveStatus === "complete"
                  ? "bg-[#E8F4F0] text-[#0F6E56]"
                  : effectiveStatus === "in-progress"
                    ? "bg-[#FFF4E8] text-[#BA7517]"
                    : "bg-[#F3F4F6] text-[#55607A]"
              const badgeLabel =
                effectiveStatus === "complete"
                  ? "Complete"
                  : effectiveStatus === "in-progress"
                    ? "In progress"
                    : "Not started"
              const archiveRows = detectedCertificatesByTrack.get(item.id) || []
              const archiveRow = archiveRows[0] || matchedCertificate || null
              const finalArchiveRows = archiveRows.filter((row) => Boolean(row.completion_locked))
              const progressArchiveRows = archiveRows.filter((row) => !row.completion_locked)
              const latestFinalArchiveRow = finalArchiveRows[0] || (matchedCertificate?.completion_locked ? matchedCertificate : null)
              const latestProgressArchiveRow = progressArchiveRows[0] || null
              const isLocked = Boolean(isSuggestionLocked(item) || matchedCertificate?.completion_locked)
              const isReadyToSubmit = !matchedCertificate && (selectedSuggestionId === item.id || localStatus === "complete")
              const unreadAdminComments = archiveRows.length
                ? archiveRows.reduce((sum, row) => sum + getStudentCertificateNotificationCount(auth.username, row), 0)
                : archiveRow
                  ? getStudentCertificateNotificationCount(auth.username, archiveRow)
                  : 0
              const unreadFinalAdminComments = finalArchiveRows.reduce(
                (sum, row) => sum + getStudentCertificateNotificationCount(auth.username, row),
                0
              )
              const unreadProgressAdminComments = progressArchiveRows.reduce(
                (sum, row) => sum + getStudentCertificateNotificationCount(auth.username, row),
                0
              )
              const showInProgressPanel = effectiveStatus === "in-progress" && !isLocked
              return (
              <div
                key={item.id}
                className={`rounded-[14px] border bg-white/80 p-3 shadow-sm ${
                  unreadAdminComments > 0 ? "border-[#f3b1b1] bg-[#fff8f8]" : "border-[#E1E6FB]"
                }`}
              >
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.9fr)] xl:items-start">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13px] font-medium text-[#1E2538]">{displayTitle}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${badgeClass}`}>
                        {badgeLabel}
                      </span>
                      {unreadAdminComments > 0 ? (
                        <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-[#ef4444] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                          {unreadAdminComments > 99 ? "99+" : unreadAdminComments}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[11px] text-[#6A7288]">{displayProvider}</p>
                    {matchedCertificate ? (
                      <p className="mt-2 text-[11px] text-[#55607a]">
                        {effectiveStatus === "complete"
                          ? `Completed certificate submitted on ${formatDateTime(matchedCertificate.submitted_at)}. ${
                              canClaimCertificateReward(matchedCertificate)
                                ? `${matchedCertificate.completion_reward_xp || 0} XP is ready to claim and this track is now locked.`
                                : matchedCertificate.rewarded_at
                                  ? `${matchedCertificate.completion_reward_xp || 0} XP was claimed and this track is now locked.`
                                  : "This track is now locked while waiting for admin review."
                            }`
                          : `In-progress update posted on ${formatDateTime(matchedCertificate.submitted_at)} for this suggested provider.`}
                      </p>
                    ) : (
                      <p className="mt-2 text-[11px] text-[#55607a]">
                        {isReadyToSubmit
                          ? "You marked this credential as complete. Submit your credential proof first before claiming the XP reward."
                          : item.reasoning}
                      </p>
                    )}
                    {effectiveStatus === "complete" && latestProgressArchiveRow ? (
                      <p className="text-[11px] text-[#6A7288]">
                        Your earlier in-progress updates are still saved separately, so you can review them anytime without mixing them with the final submission.
                      </p>
                    ) : null}
                    <p className="text-[11px] font-semibold text-[#4338CA]">High-effort reward: {item.rewardXp} XP</p>
                  </div>
                  <div className="flex flex-col gap-2 xl:items-end">
                    <span className="rounded-full bg-[#EEF2FF] px-3 py-1 text-[11px] font-semibold text-[#4338CA]">
                      {item.rewardXp} XP
                    </span>
                    <div className="flex flex-wrap gap-2 xl:justify-end">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-[#D1D6E3] px-3 py-1 text-[11px] text-[#2E3550]"
                      >
                        Open
                      </a>
                      {matchedCertificate ? (
                        <a
                          href={matchedCertificate.certificate_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-[#C9E7DD] bg-white px-3 py-1 text-[11px] text-[#0F6E56]"
                        >
                          View Submitted Proof
                        </a>
                      ) : null}
                      {latestFinalArchiveRow && !showInProgressPanel ? (
                        <button
                          type="button"
                          onClick={() => openCertificateArchive(latestFinalArchiveRow, finalArchiveRows, "Final submission history")}
                          className="rounded-full border border-[#cfd6ff] bg-white px-3 py-1 text-[11px] text-[#3b3a70]"
                        >
                          View submission{unreadFinalAdminComments > 0 ? ` (${unreadFinalAdminComments})` : ""}
                        </button>
                      ) : null}
                      {effectiveStatus === "complete" && latestProgressArchiveRow ? (
                        <button
                          type="button"
                          onClick={() => openCertificateArchive(latestProgressArchiveRow, progressArchiveRows, "In-progress proof history", true)}
                          className="rounded-full border border-[#f4ddbf] bg-white px-3 py-1 text-[11px] text-[#9a6700]"
                        >
                          View in progress{unreadProgressAdminComments > 0 ? ` (${unreadProgressAdminComments})` : ""}
                        </button>
                      ) : null}
                      {!isLocked && isReadyToSubmit ? (
                        <button
                          type="button"
                          className="rounded-full bg-[#4338CA] px-3 py-1 text-[11px] font-semibold text-white"
                          onClick={() => {
                            setTitle(displayTitle)
                            setProvider(displayProvider)
                            setSelectedSuggestionId(item.id)
                            scrollToSubmit()
                          }}
                        >
                          Submit credential
                        </button>
                      ) : !isLocked ? (
                        <button
                          type="button"
                          className="rounded-full bg-[#4f46e5] px-3 py-1 text-[11px] text-white"
                          onClick={() => {
                              setTitle(displayTitle)
                              setProvider(displayProvider)
                              setSelectedSuggestionId(item.id)
                          }}
                        >
                          Use this
                        </button>
                      ) : archiveRow && canClaimCertificateReward(archiveRow) ? (
                        <button
                          type="button"
                          disabled={claimingCertificateId === archiveRow.id}
                          onClick={() => void claimReward(archiveRow)}
                          className="rounded-full bg-[#0F6E56] px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
                        >
                          {claimingCertificateId === archiveRow.id ? "Claiming..." : `Claim ${archiveRow.completion_reward_xp || 0} XP`}
                        </button>
                      ) : (
                        <span className="rounded-full border border-[#C9E7DD] bg-[#f4fbf7] px-3 py-1 text-[11px] font-semibold text-[#0F6E56]">
                          {archiveRow?.rewarded_at ? "Completed and reward claimed" : "Completed and locked"}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                      <button
                        type="button"
                        className={`rounded-full border px-2 py-1 text-[10px] ${getSuggestionLocalStatus(item.id) === 'not-started' ? 'bg-[#eef2ff] text-[#4338CA]' : 'bg-white text-[#2E3550]'}`}
                        onClick={() => markNotStarted(item)}
                        disabled={isLocked}
                      >
                        Not started
                      </button>
                      <button
                        type="button"
                        className={`rounded-full border px-2 py-1 text-[10px] ${getSuggestionLocalStatus(item.id) === 'in-progress' ? 'bg-[#fff7ed] text-[#BA7517]' : 'bg-white text-[#2E3550]'}`}
                        onClick={() => markInProgress(item)}
                        disabled={isLocked}
                      >
                        In progress
                      </button>
                      <button
                        type="button"
                        className={`rounded-full border px-2 py-1 text-[10px] ${getSuggestionLocalStatus(item.id) === 'complete' ? 'bg-[#E8F4F0] text-[#0F6E56]' : 'bg-white text-[#2E3550]'}`}
                        onClick={() => void markComplete(item)}
                        disabled={submitting || isLocked}
                      >
                        Complete
                      </button>
                    </div>
                  </div>
                </div>
                {showInProgressPanel ? (
                  <div className="mt-3 rounded-[12px] border border-[#E1E6FB] bg-[#f8faff] p-3">
                    <div className="grid gap-3 xl:grid-cols-[minmax(220px,0.85fr)_minmax(0,1.4fr)] xl:items-start">
                      <div className={`rounded-[12px] border px-3 py-3 ${unreadAdminComments > 0 ? "border-[#f3b1b1] bg-[#fff5f5]" : "border-[#E1E6FB] bg-white"}`}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6D6AA6]">Progress Proof Archive</p>
                            <p className="mt-1 text-[11px] text-[#6A7288]">
                              Every posted progress proof is kept here for admin review. You can still delete it until it is verified.
                            </p>
                          </div>
                          {archiveRow ? (
                            <button
                              type="button"
                              onClick={() => openCertificateArchive(archiveRow, archiveRows, "In-progress proof history", false)}
                              className="rounded-full border border-[#cfd6ff] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#3b3a70]"
                            >
                              View in progress{unreadAdminComments > 0 ? ` (${unreadAdminComments})` : ""}
                            </button>
                          ) : null}
                        </div>
                        {archiveRow ? (
                          <div className="mt-3">
                            <span className="inline-flex rounded-full border border-[#D6DCF2] bg-white px-3 py-1 text-[11px] text-[#55607A]">
                              {formatDateTime(archiveRow.submitted_at)}
                            </span>
                          </div>
                        ) : null}
                      </div>

                      <div className="rounded-[12px] border border-dashed border-[#D6DCF2] bg-[#fbfcff] p-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6D6AA6]">What are you working on now?</p>
                          <textarea
                            value={draft.comment}
                            onChange={(event) =>
                              setSuggestionDrafts((prev) => ({
                                ...prev,
                                [item.id]: { ...draft, comment: event.target.value },
                              }))
                            }
                            rows={4}
                            className="mt-2 w-full min-w-0 rounded-[10px] border border-[#D6DCF2] bg-white px-3 py-2 text-[12px] outline-none"
                            placeholder="Example: I finished the login flow, added screenshots, and I am now testing the certificate proof."
                          />
                          <input
                            value={draft.proofLink}
                            onChange={(event) =>
                              setSuggestionDrafts((prev) => ({
                                ...prev,
                                [item.id]: { ...draft, proofLink: event.target.value },
                              }))
                            }
                            className="mt-2 w-full min-w-0 rounded-[10px] border border-[#D6DCF2] bg-white px-3 py-2 text-[12px] outline-none"
                            placeholder="Paste a shareable certification link"
                          />
                          <input
                            value={draft.certificatePageUrl}
                            onChange={(event) =>
                              setSuggestionDrafts((prev) => ({
                                ...prev,
                                [item.id]: { ...draft, certificatePageUrl: event.target.value },
                              }))
                            }
                            className="mt-2 w-full min-w-0 rounded-[10px] border border-[#D6DCF2] bg-white px-3 py-2 text-[12px] outline-none"
                            placeholder="Optional viewable proof URL (image, PDF, page)"
                          />
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={submitting || (!draft.comment.trim() && !draft.proofLink.trim())}
                              onClick={() => void submitSuggestionProof(item)}
                              className="rounded-full border border-[#cfd6ff] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#3b3a70] shadow-sm disabled:opacity-60"
                            >
                              {submitting ? "Posting..." : "Post update"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )})}
          </div>
        )}
      </motion.section>

      <motion.section {...sectionMotion} id="certificate-submissions" className="rounded-[22px] border border-[#e2e6fb] bg-white/85 p-5 shadow-[0_16px_28px_rgba(63,66,120,0.12)]">
        <h3 className="text-[15px] font-medium text-[#1E2538]">My Submitted Credentials</h3>
        {!loading && submittedCredentialRows.length === 0 ? (
          <div className="mt-3 rounded-[14px] border border-dashed border-[#D7DEF4] bg-[#f8f9ff] p-4 text-[12px] text-[#5A6380]">
            <p className="text-[12px] font-semibold text-[#2A3145]">No credential submissions yet.</p>
            <p className="mt-1 text-[#6A7288]">Only final credential submissions appear here. In-progress proofs stay under the credential card's `View in progress` history.</p>
            <button
              type="button"
              onClick={scrollToSubmit}
              className="mt-3 inline-flex items-center rounded-full border border-[#cfd6ff] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#3b3a70]"
            >
              Go to submit form
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {submittedCredentialRows.map((row) => {
              const meta = statusMeta(row.status)
              const unreadAdminComments = getStudentCertificateNotificationCount(auth.username, row)
              return (
                <article key={row.id} className="rounded-[18px] border border-[#E4E8F2] bg-[#fbfcff] p-4 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-[15px] font-semibold text-[#1E2538]">{row.title}</h4>
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] ${meta.className}`}>{meta.label}</span>
                        {unreadAdminComments > 0 ? (
                          <span className="rounded-full bg-[#fff1f1] px-2.5 py-0.5 text-[10px] font-semibold text-[#d14343]">
                            New admin comment
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[12px] text-[#66708A]">{row.provider}</p>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8a94ad]">Submission Type</p>
                          <p className="mt-1 text-[12px] text-[#2A3145]">
                            {String(row.proof_type || "").trim().toLowerCase() === "certificate link" ? "Shareable Certificate Link" : row.proof_type || "Proof File"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8a94ad]">Submitted</p>
                          <p className="mt-1 text-[12px] text-[#2A3145]">{formatDateTime(row.submitted_at)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8a94ad]">
                            {String(row.proof_type || "").trim().toLowerCase() === "certificate link" ? "Certificate Link" : "Proof File"}
                          </p>
                          <a href={row.certificate_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex text-[12px] font-medium text-[#4338CA] underline-offset-2 hover:underline">
                            {certificatePrimaryActionLabel(row)}
                          </a>
                        </div>
                      </div>

                      {unreadAdminComments > 0 ? (
                        <div className="mt-3 rounded-[14px] border border-[#f3b1b1] bg-[#fff8f8] px-3 py-3">
                          <p className="text-[11px] font-semibold text-[#d14343]">
                            Admin left a new comment on this submission.
                          </p>
                          <p className="mt-1 text-[12px] text-[#8c4a4a]">
                            Open `View submission` to read the comment and reply.
                          </p>
                        </div>
                      ) : null}

                    </div>

                    <div className="flex w-full shrink-0 flex-col gap-2 lg:w-[168px]">
                      <button
                        type="button"
                        onClick={() => openCertificateArchive(row)}
                        className="rounded-full border border-[#cfd6ff] bg-white px-3 py-2 text-[11px] font-semibold text-[#3b3a70]"
                      >
                        View submission{unreadAdminComments > 0 ? ` (${unreadAdminComments})` : ""}
                      </button>
                      {canClaimCertificateReward(row) ? (
                        <button
                          type="button"
                          disabled={claimingCertificateId === row.id}
                          onClick={() => void claimReward(row)}
                          className="rounded-full bg-[#0F6E56] px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-60"
                        >
                          {claimingCertificateId === row.id ? "Claiming..." : `Claim ${row.completion_reward_xp || 0} XP`}
                        </button>
                      ) : null}
                      {canDeleteCertificate(row) ? (
                        <button
                          type="button"
                          disabled={deletingCertificateProgressId === row.id}
                          onClick={() => {
                            void deleteCertificateProof(row)
                          }}
                          className="rounded-full border border-[#f2b8b8] bg-white px-3 py-2 text-[11px] font-semibold text-[#c24141] disabled:opacity-60"
                        >
                          {deletingCertificateProgressId === row.id ? "Deleting..." : "Delete"}
                        </button>
                      ) : (
                        <div className="rounded-[14px] border border-[#e3e7f2] bg-white px-3 py-2 text-[11px] text-[#8a94ad]">
                          {row.rewarded_at
                            ? "Reward already claimed"
                            : row.completion_locked
                              ? "Locked after completion"
                              : "Locked after verification"}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </motion.section>

      {selectedArchiveCertificate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1f2440]/35 px-4 py-6">
          <div className="w-full max-w-5xl overflow-hidden rounded-[24px] border border-[#f2caca] bg-[#fff8f8] shadow-[0_22px_44px_rgba(73,37,37,0.16)]">
            {archiveHasUnreadAdminNotice ? (
              <div className="border-b border-[#f3b1b1] bg-[#fff1f1] px-5 py-3">
                <p className="text-[12px] font-semibold text-[#d14343]">
                  New admin comment on this submission. Review the comment thread below.
                </p>
              </div>
            ) : null}
            <div className="flex items-start justify-between gap-3 border-b border-[#f0d7d7] px-5 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b45454]">{archiveViewLabel}</p>
                <h3 className="mt-2 text-[24px] font-semibold text-[#7b2424]">{selectedArchiveCertificate.title}</h3>
                <p className="mt-1 text-[12px] text-[#b45454]">
                  {selectedArchiveCertificate.provider} - {formatDateTime(selectedArchiveCertificate.submitted_at)}
                </p>
                {canClaimCertificateReward(selectedArchiveCertificate) ? (
                  <button
                    type="button"
                    disabled={claimingCertificateId === selectedArchiveCertificate.id}
                    onClick={() => void claimReward(selectedArchiveCertificate)}
                    className="mt-3 rounded-full bg-[#0F6E56] px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60"
                  >
                    {claimingCertificateId === selectedArchiveCertificate.id
                      ? "Claiming..."
                      : `Claim ${selectedArchiveCertificate.completion_reward_xp || 0} XP`}
                  </button>
                ) : selectedArchiveCertificate.rewarded_at ? (
                  <div className="mt-3 inline-flex rounded-full border border-[#C9E7DD] bg-[#f4fbf7] px-3 py-1 text-[11px] font-semibold text-[#0F6E56]">
                    Reward claimed on {formatDateTime(selectedArchiveCertificate.rewarded_at)}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedArchiveCertificate(null)
                  setSelectedArchiveEntries([])
                  setArchiveHasUnreadAdminNotice(false)
                  setArchiveViewLabel("Submission history")
                  setArchiveCommentReadOnly(false)
                }}
                className="rounded-full border border-[#f0b8b8] bg-white px-3 py-1 text-[11px] font-semibold text-[#b45454]"
              >
                Close
              </button>
            </div>

            <div className="grid gap-0 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.85fr)]">
              <div className="border-b border-[#f0d7d7] p-5 lg:border-b-0 lg:border-r">
                {selectedArchiveEntries.length > 1 ? (
                  <div className="mb-4 rounded-[18px] border border-[#eedede] bg-white p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8a94ad]">Posted updates</p>
                    <div className="mt-3 max-h-[180px] space-y-2 overflow-y-auto pr-1">
                      {selectedArchiveEntries.map((entry, index) => {
                        const active = entry.id === selectedArchiveCertificate.id
                        const unreadAdminComments = getStudentCertificateNotificationCount(auth.username, entry)
                        return (
                          <button
                            key={`${entry.id}-${index}`}
                            type="button"
                            onClick={() => {
                              setSelectedArchiveCertificate(entry)
                              setArchiveHasUnreadAdminNotice(getStudentCertificateNotificationCount(auth.username, entry) > 0)
                              setExpandedCertificateProofUrl(null)
                              markCertificateNotificationsSeen("student", auth.username, entry.id, getLatestStudentCertificateNotificationTimestamp(entry))
                            }}
                            className={`w-full rounded-[12px] border px-3 py-2 text-left ${
                              active
                                ? "border-[#1f1f1f] bg-[#fff5f5]"
                                : unreadAdminComments > 0
                                  ? "border-[#f3b1b1] bg-[#fff8f8]"
                                  : "border-[#e5e7eb] bg-white"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-[12px] font-semibold text-[#2A3145]">{certificateProofLabel(entry)}</p>
                                {unreadAdminComments > 0 ? (
                                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#d14343]">
                                    New admin comment
                                  </p>
                                ) : null}
                              </div>
                              {unreadAdminComments > 0 ? (
                                <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#ef4444] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                                  {unreadAdminComments > 99 ? "99+" : unreadAdminComments}
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

                <div className="flex flex-wrap items-start justify-between gap-3 rounded-[18px] border border-[#eedede] bg-white p-4">
                  <div>
                    <p className="text-[16px] font-semibold text-[#2A3145]">{certificateProofLabel(selectedArchiveCertificate)}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8a94ad]">Submitted proof</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={selectedArchiveCertificate.certificate_url}
                      onClick={(event) => {
                        event.preventDefault()
                        if (!canInlineCertificateProof(selectedArchiveCertificate) || certificateProofKind(selectedArchiveCertificate) === "pdf") {
                          window.open(selectedArchiveCertificate.certificate_url, "_blank", "noopener,noreferrer")
                          return
                        }
                        setExpandedCertificateProofUrl(selectedArchiveCertificate.certificate_url)
                      }}
                      className="rounded-full border border-[#cfd6ff] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#3b3a70]"
                    >
                      View
                    </a>
                    {canDeleteCertificate(selectedArchiveCertificate) && !archiveCommentReadOnly ? (
                      <button
                        type="button"
                        disabled={deletingCertificateProgressId === selectedArchiveCertificate.id}
                        onClick={() => void deleteCertificateProof()}
                        className="rounded-full border border-[#f2b8b8] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#c24141] disabled:opacity-60"
                      >
                        {deletingCertificateProgressId === selectedArchiveCertificate.id ? "Deleting..." : "Delete"}
                      </button>
                    ) : null}
                    {selectedArchiveCertificate.certificate_page_url ? (
                      <a
                        href={selectedArchiveCertificate.certificate_page_url}
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
                    if (!canInlineCertificateProof(selectedArchiveCertificate) || certificateProofKind(selectedArchiveCertificate) === "pdf") {
                      window.open(selectedArchiveCertificate.certificate_url, "_blank", "noopener,noreferrer")
                      return
                    }
                    setExpandedCertificateProofUrl(selectedArchiveCertificate.certificate_url)
                  }}
                  className="mt-4 block overflow-hidden rounded-[18px] border border-[#eedede] bg-white"
                >
                  {certificateProofKind(selectedArchiveCertificate) === "image" ? (
                    <img
                      src={selectedArchiveCertificate.certificate_url}
                      alt={certificateProofLabel(selectedArchiveCertificate)}
                      className="h-[260px] w-full object-cover"
                    />
                  ) : certificateProofKind(selectedArchiveCertificate) === "video" ? (
                    <video
                      src={selectedArchiveCertificate.certificate_url}
                      muted
                      playsInline
                      controls
                      className="h-[260px] w-full bg-black object-contain"
                    />
                  ) : certificateProofKind(selectedArchiveCertificate) === "pdf" ? (
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
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b45454]">Student Comment</p>
                    {selectedArchiveCertificate.student_note && !archiveCommentReadOnly ? (
                      <button
                        type="button"
                        disabled={deletingCertificateProgressId === selectedArchiveCertificate.id}
                        onClick={() => void clearCertificateComment()}
                        className="rounded-full border border-[#f2b8b8] bg-white px-3 py-1 text-[11px] font-semibold text-[#c24141] disabled:opacity-60"
                      >
                        {deletingCertificateProgressId === selectedArchiveCertificate.id ? "Deleting..." : "Delete comment"}
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-2 text-[13px] text-[#2A3145]">{selectedArchiveCertificate.student_note || "No student comment added for this proof."}</p>
                </div>
              </div>

              <div className="p-5 md:flex md:min-h-[520px] md:flex-col md:gap-3">
                <div className="rounded-[14px] border border-[#e5e7eb] bg-[#fcfdff] p-3 md:flex md:min-h-0 md:flex-1 md:flex-col">
                  <div className="flex shrink-0 items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8a94ad]">Comment Thread</p>
                    <div className="flex items-center gap-2">
                      {!archiveCommentReadOnly && (selectedArchiveCertificate.comment_thread || []).some(
                        (entry) => entry.role === "student" && entry.by === auth.username
                      ) ? (
                        <button
                          type="button"
                          disabled={deletingCertificateReplyKey === `${selectedArchiveCertificate.id}::all`}
                          onClick={() => void deleteAllCertificateReplies()}
                          className="rounded-full border border-[#dbeafe] bg-white px-3 py-1 text-[10px] font-semibold text-[#1d4ed8] disabled:opacity-60"
                        >
                          {deletingCertificateReplyKey === `${selectedArchiveCertificate.id}::all` ? "Deleting..." : "Delete all replies"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 max-h-[340px] space-y-3 overflow-y-auto pr-1 md:min-h-0 md:flex-1">
                  {(selectedArchiveCertificate.comment_thread || []).length ? (
                    (selectedArchiveCertificate.comment_thread || []).map((entry, index) => (
                      <div
                        key={`${entry.role}-${entry.updated_at || index}`}
                        className={`rounded-[14px] border px-3 py-3 ${entry.role === "admin" ? "border-[#f2caca] bg-[#fff7f7]" : "border-[#d9e2ff] bg-[#f7f9ff]"}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[13px] text-[#2A3145]">{entry.comment}</p>
                          {!archiveCommentReadOnly && entry.role === "student" && entry.by === auth.username && entry.updated_at ? (
                            <button
                              type="button"
                              disabled={deletingCertificateReplyKey === `${selectedArchiveCertificate.id}::${entry.updated_at}`}
                              onClick={() => void deleteCertificateReply(entry.updated_at)}
                              className="shrink-0 rounded-full border border-[#dbeafe] bg-white px-2 py-1 text-[10px] font-semibold text-[#1d4ed8] disabled:opacity-60"
                            >
                              {deletingCertificateReplyKey === `${selectedArchiveCertificate.id}::${entry.updated_at}` ? "Deleting..." : "Delete"}
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

                {archiveCommentReadOnly ? (
                  <div className="shrink-0 rounded-[18px] border border-[#eedede] bg-white p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8a94ad]">Read-only History</p>
                    <p className="mt-2 text-[12px] text-[#6A7288]">
                      This completed credential keeps your past in-progress comment thread for reference only. New replies are disabled here.
                    </p>
                  </div>
                ) : (
                  <div className="shrink-0 rounded-[18px] border border-[#d9e2ff] bg-white p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6D6AA6]">Write Comment</p>
                    <textarea
                      value={certificateReply}
                      onChange={(event) => setCertificateReply(event.target.value)}
                      rows={4}
                      className="mt-3 w-full rounded-[14px] border border-[#d6dcf2] px-3 py-2 text-[12px] outline-none"
                      placeholder="Type comment for this proof."
                    />
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        disabled={replyingCertificateId === selectedArchiveCertificate.id || !certificateReply.trim()}
                        onClick={() => void submitCertificateReply()}
                        className="rounded-full bg-[#4338CA] px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60"
                      >
                        {replyingCertificateId === selectedArchiveCertificate.id ? "Saving..." : "Save comment"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {expandedCertificateProofUrl && selectedArchiveCertificate ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="w-full max-w-6xl overflow-hidden rounded-[20px] bg-white shadow-[0_22px_44px_rgba(0,0,0,0.25)]">
            <div className="flex items-center justify-between border-b border-[#e5e7eb] px-4 py-3">
              <p className="text-[13px] font-semibold text-[#1f2937]">{certificateProofLabel(selectedArchiveCertificate)}</p>
              <button
                type="button"
                onClick={() => setExpandedCertificateProofUrl(null)}
                className="rounded-full border border-[#d1d5db] bg-white px-3 py-1 text-[11px] font-semibold text-[#374151]"
              >
                Close
              </button>
            </div>
            <div className="flex max-h-[80vh] items-center justify-center bg-[#f8fafc] p-4">
              {certificateProofKind(selectedArchiveCertificate) === "image" ? (
                <img
                  src={expandedCertificateProofUrl}
                  alt={certificateProofLabel(selectedArchiveCertificate)}
                  className="max-h-[72vh] w-auto max-w-full object-contain"
                />
              ) : certificateProofKind(selectedArchiveCertificate) === "video" ? (
                <video
                  src={expandedCertificateProofUrl}
                  controls
                  autoPlay
                  className="max-h-[72vh] w-auto max-w-full bg-black"
                />
              ) : (
                <iframe
                  src={expandedCertificateProofUrl}
                  title={certificateProofLabel(selectedArchiveCertificate)}
                  className="h-[72vh] w-full rounded-[12px] bg-white"
                />
              )}
            </div>
          </div>
        </div>
      ) : null}

      {showInstructions ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0f172a]/60 px-4 py-6">
          <div className="w-full max-w-3xl overflow-hidden rounded-[24px] border border-[#dbeafe] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
            <div className="flex items-start justify-between gap-3 border-b border-[#e5e7eb] bg-[#f8fbff] px-5 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#3b82f6]">Certificate Instructions</p>
                <h3 className="mt-1 text-[22px] font-semibold text-[#1E1A3C]">How to use this certificate page</h3>
                <p className="mt-1 text-[12px] text-[#52667a]">Follow these steps if you are submitting certificate or achievement proof for review.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowInstructions(false)}
                className="rounded-full border border-[#d7dee8] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#344054]"
              >
                Close
              </button>
            </div>
            <div className="space-y-4 px-5 py-5">
              <div className="rounded-[16px] border border-[#dbeafe] bg-[#f8fbff] p-4">
                <p className="text-[13px] font-semibold text-[#1E2538]">Step 1. Pick a suggested credential</p>
                <p className="mt-2 text-[13px] leading-6 text-[#52667a]">
                  Start with the suggested credentials because they match your learning path. These are the easiest ones to submit first if you want progress that is aligned with your current projects.
                </p>
                <p className="mt-2 text-[13px] leading-6 text-[#52667a]">
                  This part is manual. You choose which credential to work on. The system only suggests which certificates fit your learning path, but you still decide what to submit.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowInstructions(false)
                    scrollToSection("certificate-suggestions")
                  }}
                  className="mt-3 rounded-full border border-[#bfdbfe] bg-white px-4 py-2 text-[11px] font-semibold text-[#1d4ed8]"
                >
                  Open suggested credentials
                </button>
              </div>
              <div className="rounded-[16px] border border-[#dbeafe] bg-[#f8fbff] p-4">
                <p className="text-[13px] font-semibold text-[#1E2538]">Step 2. Submit your certificate or proof</p>
                <p className="mt-2 text-[13px] leading-6 text-[#52667a]">
                  Go to the submit form, type the title and provider, then paste one shareable proof link that the admin can open directly.
                </p>
                <p className="mt-2 text-[13px] leading-6 text-[#52667a]">
                  If you do not have a public certificate page yet, use a Google Drive, YouTube unlisted, or Cloudinary link. What matters is that the admin can review something clear and readable.
                </p>
                <p className="mt-2 text-[13px] leading-6 text-[#52667a]">
                  The system saves your submission and puts it in your submission history. If the credential matches a suggested track, it can also be connected to your learning-path reward progress.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowInstructions(false)
                    scrollToSection("certificate-submit")
                  }}
                  className="mt-3 rounded-full border border-[#bfdbfe] bg-white px-4 py-2 text-[11px] font-semibold text-[#1d4ed8]"
                >
                  Go to submit form
                </button>
              </div>
              <div className="rounded-[16px] border border-[#dbeafe] bg-[#f8fbff] p-4">
                <p className="text-[13px] font-semibold text-[#1E2538]">Step 3. Check admin feedback and claim reward</p>
                <p className="mt-2 text-[13px] leading-6 text-[#52667a]">
                  After you submit, wait for admin review. Open your submissions to read comments, reply if they ask for changes, and claim XP only after the credential is accepted.
                </p>
                <p className="mt-2 text-[13px] leading-6 text-[#52667a]">
                  If you see a notification badge, open your submission history because that usually means the admin commented on your proof. Read the message first, then reply if you need to explain or update something.
                </p>
                <p className="mt-2 text-[13px] leading-6 text-[#52667a]">
                  In short: pick a credential manually, submit proof manually, wait for review, check comments, then claim the reward only when the system shows that your credential was accepted.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowInstructions(false)
                    scrollToSection("certificate-submissions")
                  }}
                  className="mt-3 rounded-full border border-[#bfdbfe] bg-white px-4 py-2 text-[11px] font-semibold text-[#1d4ed8]"
                >
                  View my submissions
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </motion.div>
  )
}
