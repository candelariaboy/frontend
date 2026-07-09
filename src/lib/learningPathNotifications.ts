import type { ProjectLearningPathResponse } from "../types"

type StageProgressUpdate = {
  comment?: string | null
  proof_items?: Array<{ name?: string; url?: string; kind?: string | null }>
  final_proof_items?: Array<{ name?: string; url?: string; kind?: string | null }>
  review_status?: string | null
  review_status_updated_at?: string | null
  progress_entries?: Array<{ proof_items?: Array<{ url?: string | null }>; updated_at?: string | null }>
  updated_at?: string | null
  admin_feedback?: string | null
  admin_feedback_updated_at?: string | null
  admin_feedback_thread?: Array<{ feedback?: string; by?: string; role?: string; updated_at?: string }>
  admin_feedback_by_proof?: Record<
    string,
    {
      proof_url?: string
      proof_name?: string
      latest_feedback?: string
      feedback_by?: string
      updated_at?: string
      thread?: Array<{ feedback?: string; by?: string; role?: string; updated_at?: string; proof_url?: string; proof_name?: string }>
    }
  >
}

type NotificationRole = "student" | "admin"

const STAGE_SEEN_KEY_PREFIX = "learning-path-stage-seen"
const PROOF_SEEN_KEY_PREFIX = "learning-path-proof-seen"

function normalizeKey(value?: string | null) {
  return String(value || "").trim().toLowerCase()
}

function toTimestamp(value?: string | null) {
  const raw = String(value || "").trim()
  if (!raw) return 0
  const parsed = new Date(raw).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

function toProofUploadTimestamp(proofUrl?: string | null) {
  const url = String(proofUrl || "").trim()
  if (!url) return 0
  const filename = url.split("/").pop() || ""
  const match = filename.match(/_(\d{9,})_/)
  if (!match) return 0
  const raw = Number(match[1])
  if (!Number.isFinite(raw) || raw <= 0) return 0
  return raw < 1e12 ? raw * 1000 : raw
}

function getStageSeenStorageKey(role: NotificationRole, username: string, repoName: string, stageTitle: string) {
  return `${STAGE_SEEN_KEY_PREFIX}:${role}:${normalizeKey(username)}:${normalizeKey(repoName)}:${normalizeKey(stageTitle)}`
}

function getProofSeenStorageKey(role: NotificationRole, username: string, repoName: string, stageTitle: string, proofUrl: string) {
  return `${PROOF_SEEN_KEY_PREFIX}:${role}:${normalizeKey(username)}:${normalizeKey(repoName)}:${normalizeKey(stageTitle)}:${normalizeKey(proofUrl)}`
}

function getStoredStageSeenTimestamp(role: NotificationRole, username: string, repoName: string, stageTitle: string) {
  if (typeof window === "undefined") return 0
  return toTimestamp(window.localStorage.getItem(getStageSeenStorageKey(role, username, repoName, stageTitle)))
}

function getStoredProofSeenTimestamp(role: NotificationRole, username: string, repoName: string, stageTitle: string, proofUrl: string) {
  if (typeof window === "undefined") return 0
  return toTimestamp(window.localStorage.getItem(getProofSeenStorageKey(role, username, repoName, stageTitle, proofUrl)))
}

export function markStageNotificationsSeen(
  role: NotificationRole,
  username: string,
  repoName: string,
  stageTitle: string,
  timestamp?: string | null
) {
  if (typeof window === "undefined") return
  const nextTimestamp = toTimestamp(timestamp)
  if (!nextTimestamp) return
  const storageKey = getStageSeenStorageKey(role, username, repoName, stageTitle)
  const previousTimestamp = toTimestamp(window.localStorage.getItem(storageKey))
  if (nextTimestamp > previousTimestamp) {
    window.localStorage.setItem(storageKey, new Date(nextTimestamp).toISOString())
  }
}

export function markProofNotificationsSeen(
  role: NotificationRole,
  username: string,
  repoName: string,
  stageTitle: string,
  proofUrl: string,
  timestamp?: string | null
) {
  if (typeof window === "undefined") return
  const normalizedProofUrl = String(proofUrl || "").trim()
  if (!normalizedProofUrl) return
  const nextTimestamp = toTimestamp(timestamp)
  if (!nextTimestamp) return
  const storageKey = getProofSeenStorageKey(role, username, repoName, stageTitle, normalizedProofUrl)
  const previousTimestamp = toTimestamp(window.localStorage.getItem(storageKey))
  if (nextTimestamp > previousTimestamp) {
    window.localStorage.setItem(storageKey, new Date(nextTimestamp).toISOString())
  }
}

function getStudentNotificationEventTimestamps(update?: StageProgressUpdate | null, proofUrl?: string | null) {
  if (!update) return []
  const timestamps: number[] = []
  const targetProofUrl = String(proofUrl || "").trim()
  if (targetProofUrl) {
    const proofEntry = update.admin_feedback_by_proof?.[targetProofUrl]
    const thread = Array.isArray(proofEntry?.thread) ? proofEntry.thread : []
    thread.forEach((entry) => {
      const role = String(entry.role || "admin").trim().toLowerCase()
      if (role && role !== "admin") return
      const ts = toTimestamp(entry.updated_at)
      if (ts) timestamps.push(ts)
    })
    return Array.from(new Set(timestamps.filter((value) => value > 0)))
  }
  const generalFallbackTs = toTimestamp(update.admin_feedback_updated_at)
  if (generalFallbackTs) timestamps.push(generalFallbackTs)
  const reviewStatus = normalizeKey(update.review_status)
  const reviewStatusTs = toTimestamp(update.review_status_updated_at)
  if (reviewStatusTs && reviewStatus && reviewStatus !== "pending") {
    timestamps.push(reviewStatusTs)
  }
  const generalThread = Array.isArray(update.admin_feedback_thread) ? update.admin_feedback_thread : []
  generalThread.forEach((entry) => {
    const role = String(entry.role || "admin").trim().toLowerCase()
    if (role && role !== "admin") return
    const ts = toTimestamp(entry.updated_at)
    if (ts) timestamps.push(ts)
  })
  return Array.from(new Set(timestamps.filter((value) => value > 0)))
}

function getAdminNotificationEventTimestamps(update?: StageProgressUpdate | null, proofUrl?: string | null) {
  if (!update) return []
  const targetProofUrl = String(proofUrl || "").trim()
  if (targetProofUrl) {
    const timestamps: number[] = []
    const progressEntries = Array.isArray(update.progress_entries) ? update.progress_entries : []
    progressEntries.forEach((entry) => {
      const hasTargetProof = (entry.proof_items || []).some((item) => String(item.url || "").trim() === targetProofUrl)
      if (hasTargetProof) {
        const ts = toTimestamp(entry.updated_at)
        if (ts) timestamps.push(ts)
      }
    })
    const hasFinalProof = (update.final_proof_items || []).some((item) => String(item.url || "").trim() === targetProofUrl)
    const proofEntry = update.admin_feedback_by_proof?.[targetProofUrl]
    const thread = Array.isArray(proofEntry?.thread) ? proofEntry.thread : []
    if (hasFinalProof) {
      const ts = toProofUploadTimestamp(targetProofUrl)
      if (ts) {
        timestamps.push(ts)
      } else if (!thread.length) {
        const fallbackTs = toTimestamp(update.updated_at)
        if (fallbackTs) timestamps.push(fallbackTs)
      }
    }
    thread.forEach((entry) => {
      const role = String(entry.role || "admin").trim().toLowerCase()
      if (role !== "student") return
      const ts = toTimestamp(entry.updated_at)
      if (ts) timestamps.push(ts)
    })
    return Array.from(new Set(timestamps.filter((value) => value > 0)))
  }
  const timestamps: number[] = []
  const progressEntries = Array.isArray(update.progress_entries) ? update.progress_entries : []
  progressEntries.forEach((entry) => {
    const ts = toTimestamp(entry.updated_at)
    if (ts) timestamps.push(ts)
  })
  const reviewStatus = normalizeKey(update.review_status)
  const reviewStatusTs = toTimestamp(update.review_status_updated_at)
  if (reviewStatusTs && reviewStatus === "pending" && (update.final_proof_items || []).length) {
    timestamps.push(reviewStatusTs)
  }
  const generalThread = Array.isArray(update.admin_feedback_thread) ? update.admin_feedback_thread : []
  generalThread.forEach((entry) => {
    const role = String(entry.role || "admin").trim().toLowerCase()
    if (role !== "student") return
    const ts = toTimestamp(entry.updated_at)
    if (ts) timestamps.push(ts)
  })
  return Array.from(new Set(timestamps.filter((value) => value > 0)))
}

function getLatestTimestamp(timestamps: number[]) {
  return timestamps.reduce((latest, value) => (value > latest ? value : latest), 0)
}

function getUnreadStageEventCount(
  role: NotificationRole,
  username: string,
  repoName: string,
  stageTitle: string,
  update?: StageProgressUpdate | null
) {
  const stageSeenAt = getStoredStageSeenTimestamp(role, username, repoName, stageTitle)
  const stageTimestamps =
    role === "admin" ? getAdminNotificationEventTimestamps(update) : getStudentNotificationEventTimestamps(update)
  const unread = new Set<number>()
  stageTimestamps.forEach((timestamp) => {
    if (timestamp > stageSeenAt) unread.add(timestamp)
  })
  collectProofUrls(update).forEach((proofUrl) => {
    const proofSeenAt = getStoredProofSeenTimestamp(role, username, repoName, stageTitle, proofUrl)
    const proofTimestamps =
      role === "admin"
        ? getAdminNotificationEventTimestamps(update, proofUrl)
        : getStudentNotificationEventTimestamps(update, proofUrl)
    proofTimestamps.forEach((timestamp) => {
      if (timestamp > proofSeenAt) unread.add(timestamp)
    })
  })
  return unread.size
}

function collectProofUrls(update?: StageProgressUpdate | null) {
  if (!update) return []
  const urls = new Set<string>()
  const progressEntries = Array.isArray(update.progress_entries) ? update.progress_entries : []
  progressEntries.forEach((entry) => {
    ;(entry.proof_items || []).forEach((item) => {
      const url = String(item.url || "").trim()
      if (url) urls.add(url)
    })
  })
  ;(update.proof_items || []).forEach((item) => {
    const url = String(item.url || "").trim()
    if (url) urls.add(url)
  })
  ;(update.final_proof_items || []).forEach((item) => {
    const url = String(item.url || "").trim()
    if (url) urls.add(url)
  })
  if (update.admin_feedback_by_proof && typeof update.admin_feedback_by_proof === "object") {
    Object.entries(update.admin_feedback_by_proof).forEach(([key, value]) => {
      const url = String(key || value?.proof_url || "").trim()
      if (url) urls.add(url)
    })
  }
  return Array.from(urls)
}

export function getStudentStageNotificationCount(
  username: string,
  repoName: string,
  stageTitle: string,
  update?: StageProgressUpdate | null
) {
  const seenAt = getStoredStageSeenTimestamp("student", username, repoName, stageTitle)
  return getStudentNotificationEventTimestamps(update).filter((timestamp) => timestamp > seenAt).length
}

export function getStudentProofNotificationCount(
  username: string,
  repoName: string,
  stageTitle: string,
  proofUrl: string,
  update?: StageProgressUpdate | null
) {
  const seenAt = getStoredProofSeenTimestamp("student", username, repoName, stageTitle, proofUrl)
  return getStudentNotificationEventTimestamps(update, proofUrl).filter((timestamp) => timestamp > seenAt).length
}

export function getAdminStageNotificationCount(
  username: string,
  repoName: string,
  stageTitle: string,
  update?: StageProgressUpdate | null
) {
  const seenAt = getStoredStageSeenTimestamp("admin", username, repoName, stageTitle)
  return getAdminNotificationEventTimestamps(update).filter((timestamp) => timestamp > seenAt).length
}

export function getAdminProofNotificationCount(
  username: string,
  repoName: string,
  stageTitle: string,
  proofUrl: string,
  update?: StageProgressUpdate | null
) {
  const seenAt = getStoredProofSeenTimestamp("admin", username, repoName, stageTitle, proofUrl)
  return getAdminNotificationEventTimestamps(update, proofUrl).filter((timestamp) => timestamp > seenAt).length
}

export function getLatestStudentStageNotificationTimestamp(update?: StageProgressUpdate | null) {
  const latest = getLatestTimestamp(getStudentNotificationEventTimestamps(update))
  return latest ? new Date(latest).toISOString() : ""
}

export function getLatestStudentProofNotificationTimestamp(update?: StageProgressUpdate | null, proofUrl?: string | null) {
  const latest = getLatestTimestamp(getStudentNotificationEventTimestamps(update, proofUrl))
  return latest ? new Date(latest).toISOString() : ""
}

export function getLatestAdminProofNotificationTimestamp(update?: StageProgressUpdate | null, proofUrl?: string | null) {
  const latest = getLatestTimestamp(getAdminNotificationEventTimestamps(update, proofUrl))
  return latest ? new Date(latest).toISOString() : ""
}

export function getLatestAdminStageNotificationTimestamp(update?: StageProgressUpdate | null) {
  const latest = getLatestTimestamp(getAdminNotificationEventTimestamps(update))
  return latest ? new Date(latest).toISOString() : ""
}

export function getStudentLearningPathNotificationCount(username: string, response?: ProjectLearningPathResponse | null) {
  if (!response?.projects?.length) return 0
  let total = 0
  response.projects.forEach((project) => {
    const updates = project.stage_progress_updates || {}
    Object.entries(updates).forEach(([stageTitle, update]) => {
      total += getUnreadStageEventCount("student", username, project.repo_name, stageTitle, update as StageProgressUpdate)
    })
  })
  return total
}

export function getAdminLearningPathNotificationCount(username: string, response?: ProjectLearningPathResponse | null) {
  if (!response?.projects?.length) return 0
  let total = 0
  response.projects.forEach((project) => {
    const updates = project.stage_progress_updates || {}
    Object.entries(updates).forEach(([stageTitle, update]) => {
      total += getUnreadStageEventCount("admin", username, project.repo_name, stageTitle, update as StageProgressUpdate)
    })
  })
  return total
}
