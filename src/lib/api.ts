const DEFAULT_API_BASE = import.meta.env.DEV ? "http://localhost:8000" : ""
export const API_BASE = (import.meta.env.VITE_API_BASE || DEFAULT_API_BASE).replace(/\/$/, "")

const TOKEN_KEY = "devpath_token"
const USERNAME_KEY = "devpath_username"
const AVATAR_KEY = "devpath_avatar_url"
const ADMIN_TOKEN_KEY = "devpath_admin_token"
const ADMIN_USERNAME_KEY = "devpath_admin_username"
const FEATURE_FLAGS_KEY = "devpath_feature_flags"
const FIRST_SEEN_PREFIX = "devpath_first_seen_at:"
let portfolioSummaryRequest: Promise<string> | null = null
let recomputeInsightsRequest: Promise<ReturnType<typeof normalizeResponse>> | null = null

export type FeatureFlags = {
  sus_auto_prompt: boolean
  premium_portfolio_motion: boolean
  peer_recommendations: boolean
}

const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  sus_auto_prompt: true,
  premium_portfolio_motion: false,
  peer_recommendations: false,
}

export function setStoredAuth(token: string, username: string, avatarUrl?: string) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  }
  if (username) {
    localStorage.setItem(USERNAME_KEY, username)
    markUserFirstSeen(username)
  }
  if (typeof avatarUrl === "string") {
    if (avatarUrl.trim()) {
      localStorage.setItem(AVATAR_KEY, avatarUrl)
    } else {
      localStorage.removeItem(AVATAR_KEY)
    }
  }
}

export function getStoredAuth() {
  return {
    token: localStorage.getItem(TOKEN_KEY) || "",
    username: localStorage.getItem(USERNAME_KEY) || "",
    avatarUrl: localStorage.getItem(AVATAR_KEY) || "",
  }
}

export function clearStoredAuth() {
  clearAllStoredAppData()
}

export function markUserFirstSeen(username: string) {
  if (!username) return
  const key = `${FIRST_SEEN_PREFIX}${username.toLowerCase()}`
  if (!localStorage.getItem(key)) {
    localStorage.setItem(key, new Date().toISOString())
  }
}

export function getUserFirstSeen(username: string) {
  if (!username) return ""
  return localStorage.getItem(`${FIRST_SEEN_PREFIX}${username.toLowerCase()}`) || ""
}

export function getFeatureFlags(): FeatureFlags {
  const raw = localStorage.getItem(FEATURE_FLAGS_KEY)
  if (!raw) {
    return { ...DEFAULT_FEATURE_FLAGS }
  }
  try {
    const parsed = JSON.parse(raw) as Partial<FeatureFlags>
    return {
      ...DEFAULT_FEATURE_FLAGS,
      ...parsed,
    }
  } catch {
    return { ...DEFAULT_FEATURE_FLAGS }
  }
}

export function setFeatureFlag(flag: keyof FeatureFlags, enabled: boolean) {
  const next = {
    ...getFeatureFlags(),
    [flag]: enabled,
  }
  localStorage.setItem(FEATURE_FLAGS_KEY, JSON.stringify(next))
  return next
}

export function setStoredAdminAuth(token: string, username: string) {
  if (token) {
    localStorage.setItem(ADMIN_TOKEN_KEY, token)
  }
  if (username) {
    localStorage.setItem(ADMIN_USERNAME_KEY, username)
  }
}

export function getStoredAdminAuth() {
  return {
    token: localStorage.getItem(ADMIN_TOKEN_KEY) || "",
    username: localStorage.getItem(ADMIN_USERNAME_KEY) || "",
  }
}

export function clearStoredAdminAuth() {
  clearAllStoredAppData()
}

/** Clears admin credentials then hard-navigates (avoids a React frame still on `/admin/*` without a token → 404 / stuck UI). */
export function signOutAdmin(redirectPath: string = "/") {
  clearStoredAdminAuth()
  window.location.replace(redirectPath)
}

/**
 * Helper for admin-protected fetches. Attaches `Authorization` header when `token` is provided
 * and handles 401/403 by clearing admin auth and redirecting to `/admin-login`.
 */
async function adminFetch(path: string, token: string, options: RequestInit = {}) {
  const nextHeaders: Record<string, string> = { ...(options.headers as Record<string, string> | undefined) || {} }
  if (token) nextHeaders.Authorization = `Bearer ${token}`

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers: nextHeaders })
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      clearStoredAdminAuth()
      // hard navigate to admin login to ensure UI reset
      window.location.replace("/admin-login")
    }
    throw new Error(`Request failed: ${response.status}`)
  }
  return response.json()
}
/**
 * Helper for user/student-protected fetches. Attaches `Authorization` header
 * when `token` is provided and handles 401/403 by clearing auth and
 * redirecting to the app root so the login flow can re-run.
 */
async function authFetch(path: string, token: string, options: RequestInit = {}) {
  const nextHeaders: Record<string, string> = { ...(options.headers as Record<string, string> | undefined) || {} }
  if (token) nextHeaders.Authorization = `Bearer ${token}`

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers: nextHeaders })
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      clearStoredAuth()
      // Go back to root so the app can perform sign-in flow
      window.location.replace("/")
    }
    let detail = `Request failed: ${response.status}`
    try {
      const data = (await response.json()) as { detail?: string }
      if (typeof data.detail === "string" && data.detail.trim()) {
        detail = data.detail
      }
    } catch {
      // keep fallback status message
    }
    throw new Error(detail)
  }
  return response.json()
}

function normalizeProfile(raw: {
  username: string
  display_name?: string | null
  bio?: string | null
  avatar_url: string
  level: number
  xp: number
  next_level_xp: number
  streak_days: number
  has_recommendation_action?: boolean | null
  student_id?: string | null
  program?: string | null
  year_level?: string | null
  career_interest?: string | null
  preferred_learning_style?: string | null
  target_role?: string | null
  target_certifications?: string[] | null
  portfolio_completeness?: number | null
  is_verified?: boolean | null
  verified_at?: string | null
}) {
  return {
    username: raw.username,
    displayName: raw.display_name || raw.username,
    bio: raw.bio || "",
    avatarUrl: raw.avatar_url,
    level: raw.level,
    xp: raw.xp,
    nextLevelXp: raw.next_level_xp,
    streakDays: raw.streak_days,
    hasRecommendationAction:
      typeof raw.has_recommendation_action === "boolean" ? raw.has_recommendation_action : undefined,
    studentId: raw.student_id || undefined,
    program: raw.program || undefined,
    yearLevel: raw.year_level || undefined,
    careerInterest: raw.career_interest || undefined,
    preferredLearningStyle: raw.preferred_learning_style || undefined,
    targetRole: raw.target_role || undefined,
    targetCertifications: raw.target_certifications || [],
    portfolioCompleteness:
      typeof raw.portfolio_completeness === "number" ? raw.portfolio_completeness : undefined,
    isVerified: typeof raw.is_verified === "boolean" ? raw.is_verified : undefined,
    verifiedAt: raw.verified_at || undefined,
  }
}

function normalizeResponse(data: {
  profile: {
    username: string
    display_name?: string | null
    bio?: string | null
    avatar_url: string
    level: number
    xp: number
    next_level_xp: number
    streak_days: number
    has_recommendation_action?: boolean | null
    student_id?: string | null
    program?: string | null
    year_level?: string | null
    career_interest?: string | null
    preferred_learning_style?: string | null
    target_role?: string | null
    target_certifications?: string[] | null
    portfolio_completeness?: number | null
    is_verified?: boolean | null
    verified_at?: string | null
  }
  practice_dimensions: Array<{
    label: string
    confidence: number
    evidence: string[]
  }>
  career_suggestions: Array<{
    title: string
    confidence: number
    reasoning: string
  }>
  skill_domains?: Array<{
    dimension_key: string
    domain: string
    description: string
    score_percent: number
    level: string
    evidence: string[]
  }> | null
  focus_domain?: {
    dimension_key: string
    domain: string
    description: string
    score_percent: number
    level: string
    evidence: string[]
  } | null
  frequency?: {
    total_commits: number
    repo_count: number
    active_repos_30d: number
    weekly_commits: Array<{ week_start: string; commit_count: number }>
    weekly_commit_average: number
    streak_days: number
  } | null
  badges: Array<{
    label: string
    description: string
    criteria: string
    rarity: "common" | "rare" | "epic"
    achieved?: boolean
    claimed?: boolean
    reward_xp?: number
    medal_tier?: string
    medal_icon?: string
    category?: string
    category_icon?: string
    icon?: string
    target?: number
  }>
  repos: Array<{
    name: string
    description?: string | null
    language?: string | null
    languages?: string[] | null
    language_bytes?: Record<string, number> | null
    html_url?: string | null
    stars: number
    last_push?: string | null
    commit_count?: number
  }>
}) {
  return {
    profile: normalizeProfile(data.profile),
    practice_dimensions: data.practice_dimensions,
    career_suggestions: data.career_suggestions,
    skill_domains: data.skill_domains || [],
    focus_domain: data.focus_domain || null,
    frequency: data.frequency || null,
    badges: data.badges,
    repos: data.repos.map((repo) => ({
      name: repo.name,
      description: repo.description || "",
      language: repo.language || "Unknown",
      languages: repo.languages || [],
      languageBytes: repo.language_bytes || {},
      htmlUrl: repo.html_url || undefined,
      stars: repo.stars,
      last_push: repo.last_push || undefined,
      commitCount: repo.commit_count,
    })),
  }
}

export function getGithubLoginUrl(): string {
  return `${API_BASE}/auth/github/login`
}

export async function fetchUser(username: string) {
  const response = await fetch(`${API_BASE}/api/user/${username}`)
  if (!response.ok) {
    throw new Error("Failed to fetch user")
  }
  const data = await response.json()
  return normalizeResponse(data)
}

export async function fetchPortfolio(username: string) {
  const response = await fetch(`${API_BASE}/api/portfolio/${username}`)
  if (!response.ok) {
    throw new Error("Failed to fetch portfolio")
  }
  const data = await response.json()
  return {
    ...normalizeResponse(data),
    settings: data.settings || {},
  }
}

export async function fetchOwnerPortfolio(token: string) {
  const data = await authFetch(`/api/user/me/portfolio?t=${Date.now()}`, token, { cache: "no-store" })
  return {
    ...normalizeResponse(data),
    settings: data.settings || {},
  }
}

export async function generatePortfolioSummary(token: string) {
  if (!portfolioSummaryRequest) {
    portfolioSummaryRequest = (async () => {
      const data = (await authFetch(`/api/user/portfolio/generate-summary`, token, {
        method: "POST",
      })) as { summary?: string }
      return String(data.summary || "").trim()
    })().finally(() => {
      portfolioSummaryRequest = null
    })
  }
  return portfolioSummaryRequest
}

export async function pingAuth(token: string) {
  return authFetch(`/api/ping`, token)
}

export async function logoutAuth(token: string) {
  return authFetch(`/api/logout`, token, { method: "POST" })
}

export async function registerUser(
  token: string,
  payload: {
    display_name?: string
    bio?: string
    student_id?: string
    program?: string
    year_level?: string
    career_interest?: string
    preferred_learning_style?: string
    target_role?: string
    target_certifications?: string[]
  }
) {
  return authFetch(`/api/register`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function fetchLeaderboard() {
  const response = await fetch(`${API_BASE}/api/leaderboard`)
  if (!response.ok) {
    throw new Error("Failed to fetch leaderboard")
  }
  const data = (await response.json()) as Array<{
    id: number
    username: string
    avatar_url: string
    program?: string | null
    year_level?: string | null
    level: number
    xp: number
    runway_xp: number
    runway_remaining_xp: number
    delta: string
    badge_count?: number
    badge_stack?: Array<{
      label: string
      rarity: string
      medal_icon?: string | null
      achieved?: boolean
      claimed?: boolean
    }>
  }>
  return data.map((entry) => ({
    id: String(entry.id),
    username: entry.username,
    avatarUrl: entry.avatar_url,
    program: entry.program ?? null,
    yearLevel: entry.year_level ?? null,
    level: entry.level,
    xp: entry.xp,
    runwayXp: entry.runway_xp,
    runwayRemainingXp: entry.runway_remaining_xp,
    delta: entry.delta,
    badgeCount: Number(entry.badge_count || 0),
    badgeStack: Array.isArray(entry.badge_stack)
      ? entry.badge_stack.map((badge) => ({
          label: String(badge.label || ""),
          rarity: String(badge.rarity || "common"),
          medalIcon: badge.medal_icon || undefined,
          achieved: Boolean(badge.achieved),
          claimed: Boolean(badge.claimed),
        }))
      : [],
  }))
}

export async function fetchLearningPath(username: string) {
  const response = await fetch(`${API_BASE}/api/learning-path/${username}`)
  if (!response.ok) {
    throw new Error("Failed to fetch learning path")
  }
  return response.json()
}

export async function fetchProjectLearningPaths(username: string) {
  const response = await fetch(`${API_BASE}/api/learning-path/projects/${username}?t=${Date.now()}`, { cache: "no-store" })
  if (!response.ok) {
    throw new Error("Failed to fetch project learning paths")
  }
  return response.json()
}

export async function fetchCertificateSuggestions(username: string) {
  const response = await fetch(`${API_BASE}/api/certificate-suggestions/${username}?t=${Date.now()}`, { cache: "no-store" })
  if (!response.ok) {
    throw new Error("Failed to fetch certificate suggestions")
  }
  const payload = await response.json() as {
    username?: string
    items?: Array<{
      id: string
      title: string
      provider: string
      url: string
      reward_xp: number
      completed?: boolean
      locked?: boolean
      claimed_reward_xp?: number
      provider_aliases?: string[]
      match_tokens?: string[]
      groups?: string[]
      reasoning?: string
    }>
  }
  const items = Array.isArray(payload.items) ? payload.items : []
  return {
    username: String(payload.username || username),
    items: items.map((item) => ({
      id: String(item.id || ""),
      title: String(item.title || ""),
      provider: String(item.provider || ""),
      url: String(item.url || ""),
      rewardXp: Number(item.reward_xp || 0),
      completed: Boolean(item.completed),
      locked: Boolean(item.locked),
      claimedRewardXp: Number(item.claimed_reward_xp || 0),
      providerAliases: Array.isArray(item.provider_aliases) ? item.provider_aliases.map((value) => String(value)) : [],
      matchTokens: Array.isArray(item.match_tokens) ? item.match_tokens.map((value) => String(value)) : [],
      groups: Array.isArray(item.groups) ? item.groups.map((value) => String(value)) : [],
      reasoning: item.reasoning ? String(item.reasoning) : undefined,
    })),
  }
}

export async function claimProjectLearningPathReward(
  token: string,
  payload: {
    repo_name: string
  }
) {
  return authFetch(`/api/learning-path/projects/claim-reward`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function resetProjectLearningPathStages(
  token: string,
  payload: {
    repo_name: string
    stage_titles: string[]
  }
) {
  return authFetch(`/api/learning-path/projects/reset-stages`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function updateProjectStageStatus(
  token: string,
  payload: {
    repo_name: string
    stage_title: string
    status: "not_started" | "in_progress" | "done" | "complete_stage"
    checks?: boolean[]
    proof_count?: number
  }
) {
  return authFetch(`/api/learning-path/projects/stage-status`, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function updateProjectStageProgressUpdate(
  token: string,
  payload: {
    repo_name: string
    stage_title: string
    comment?: string | null
    proof_items?: Array<{ name: string; url: string; kind?: string | null }>
    final_proof_items?: Array<{ name: string; url: string; kind?: string | null }>
  }
) {
  return authFetch(`/api/learning-path/projects/stage-progress-update`, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function deleteProjectStageProof(
  token: string,
  payload: {
    repo_name: string
    stage_title: string
    proof_url: string
  }
) {
  return authFetch(`/api/learning-path/projects/stage-proof`, token, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function deleteProjectStageProgressUpdate(
  token: string,
  payload: {
    repo_name: string
    stage_title: string
    entry_id?: string
    proof_url?: string
    clear_comment?: boolean
    delete_entry?: boolean
  }
) {
  return authFetch(`/api/learning-path/projects/stage-progress-update/delete`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function replyProjectStageFeedback(
  token: string,
  payload: {
    repo_name: string
    stage_title: string
    feedback: string
    proof_url?: string
    proof_name?: string
  }
) {
  return authFetch(`/api/learning-path/projects/stage-feedback-reply`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function deleteProjectStageFeedbackReply(
  token: string,
  payload: {
    repo_name: string
    stage_title: string
    updated_at?: string
    proof_url?: string
    delete_all?: boolean
  }
) {
  return authFetch(`/api/learning-path/projects/stage-feedback-reply/delete`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function fetchCurriculumMap(username: string) {
  const response = await fetch(`${API_BASE}/api/curriculum-map/${username}`)
  if (!response.ok) {
    throw new Error("Failed to fetch curriculum map")
  }
  return response.json()
}

export async function fetchRuleRecommendations(username: string) {
  const response = await fetch(`${API_BASE}/api/recommendations/v2/${username}`)
  if (!response.ok) {
    throw new Error("Failed to fetch recommendations")
  }
  return response.json()
}

export async function fetchUserMeStatus(token: string) {
  return authFetch(`/api/ping`, token) as Promise<{ ok: boolean; has_recommendation_action?: boolean }>
}

export async function fetchWeeklyDigest(username: string) {
  const response = await fetch(`${API_BASE}/api/digest/weekly/${username}`)
  if (!response.ok) {
    throw new Error("Failed to fetch weekly digest")
  }
  return response.json()
}

export async function submitCertificate(
  token: string,
  payload: {
    title: string
    provider: string
    proof_type?: string | null
    certificate_url: string
    certificate_page_url?: string | null
    student_note?: string | null
    suggestion_track_id?: string | null
    suggestion_module_url?: string | null
    final_completion?: boolean
    reward_xp?: number | null
  }
) {
  return authFetch(`/api/certificates/submit`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function claimCertificateReward(
  token: string,
  payload: { certificate_id: number }
) {
  return authFetch(`/api/certificates/claim-reward`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function autoSubmitStageCertificate(
  token: string,
  payload: {
    repo_name: string
    stage_title: string
    title: string
    provider: string
    proof_type?: string | null
    certificate_url: string
    certificate_page_url?: string | null
    student_note?: string | null
  }
) {
  return authFetch(`/api/certificates/auto-stage-proof`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function uploadCertificate(token: string, file: File) {
  const form = new FormData()
  form.append("file", file)
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(`${API_BASE}/api/certificates/upload`, {
    method: "POST",
    headers,
    body: form,
  })
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      clearStoredAuth()
      window.location.replace("/")
    }
    throw new Error(`Request failed: ${response.status}`)
  }
  return response.json()
}

export async function fetchMyCertificates(token: string) {
  return authFetch(`/api/certificates/me`, token)
}

export async function replyCertificateComment(
  token: string,
  payload: { certificate_id: number; comment: string }
) {
  return authFetch(`/api/certificates/comment-reply`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function deleteMyCertificateCommentReply(
  token: string,
  payload: { certificate_id: number; updated_at?: string; delete_all?: boolean }
) {
  return authFetch(`/api/certificates/comment-reply/delete`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function deleteCertificateProgress(
  token: string,
  payload: { certificate_id: number; clear_comment?: boolean; delete_proof?: boolean }
) {
  return authFetch(`/api/certificates/progress-delete`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function fetchMyFccProgress(token: string) {
  return authFetch(`/api/certificates/fcc-progress`, token)
}

export async function fetchLearningAccounts(token: string) {
  return authFetch(`/api/learning-accounts`, token)
}

export async function updateLearningAccounts(
  token: string,
  payload: { freecodecamp_username?: string | null }
) {
  return authFetch(`/api/learning-accounts`, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function fetchFreecodecampStats(token: string, refreshPublic: boolean = false) {
  const query = refreshPublic ? "?refresh_public=true" : ""
  return authFetch(`/api/learning-accounts/freecodecamp/stats${query}`, token)
}

export async function syncFreecodecampCertificates(token: string) {
  return authFetch(`/api/learning-accounts/freecodecamp/sync`, token, { method: "POST" })
}

export async function upsertMyFccProgress(
  token: string,
  moduleKey: string,
  payload: {
    module_title: string
    status: string
    progress_percent: number
    notes?: string | null
    certificate_url?: string | null
  }
) {
  return authFetch(`/api/certificates/fcc-progress/${encodeURIComponent(moduleKey)}`, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function fetchMyGoals(token: string) {
  return authFetch(`/api/goals/me`, token)
}

export async function createMyGoal(
  token: string,
  payload: {
    title: string
    target_value?: number | null
    current_value?: number | null
    unit?: string | null
    status?: string
    target_date?: string | null
    notes?: string | null
  }
) {
  return authFetch(`/api/goals/me`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function updateMyGoal(
  token: string,
  goalId: number,
  payload: {
    title?: string
    target_value?: number | null
    current_value?: number | null
    unit?: string | null
    status?: string
    target_date?: string | null
    notes?: string | null
  }
) {
  return authFetch(`/api/goals/me/${goalId}`, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function deleteMyGoal(token: string, goalId: number) {
  return authFetch(`/api/goals/me/${goalId}`, token, { method: "DELETE" })
}

export async function fetchDailyQuests(token: string) {
  return authFetch(`/api/quests/daily`, token)
}

export async function claimDailyQuest(token: string, questKey: string) {
  return authFetch(`/api/quests/daily/claim`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quest_key: questKey }),
  })
}

export async function fetchWeeklyChallenges(token: string) {
  return authFetch(`/api/challenges/weekly`, token)
}

export async function claimWeeklyChallenge(token: string, challengeKey: string) {
  return authFetch(`/api/challenges/weekly/claim`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ challenge_key: challengeKey }),
  })
}

export async function trackRecommendationAction(
  token: string,
  payload: {
    dimension_key?: string
    module_title: string
    module_url: string
    action?: string
    action_type?: string
    rating?: number
    feedback?: string
  }
) {
  return authFetch(`/api/recommendations/action`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function adminLogin(payload: { username: string; password: string }) {
  const response = await fetch(`${API_BASE}/auth/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    let detail = "Failed to login"
    try {
      const data = (await response.json()) as { detail?: string }
      if (typeof data.detail === "string" && data.detail.trim()) {
        detail = data.detail
      }
    } catch {
      // Keep fallback detail message when backend body is not JSON.
    }
    throw new Error(detail)
  }
  return response.json()
}

export async function fetchAdminStudents(token: string) {
  return adminFetch(`/admin/students`, token)
}

export async function fetchAdminStudentDetails(token: string, studentId: number) {
  const response = await fetch(`${API_BASE}/admin/students/${studentId}/details`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (response.ok) {
    return response.json()
  }
  if (response.status === 401 || response.status === 403) {
    clearStoredAdminAuth()
    window.location.replace("/admin-login")
    throw new Error(`Request failed: ${response.status}`)
  }
  // Backward-compatible fallback for older backend versions where
  // `/admin/students/{id}/details` is not yet available.
  if (response.status === 404) {
    const students = (await fetchAdminStudents(token)) as Array<{
      id: number
      username: string
      display_name?: string | null
      avatar_url: string
      level: number
      xp: number
      repo_count: number
      badges_claimed: number
      online: boolean
      last_seen?: string | null
      program?: string | null
      year_level?: string | null
      is_verified?: boolean
      verified_at?: string | null
    }>
    const student = students.find((item) => Number(item.id) === Number(studentId))
    if (!student) {
      throw new Error("Request failed: 404")
    }

    const [notes, validations, reviews, userSummary] = await Promise.all([
      fetchAdminNotes(token, studentId).catch(() => []),
      fetchProjectValidations(token, studentId).catch(() => []),
      fetchPortfolioReviews(token, studentId).catch(() => []),
      fetchUser(student.username).catch(() => null),
    ])

    const repos = Array.isArray(userSummary?.repos) ? userSummary.repos : []
    const practiceDimensions = Array.isArray(userSummary?.practice_dimensions)
      ? userSummary.practice_dimensions
      : []
    const careerSuggestions = Array.isArray(userSummary?.career_suggestions)
      ? userSummary.career_suggestions
      : []
    const totalCommits = repos.reduce((sum, repo) => sum + Number(repo.commitCount || 0), 0)
    const totalStars = repos.reduce((sum, repo) => sum + Number(repo.stars || 0), 0)
    const topRepos = [...repos]
      .sort((a, b) => Number(b.commitCount || 0) - Number(a.commitCount || 0))
      .slice(0, 6)
      .map((repo) => ({
        name: repo.name,
        description: repo.description || "",
        language: repo.language || "Unknown",
        stars: Number(repo.stars || 0),
        commit_count: Number(repo.commitCount || 0),
        last_push: repo.last_push || null,
      }))

    return {
      student,
      profile: {
        bio: userSummary?.profile?.bio || "",
        student_id: userSummary?.profile?.studentId || "",
        career_interest: userSummary?.profile?.careerInterest || "",
        preferred_learning_style: userSummary?.profile?.preferredLearningStyle || "",
        target_role: userSummary?.profile?.targetRole || "",
        target_certifications: userSummary?.profile?.targetCertifications || [],
        created_at: null,
      },
      overview: {
        total_commits: totalCommits,
        total_stars: totalStars,
        repo_count: Number(student.repo_count || 0),
        badges_claimed: Number(student.badges_claimed || 0),
        certificates_total: 0,
        certificates_verified: 0,
        recommendation_actions_total: 0,
        recommendation_acceptance_rate: 0,
        recommendation_relevance_rate: 0,
        portfolio_completeness: userSummary?.profile?.portfolioCompleteness || 0,
        days_since_last_seen: null,
      },
      top_repos: topRepos,
      practice_dimensions: practiceDimensions,
      career_suggestions: careerSuggestions,
      recent_recommendations: [],
      recent_activity: [],
      fcc_progress_summary: {
        overall_progress_percent: 0,
        modules_started: 0,
        modules_completed: 0,
        total_modules: 0,
        last_updated_at: null,
      },
      fcc_progress: [],
      certificates: [],
      validations: validations || [],
      notes: notes || [],
      reviews: reviews || [],
    }
  }
  throw new Error(`Request failed: ${response.status}`)
}

export async function verifyAdminStudent(
  token: string,
  payload: { student_id: number; is_verified: boolean }
) {
  return adminFetch(`/admin/students/verify`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }) as Promise<{ student_id: number; is_verified: boolean; verified_at?: string | null }>
}

export async function deleteAdminStudent(token: string, studentId: number) {
  return adminFetch(`/admin/students/${studentId}`, token, { method: "DELETE" }) as Promise<{ deleted: number }>
}

export async function deleteAllAdminStudents(token: string, confirm: string) {
  return adminFetch(`/admin/students`, token, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirm }),
  }) as Promise<{ deleted: number }>
}

export async function exportAdminStudentsCsv(token: string) {
  const response = await fetch(`${API_BASE}/admin/export/students.csv`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      clearStoredAdminAuth()
      window.location.replace("/admin-login")
    }
    throw new Error(`Request failed: ${response.status}`)
  }
  const contentDisposition = response.headers.get("Content-Disposition") || ""
  const match = contentDisposition.match(/filename="?([^"]+)"?/)
  const filename = match?.[1] || "students_report.csv"
  const blob = await response.blob()
  return { blob, filename }
}

export async function fetchAdminAnalytics(token: string) {
  return adminFetch(`/admin/analytics`, token)
}

export async function fetchAdminEvaluationMetrics(token: string) {
  return adminFetch(`/admin/evaluation/metrics`, token)
}

export async function fetchAdminEvaluationPredictions(token: string, limit: number = 12) {
  return adminFetch(`/admin/evaluation/predictions?limit=${limit}`, token)
}

export async function fetchAdminDeepAnalytics(token: string, range: "1h" | "1d" | "7d" | "30d" = "7d") {
  return adminFetch(`/admin/analytics/deep?range=${range}`, token)
}

export async function resetAdminAnalytics(token: string) {
  return adminFetch(`/admin/analytics/reset`, token, { method: "POST" })
}

export async function fetchEngagementAnalytics(token: string) {
  return authFetch(`/analytics/engagement`, token)
}

export async function fetchActivityTimeline(token: string) {
  return authFetch(`/analytics/activity-timeline`, token)
}

export async function fetchLoginActivity(token: string) {
  return authFetch(`/analytics/login-activity`, token)
}

export async function fetchLoginTrends(token: string) {
  return adminFetch(`/analytics/login-trends`, token)
}

export async function fetchLoginLive(token: string) {
  return adminFetch(`/analytics/login-live`, token)
}

export async function fetchMyProjectValidations(token: string) {
  return authFetch(`/api/validations/me`, token)
}


export async function fetchAdminNotes(token: string, studentId: number) {
  return adminFetch(`/admin/notes/${studentId}`, token)
}

export async function createAdminNote(token: string, payload: { student_id: number; note: string }) {
  return adminFetch(`/admin/notes`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function upsertAdminStageFeedback(
  token: string,
  username: string,
  payload: { repo_name: string; stage_title: string; feedback?: string; proof_url?: string; proof_name?: string; status?: "pending" | "accepted" | "rejected" | string }
) {
  return adminFetch(`/admin/students/${encodeURIComponent(username)}/learning-path/stage-feedback`, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function deleteAdminStageFeedback(
  token: string,
  username: string,
  payload: { repo_name: string; stage_title: string; updated_at?: string; proof_url?: string; delete_all?: boolean }
) {
  return adminFetch(`/admin/students/${encodeURIComponent(username)}/learning-path/stage-feedback/delete`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function fetchProjectValidations(token: string, studentId: number) {
  return adminFetch(`/admin/validations/${studentId}`, token)
}

export async function fetchAllProjectValidations(token: string, status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : ""
  return adminFetch(`/admin/validations${query}`, token)
}

export async function fetchPendingCertificates(token: string) {
  return adminFetch(`/admin/certificates/pending`, token)
}

export async function reviewCertificate(
  token: string,
  payload: { certificate_id: number; status: string; reviewer_note?: string }
) {
  return adminFetch(`/admin/certificates/review`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function commentOnCertificate(
  token: string,
  payload: { certificate_id: number; comment: string }
) {
  return adminFetch(`/admin/certificates/comment`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function deleteCertificateComment(
  token: string,
  payload: { certificate_id: number; updated_at?: string; delete_all?: boolean }
) {
  return adminFetch(`/admin/certificates/comment-delete`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function createProjectValidation(
  token: string,
  payload: { student_id: number; repo_name: string; status: string; comment?: string }
) {
  return adminFetch(`/admin/validations`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function createBulkProjectValidations(
  token: string,
  payload: { student_id: number; items: Array<{ repo_name: string; status: string; comment?: string }> }
) {
  return adminFetch(`/admin/validations/bulk`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function reviewCertificatesBulk(
  token: string,
  payload: { items: Array<{ certificate_id: number; status: string; reviewer_note?: string }> }
) {
  return adminFetch(`/admin/certificates/review/bulk`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function fetchResearchAnalytics(token: string) {
  return adminFetch(`/admin/research/analytics`, token)
}


export async function updateSettings(
  token: string,
  payload: {
    theme?: string
    theme_light?: string
    theme_dark?: string
    show_sections?: Record<string, boolean>
    featured_repos?: string[]
    featured_badges?: string[]
    social_links?: Record<string, unknown>
    bio?: string
    cover_image?: string
    is_public?: boolean
  }
) {
  const data = await authFetch(`/api/user/settings`, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  return {
    ...normalizeResponse(data),
    settings: data.settings || {},
  }
}

export async function recomputeInsights(token: string) {
  if (!recomputeInsightsRequest) {
    recomputeInsightsRequest = (async () => {
      const data = await authFetch(`/api/user/recompute`, token, { method: "POST" })
      return normalizeResponse(data)
    })().finally(() => {
      recomputeInsightsRequest = null
    })
  }
  return recomputeInsightsRequest
}

export async function claimBadges(token: string) {
  const data = await authFetch(`/api/user/claim-badges`, token, { method: "POST" })
  const normalized = normalizeResponse(data)
  const claimableCount = (normalized.badges || []).filter((badge) => badge.achieved && !badge.claimed).length
  window.dispatchEvent(new CustomEvent("devpath:claimable-badges", { detail: { count: claimableCount } }))
  return normalized
}

export async function fetchPortfolioReviews(token: string, studentId: number) {
  return adminFetch(`/admin/portfolio-reviews/${studentId}`, token)
}

export async function createPortfolioReview(
  token: string,
  payload: { student_id: number; status: string; summary: string }
) {
  return adminFetch(`/admin/portfolio-reviews`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export function clearAllStoredAppData() {
  if (typeof window === "undefined") return

  const storage = window.localStorage
  const exactKeys = new Set([
    "devpath_token",
    "devpath_username",
    "devpath_avatar_url",
    "devpath_admin_token",
    "devpath_admin_username",
    "devpath_feature_flags",
    "devpath_theme",
    "learning-path-stage-statuses",
    "learning-path-stage-checks",
    "learning-path-stage-proof-status",
  ])
  const prefixes = [
    "devpath_first_seen_at:",
    "devpath_level:",
    "certificate-seen:",
    "learning-path-stage-seen:",
    "learning-path-proof-seen:",
  ]
  const keysToRemove: string[] = []

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (!key) continue
    if (exactKeys.has(key) || prefixes.some((prefix) => key.startsWith(prefix))) {
      keysToRemove.push(key)
    }
  }

  keysToRemove.forEach((key) => storage.removeItem(key))
}
