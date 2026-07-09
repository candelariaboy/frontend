import type { CertificateRecord } from "../types"

type NotificationRole = "student" | "admin"

const CERTIFICATE_SEEN_KEY_PREFIX = "certificate-seen"

function normalizeKey(value?: string | null) {
  return String(value || "").trim().toLowerCase()
}

function toTimestamp(value?: string | null) {
  const raw = String(value || "").trim()
  if (!raw) return 0
  const parsed = new Date(raw).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

function getCertificateSeenStorageKey(role: NotificationRole, username: string, certificateId: number) {
  return `${CERTIFICATE_SEEN_KEY_PREFIX}:${role}:${normalizeKey(username)}:${certificateId}`
}

function getStoredCertificateSeenTimestamp(role: NotificationRole, username: string, certificateId: number) {
  if (typeof window === "undefined") return 0
  return toTimestamp(window.localStorage.getItem(getCertificateSeenStorageKey(role, username, certificateId)))
}

function getStudentNotificationTimestamps(row?: CertificateRecord | null) {
  if (!row) return []
  const timestamps: number[] = []
  ;(row.comment_thread || []).forEach((entry) => {
    if (String(entry.role || "").trim().toLowerCase() !== "admin") return
    const ts = toTimestamp(entry.updated_at)
    if (ts) timestamps.push(ts)
  })
  return Array.from(new Set(timestamps))
}

function getAdminNotificationTimestamps(row?: CertificateRecord | null) {
  if (!row) return []
  const timestamps: number[] = []
  const submissionTs = toTimestamp(row.submitted_at)
  if (submissionTs) timestamps.push(submissionTs)
  ;(row.comment_thread || []).forEach((entry) => {
    if (String(entry.role || "").trim().toLowerCase() !== "student") return
    const ts = toTimestamp(entry.updated_at)
    if (ts) timestamps.push(ts)
  })
  return Array.from(new Set(timestamps))
}

function getLatestTimestamp(timestamps: number[]) {
  return timestamps.reduce((latest, value) => (value > latest ? value : latest), 0)
}

export function markCertificateNotificationsSeen(
  role: NotificationRole,
  username: string,
  certificateId: number,
  timestamp?: string | null
) {
  if (typeof window === "undefined") return
  const nextTimestamp = toTimestamp(timestamp)
  if (!nextTimestamp) return
  const storageKey = getCertificateSeenStorageKey(role, username, certificateId)
  const previousTimestamp = toTimestamp(window.localStorage.getItem(storageKey))
  if (nextTimestamp > previousTimestamp) {
    window.localStorage.setItem(storageKey, new Date(nextTimestamp).toISOString())
  }
}

export function getStudentCertificateNotificationCount(username: string, row?: CertificateRecord | null) {
  if (!row) return 0
  const seenAt = getStoredCertificateSeenTimestamp("student", username, row.id)
  return getStudentNotificationTimestamps(row).filter((timestamp) => timestamp > seenAt).length
}

export function getAdminCertificateNotificationCount(username: string, row?: CertificateRecord | null) {
  if (!row) return 0
  const seenAt = getStoredCertificateSeenTimestamp("admin", username, row.id)
  return getAdminNotificationTimestamps(row).filter((timestamp) => timestamp > seenAt).length
}

export function getLatestStudentCertificateNotificationTimestamp(row?: CertificateRecord | null) {
  const latest = getLatestTimestamp(getStudentNotificationTimestamps(row))
  return latest ? new Date(latest).toISOString() : ""
}

export function getLatestAdminCertificateNotificationTimestamp(row?: CertificateRecord | null) {
  const latest = getLatestTimestamp(getAdminNotificationTimestamps(row))
  return latest ? new Date(latest).toISOString() : ""
}

export function getStudentCertificatesNotificationTotal(username: string, rows?: CertificateRecord[] | null) {
  return (rows || []).reduce((sum, row) => sum + getStudentCertificateNotificationCount(username, row), 0)
}

export function getAdminCertificatesNotificationTotal(username: string, rows?: CertificateRecord[] | null) {
  return (rows || []).reduce((sum, row) => sum + getAdminCertificateNotificationCount(username, row), 0)
}
