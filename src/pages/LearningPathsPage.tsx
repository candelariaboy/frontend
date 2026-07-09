import { useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "react-router-dom"
import {
  claimProjectLearningPathReward,
  deleteProjectStageProgressUpdate,
  deleteProjectStageFeedbackReply,
  fetchPortfolio,
  fetchOwnerPortfolio,
  fetchProjectLearningPaths,
  getStoredAdminAuth,
  getStoredAuth,
  recomputeInsights,
  replyProjectStageFeedback,
  setStoredAuth,
  deleteAdminStageFeedback,
  upsertAdminStageFeedback,
  updateProjectStageProgressUpdate,
  updateProjectStageStatus,
} from "../lib/api"
import AdminFrame from "../components/AdminFrame"
import {
  getAdminLearningPathNotificationCount,
  getAdminProofNotificationCount,
  getAdminStageNotificationCount,
  getLatestAdminProofNotificationTimestamp,
  getLatestAdminStageNotificationTimestamp,
  getLatestStudentProofNotificationTimestamp,
  getLatestStudentStageNotificationTimestamp,
  getStudentLearningPathNotificationCount,
  getStudentProofNotificationCount,
  getStudentStageNotificationCount,
  markProofNotificationsSeen,
  markStageNotificationsSeen,
} from "../lib/learningPathNotifications"
import type { LearningPathStep, PortfolioResponse, ProjectLearningPathResponse, RepoSummary } from "../types"

type RepoRoadmap = {
  repoName: string
  progress: number
  summary: string
  evidence: string[]
  stages: StageCard[]
  milestones: LearningPathStep[]
}

type StageCard = {
  title: string
  summary: string
  status: "done" | "in_progress" | "not_started" | "complete_stage"
  percent: number
  items: string[]
  resources: Array<{ name: string; url: string }>
}

type EvidenceKind = "image" | "video" | "pdf" | "file"

type EvidenceItem = {
  name: string
  url: string
  kind: EvidenceKind
}

type RepoShowcaseItem = {
  name: string
  url: string
  kind: EvidenceKind | "repo"
  source: string
  stageTitle?: string
}

type StageUpdateAttachment = {
  name: string
  url: string
  kind: EvidenceKind
}

type ProofViewerState = {
  repoName: string
  stageTitle: string
  selectedEntryId?: string | null
  progressEntries?: Array<{
    entry_id: string
    comment?: string | null
    proof_items?: Array<{ name: string; url: string; kind?: string | null }>
    updated_at?: string | null
  }>
  proofLabel?: string
  fallbackMessage?: string
  comment?: string | null
  proofItems: Array<{ name: string; url: string; kind?: string | null }>
  reviewStatus?: "pending" | "accepted" | "rejected" | string | null
  reviewStatusUpdatedAt?: string | null
  updatedAt?: string | null
  adminFeedback?: string | null
  adminFeedbackBy?: string | null
  adminFeedbackUpdatedAt?: string | null
  adminFeedbackThread?: Array<{ feedback: string; by?: string; role?: string; updated_at?: string }>
  adminFeedbackByProof?: Record<string, { thread?: Array<{ feedback: string; by?: string; role?: string; updated_at?: string; proof_url?: string; proof_name?: string }> }>
}

type AdminFeedbackViewerState = {
  repoName: string
  stageTitle: string
  thread: Array<{ feedback: string; by?: string; updated_at?: string }>
}

type StageProgressArchiveEntry = {
  entry_id: string
  comment?: string | null
  proof_items?: Array<{ name: string; url: string; kind?: string | null }>
  updated_at?: string | null
}

type RepoArchetype =
  | "frontend-dashboard"
  | "backend-api"
  | "data-ml"
  | "portfolio-site"
  | "ecommerce"
  | "auth-system"
  | "admin-system"
  | "mobile-app"
  | "game"
  | "devops"
  | "generic-app"

const STAGE_RESOURCES = {
  foundation: [
    { name: "Git basics (GitHub Docs)", url: "https://docs.github.com/en/get-started/quickstart/hello-world" },
    { name: "README guide", url: "https://www.makeareadme.com/" },
    { name: "GitHub Skills", url: "https://skills.github.com/" },
    { name: "roadmap.sh developer paths", url: "https://roadmap.sh/" },
  ],
  frontend: [
    { name: "React docs", url: "https://react.dev/learn" },
    { name: "MDN responsive design", url: "https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Responsive_Design" },
    { name: "JavaScript.info", url: "https://javascript.info/" },
    { name: "TypeScript handbook", url: "https://www.typescriptlang.org/docs/" },
  ],
  uiux: [
    { name: "NN/g UX basics", url: "https://www.nngroup.com/articles/definition-user-experience/" },
    { name: "Figma wireframing basics", url: "https://www.figma.com/resource-library/what-is-wireframing/" },
    { name: "MDN accessibility guide", url: "https://developer.mozilla.org/en-US/docs/Learn/Accessibility" },
    { name: "Web.dev responsive design", url: "https://web.dev/responsive-web-design-basics/" },
  ],
  feature: [
    { name: "User stories guide", url: "https://www.mountaingoatsoftware.com/agile/user-stories" },
    { name: "Project planning basics", url: "https://www.atlassian.com/project-management/project-planning" },
    { name: "Product requirements guide", url: "https://www.productplan.com/glossary/product-requirements-document/" },
    { name: "Wireframing basics", url: "https://www.figma.com/resource-library/what-is-wireframing/" },
  ],
  backend: [
    { name: "FastAPI tutorial", url: "https://fastapi.tiangolo.com/tutorial/" },
    { name: "Postman API intro", url: "https://learning.postman.com/docs/getting-started/overview/" },
    { name: "REST API design", url: "https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design" },
    { name: "OpenAPI specification", url: "https://spec.openapis.org/oas/latest.html" },
  ],
  architecture: [
    { name: "System design primer", url: "https://github.com/donnemartin/system-design-primer" },
    { name: "API design basics", url: "https://swagger.io/resources/articles/best-practices-in-api-design/" },
    { name: "12-factor app", url: "https://12factor.net/" },
    { name: "Refactoring Guru patterns", url: "https://refactoring.guru/design-patterns" },
  ],
  database: [
    { name: "SQLBolt basics", url: "https://sqlbolt.com/" },
    { name: "Postgres tutorial", url: "https://www.postgresqltutorial.com/" },
    { name: "PostgreSQL docs", url: "https://www.postgresql.org/docs/" },
    { name: "DB Fiddle", url: "https://www.db-fiddle.com/" },
  ],
  testing: [
    { name: "Pytest quick start", url: "https://docs.pytest.org/en/stable/getting-started.html" },
    { name: "Jest getting started", url: "https://jestjs.io/docs/getting-started" },
    { name: "Playwright docs", url: "https://playwright.dev/docs/intro" },
    { name: "Testing Library", url: "https://testing-library.com/docs/" },
  ],
  data: [
    { name: "Pandas getting started", url: "https://pandas.pydata.org/docs/getting_started/index.html" },
    { name: "scikit-learn tutorials", url: "https://scikit-learn.org/stable/tutorial/index.html" },
    { name: "Kaggle microcourses", url: "https://www.kaggle.com/learn" },
    { name: "NumPy quickstart", url: "https://numpy.org/doc/stable/user/quickstart.html" },
  ],
  dataPrep: [
    { name: "Pandas data cleaning", url: "https://pandas.pydata.org/docs/user_guide/basics.html" },
    { name: "Scikit-learn preprocessing", url: "https://scikit-learn.org/stable/modules/preprocessing.html" },
    { name: "Kaggle data cleaning course", url: "https://www.kaggle.com/learn/data-cleaning" },
    { name: "Jupyter Notebook docs", url: "https://jupyter-notebook.readthedocs.io/en/stable/" },
  ],
  modeling: [
    { name: "Scikit-learn model selection", url: "https://scikit-learn.org/stable/model_selection.html" },
    { name: "Scikit-learn supervised learning", url: "https://scikit-learn.org/stable/supervised_learning.html" },
    { name: "Pandas feature engineering guide", url: "https://pandas.pydata.org/docs/user_guide/reshaping.html" },
    { name: "Kaggle intro to machine learning", url: "https://www.kaggle.com/learn/intro-to-machine-learning" },
  ],
  evaluation: [
    { name: "Scikit-learn metrics guide", url: "https://scikit-learn.org/stable/modules/model_evaluation.html" },
    { name: "Confusion matrix explained", url: "https://developers.google.com/machine-learning/crash-course/classification/accuracy-precision-recall" },
    { name: "Error analysis guide", url: "https://developers.google.com/machine-learning/guides/rules-of-ml#error_analysis" },
    { name: "ML experiment tracking basics", url: "https://mlflow.org/docs/latest/tracking.html" },
  ],
  devops: [
    { name: "Docker getting started", url: "https://docs.docker.com/get-started/" },
    { name: "GitHub Actions docs", url: "https://docs.github.com/en/actions" },
    { name: "Docker curriculum", url: "https://docker-curriculum.com/" },
    { name: "Render deploy docs", url: "https://render.com/docs/deploy" },
  ],
  monitoring: [
    { name: "Prometheus basics", url: "https://prometheus.io/docs/introduction/overview/" },
    { name: "Grafana tutorials", url: "https://grafana.com/tutorials/" },
    { name: "OpenTelemetry docs", url: "https://opentelemetry.io/docs/" },
    { name: "Sentry docs", url: "https://docs.sentry.io/" },
  ],
  security: [
    { name: "OWASP Top 10", url: "https://owasp.org/www-project-top-ten/" },
    { name: "Auth0 JWT guide", url: "https://auth0.com/docs/secure/tokens/json-web-tokens" },
    { name: "PortSwigger Web Security Academy", url: "https://portswigger.net/web-security" },
    { name: "MDN Web Security", url: "https://developer.mozilla.org/en-US/docs/Web/Security" },
  ],
  auth: [
    { name: "FastAPI security guide", url: "https://fastapi.tiangolo.com/tutorial/security/" },
    { name: "JWT introduction", url: "https://jwt.io/introduction" },
    { name: "OAuth 2.0 simplified", url: "https://aaronparecki.com/oauth-2-simplified/" },
    { name: "RBAC design guide", url: "https://auth0.com/docs/manage-users/access-control/rbac" },
  ],
  deployment: [
    { name: "Render deploy guide", url: "https://render.com/docs/deploy" },
    { name: "Vercel quickstart", url: "https://vercel.com/docs/getting-started-with-vercel" },
    { name: "Netlify deploy overview", url: "https://docs.netlify.com/" },
    { name: "Docker Compose docs", url: "https://docs.docker.com/compose/" },
  ],
  evidence: [
    { name: "README best practices", url: "https://github.com/matiassingers/awesome-readme" },
    { name: "Technical case study guide", url: "https://www.atlassian.com/work-management/knowledge-sharing/documentation/case-study-template" },
    { name: "Loom demo guide", url: "https://support.loom.com/hc/en-us/articles/360006001497-Record-your-first-video" },
    { name: "GitHub portfolio README guide", url: "https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-github-profile/managing-your-profile-readme" },
  ],
}

const STAGE_STATUS_STORAGE_KEY = "learning-path-stage-statuses"
const STAGE_CHECK_STORAGE_KEY = "learning-path-stage-checks"
const STAGE_PROOF_STATUS_KEY = "learning-path-stage-proof-status"

function combineResources(...groups: Array<Array<{ name: string; url: string }>>) {
  const seen = new Set<string>()
  const merged: Array<{ name: string; url: string }> = []
  for (const group of groups) {
    for (const item of group) {
      const key = `${item.name}|${item.url}`
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(item)
    }
  }
  return merged.slice(0, 5)
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

function scrollToSection(sectionId: string) {
  if (typeof window === "undefined") return
  const node = document.getElementById(sectionId)
  if (!node) return
  node.scrollIntoView({ behavior: "smooth", block: "start" })
}

function unique(values: Array<string | undefined | null>, limit = 8) {
  return Array.from(new Set(values.map((item) => String(item || "").trim()).filter(Boolean))).slice(0, limit)
}

function repoSignalText(repo?: RepoSummary | null) {
  if (!repo) return ""
  return [repo.name, repo.description, repo.language, ...(repo.languages || [])].join(" ").toLowerCase()
}

function buildGithubRepoUrl(owner?: string | null, repoName?: string | null) {
  const cleanOwner = String(owner || "").trim()
  const cleanRepoName = String(repoName || "").trim()
  if (!cleanOwner || !cleanRepoName) return ""
  return `https://github.com/${encodeURIComponent(cleanOwner)}/${encodeURIComponent(cleanRepoName)}`
}

function normalizeStageProgressEntries(update?: Record<string, unknown> | null): StageProgressArchiveEntry[] {
  if (!update || typeof update !== "object") return []
  const rawEntries = update.progress_entries
  if (Array.isArray(rawEntries) && rawEntries.length) {
    return rawEntries
      .map((entry, index): StageProgressArchiveEntry | null => {
        if (!entry || typeof entry !== "object") return null
        const rawProofItems = Array.isArray((entry as Record<string, unknown>).proof_items)
          ? ((entry as Record<string, unknown>).proof_items as Array<{ name?: string; url?: string; kind?: string | null }>)
          : []
        return {
          entry_id: String((entry as Record<string, unknown>).entry_id || `entry-${index + 1}`),
          comment: typeof (entry as Record<string, unknown>).comment === "string" ? String((entry as Record<string, unknown>).comment) : null,
          proof_items: rawProofItems
            .filter((item) => item && typeof item === "object" && String(item.url || "").trim())
            .map((item, proofIndex) => ({
              name: String(item.name || `Progress proof ${proofIndex + 1}`),
              url: String(item.url || "").trim(),
              kind: item.kind || "file",
            })),
          updated_at: typeof (entry as Record<string, unknown>).updated_at === "string" ? String((entry as Record<string, unknown>).updated_at) : null,
        } satisfies StageProgressArchiveEntry
      })
      .filter((entry): entry is StageProgressArchiveEntry => Boolean(entry))
  }

  const legacyProofItems = Array.isArray(update.proof_items)
    ? (update.proof_items as Array<{ name?: string; url?: string; kind?: string | null }>)
    : []
  const legacyComment = typeof update.comment === "string" ? String(update.comment) : null
  if (!legacyComment && !legacyProofItems.length) return []
  return [
    {
      entry_id: "legacy-progress-entry",
      comment: legacyComment,
      proof_items: legacyProofItems
        .filter((item) => item && typeof item === "object" && String(item.url || "").trim())
        .map((item, proofIndex) => ({
          name: String(item.name || `Progress proof ${proofIndex + 1}`),
          url: String(item.url || "").trim(),
          kind: item.kind || "file",
        })),
      updated_at: typeof update.updated_at === "string" ? String(update.updated_at) : null,
    },
  ]
}

function hasSavedStageProgressProof(update?: Record<string, unknown> | null) {
  return normalizeStageProgressEntries(update).some((entry) =>
    Array.isArray(entry.proof_items) && entry.proof_items.some((item) => String(item.url || "").trim())
  )
}

function countSavedStageProgressProofItems(update?: Record<string, unknown> | null) {
  return normalizeStageProgressEntries(update).reduce((total, entry) => {
    const proofItems = Array.isArray(entry.proof_items) ? entry.proof_items : []
    return total + proofItems.filter((item) => String(item.url || "").trim()).length
  }, 0)
}

function requiredStageProofCount(_items: string[]) {
  return 1
}

function hasRequiredStageProgressProof(items: string[], proofCount: number) {
  return proofCount >= requiredStageProofCount(items)
}

function canUnlockLastStageOutput(items: string[], proofCount: number) {
  if (items.length <= 0) return false
  return proofCount >= 1
}

function stageHasAllOutputsChecked(stage: StageCard & { checks?: boolean[] }) {
  const checks = normalizeStageChecks(stage.items, stage.checks)
  return stage.items.length > 0 && checks.every(Boolean)
}

function inferRepoArchetype(repo?: RepoSummary | null): RepoArchetype {
  const text = repoSignalText(repo)
  if (/\b(shop|store|cart|checkout|order|product|inventory|pos|sales)\b/.test(text)) return "ecommerce"
  if (/\b(admin|dashboard|analytics|report|monitor|crm|management|panel)\b/.test(text)) return "frontend-dashboard"
  if (/\b(portfolio|profile|resume|personal|landing)\b/.test(text)) return "portfolio-site"
  if (/\b(login|register|auth|jwt|oauth|session|role|rbac)\b/.test(text)) return "auth-system"
  if (/\b(api|backend|server|fastapi|express|rest|endpoint|microservice)\b/.test(text)) return "backend-api"
  if (/\b(data|ml|ai|machine learning|notebook|analytics|model|pandas|numpy|sklearn|tensorflow|pytorch)\b/.test(text)) return "data-ml"
  if (/\b(docker|deploy|deployment|ci|cd|pipeline|cloud|kubernetes|devops)\b/.test(text)) return "devops"
  if (/\b(mobile|android|ios|flutter|react native|kotlin|swift)\b/.test(text)) return "mobile-app"
  if (/\b(game|unity|pygame|phaser|canvas)\b/.test(text)) return "game"
  if (/\b(admin|student|teacher|faculty|library|clinic|booking|attendance|enrollment)\b/.test(text)) return "admin-system"
  return "generic-app"
}

function archetypeLabel(archetype: RepoArchetype) {
  const labels: Record<RepoArchetype, string> = {
    "frontend-dashboard": "dashboard/UI project",
    "backend-api": "backend API project",
    "data-ml": "data/ML project",
    "portfolio-site": "portfolio site",
    ecommerce: "commerce/project workflow app",
    "auth-system": "authentication system",
    "admin-system": "management system",
    "mobile-app": "mobile app",
    game: "game project",
    devops: "deployment/DevOps project",
    "generic-app": "software project",
  }
  return labels[archetype]
}

function repoEvidenceTags(repo?: RepoSummary | null) {
  const text = repoSignalText(repo)
  const archetype = inferRepoArchetype(repo)
  const tags = [archetypeLabel(archetype)]
  if (repo?.language) tags.push(repo.language)
  tags.push(...(repo?.languages || []))
  if (/\b(test|testing|pytest|jest|vitest|playwright|cypress)\b/.test(text)) tags.push("testing evidence")
  if (/\b(deploy|deployment|vercel|render|netlify|docker|ci|cd)\b/.test(text)) tags.push("deployment evidence")
  if (/\b(database|sql|postgres|mysql|mongodb|supabase|crud)\b/.test(text)) tags.push("database signal")
  if (/\b(login|register|auth|jwt|oauth|session|role|rbac)\b/.test(text)) tags.push("auth signal")
  if (Number(repo?.commitCount || 0) > 0) tags.push(`${repo?.commitCount} commits`)
  return unique(tags, 10)
}

function inferRepoTrack(repo?: RepoSummary | null) {
  const text = repoSignalText(repo)
  const archetype = inferRepoArchetype(repo)
  if (archetype === "data-ml") return "Data science / ML"
  if (archetype === "devops") return "DevOps / cloud"
  if (["backend-api", "auth-system"].includes(archetype)) return "Backend architect"
  if (/\b(devops|cloud|docker|deploy|ci|cd|linux|github actions)\b/.test(text)) return "DevOps / cloud"
  if (/\b(data|ml|ai|machine learning|notebook|analytics|model|pandas|numpy|sklearn|tensorflow|pytorch)\b/.test(text)) return "Data science / ML"
  if (/\b(api|backend|server|database|sql|auth|fastapi|express|node)\b/.test(text)) return "Backend architect"
  return "Full-stack web"
}

function inferRepoSummary(repo?: RepoSummary | null) {
  const text = repoSignalText(repo)
  const archetype = inferRepoArchetype(repo)
  const strengths: string[] = []
  const gaps: string[] = []

  if (/\b(react|vite|frontend|html|css|javascript|typescript|ui)\b/.test(text)) strengths.push("frontend/UI")
  if (/\b(api|backend|server|fastapi|express|node|auth|rest)\b/.test(text)) strengths.push("backend/API")
  if (/\b(data|ml|ai|python|notebook|analytics|model)\b/.test(text)) strengths.push("data/AI")
  if (/\b(database|sql|postgres|mysql|mongodb|supabase|crud)\b/.test(text)) strengths.push("database")
  if (!/\b(test|testing|pytest|jest|vitest|playwright|cypress)\b/.test(text)) gaps.push("testing")
  if (!/\b(deploy|deployment|vercel|render|netlify|docker|ci|cd)\b/.test(text)) gaps.push("deployment")
  if (!String(repo?.description || "").trim()) gaps.push("documentation")

  const strengthText = strengths.length ? strengths.join(" and ") : "project foundation"
  const gapText = gaps.length ? `${gaps.join(", ")} are the biggest remaining gaps` : "the next step is polish and proof"
  return `${repo?.name || "This repo"} looks like a ${archetypeLabel(archetype)} with ${strengthText} signals. ${gapText}.`
}

function fallbackMilestones(repo: RepoSummary, index: number): LearningPathStep[] {
  const text = repoSignalText(repo)
  const archetype = inferRepoArchetype(repo)
  const hasBackend = /\b(api|backend|server|fastapi|express|node|auth|rest)\b/.test(text)
  const hasData = /\b(data|ml|ai|python|notebook|analytics|model)\b/.test(text)
  const hasFrontend = /\b(react|vite|frontend|html|css|javascript|typescript|ui)\b/.test(text)

  const archetypeTasks: Record<RepoArchetype, { first: string; second: string; third: string; tags: string[] }> = {
    "frontend-dashboard": {
      first: "Polish the main dashboard workflow",
      second: "Add empty, loading, and error states",
      third: "Document dashboard screenshots and user flow",
      tags: ["dashboard", "ui"],
    },
    "backend-api": {
      first: "Build one complete REST API scenario",
      second: "Add API tests and request examples",
      third: "Document endpoints, env vars, and sample responses",
      tags: ["api", "backend"],
    },
    "data-ml": {
      first: "Show dataset, preprocessing, and model result",
      second: "Add metrics and error analysis",
      third: "Document reproducible training or inference steps",
      tags: ["data", "metrics"],
    },
    "portfolio-site": {
      first: "Turn the portfolio into a complete case study",
      second: "Add project screenshots and outcome proof",
      third: "Write skills reflection and contact-ready summary",
      tags: ["portfolio", "case-study"],
    },
    ecommerce: {
      first: "Complete the product-to-checkout flow",
      second: "Add validation for cart, orders, and inventory states",
      third: "Document sample products, roles, and transaction flow",
      tags: ["commerce", "workflow"],
    },
    "auth-system": {
      first: "Finish login, register, and protected-route flow",
      second: "Add role/security tests and failure cases",
      third: "Document auth rules, token handling, and demo accounts",
      tags: ["auth", "security"],
    },
    "admin-system": {
      first: "Complete one admin management workflow",
      second: "Add filters, validation, and audit-friendly states",
      third: "Document user roles and sample records",
      tags: ["admin", "management"],
    },
    "mobile-app": {
      first: "Complete one mobile screen-to-screen flow",
      second: "Add offline/error states and input validation",
      third: "Document screenshots and install/run steps",
      tags: ["mobile", "ux"],
    },
    game: {
      first: "Complete core game loop and win/loss state",
      second: "Add scoring, restart, and difficulty polish",
      third: "Document controls, screenshots, and gameplay rules",
      tags: ["game", "interaction"],
    },
    devops: {
      first: "Create reproducible local deployment steps",
      second: "Add CI/CD or container verification",
      third: "Document runbook, rollback, and environment config",
      tags: ["devops", "deployment"],
    },
    "generic-app": {
      first: !String(repo.description || "").trim()
        ? "Write a complete README and project description"
        : hasFrontend
          ? "Complete one polished frontend flow"
          : hasBackend
            ? "Build a tested REST API flow"
            : hasData
              ? "Add metrics and result explanation"
              : "Complete one portfolio-ready feature",
      second: hasBackend
        ? "Add API tests and request examples"
        : hasFrontend
          ? "Add loading, empty, and error states"
          : hasData
            ? "Document dataset preprocessing"
            : "Add project quality checks",
      third: "Prepare deployment or demo evidence",
      tags: ["portfolio", "project"],
    },
  }

  const taskSet = archetypeTasks[archetype]

  return [
    {
      title: taskSet.first,
      description: `Improve ${repo.name} as a ${archetypeLabel(archetype)} so reviewers can see its purpose, main flow, and output.`,
      reason: `Improve ${repo.name} as a ${archetypeLabel(archetype)} so reviewers can see its purpose, main flow, and output.`,
      status: index === 0 ? "in_progress" : "todo",
      type: "Project",
      tags: taskSet.tags,
      evidence: repoEvidenceTags(repo),
      reward_xp: 320,
    },
    {
      title: taskSet.second,
      description: `Strengthen ${repo.name} with technical proof that matches this repo's actual purpose.`,
      reason: `Strengthen ${repo.name} with technical proof that matches this repo's actual purpose.`,
      status: "todo",
      type: "Skill",
      tags: ["quality", ...taskSet.tags],
      evidence: repoEvidenceTags(repo),
      reward_xp: 280,
    },
    {
      title: taskSet.third,
      description: `Add proof that makes ${repo.name} easy to verify without guessing what it does.`,
      reason: `Add proof that makes ${repo.name} easy to verify without guessing what it does.`,
      status: "todo",
      type: "Project",
      tags: ["evidence", ...taskSet.tags],
      evidence: repoEvidenceTags(repo),
      reward_xp: 240,
    },
    {
      title: "Write portfolio reflection",
      description: `Summarize what ${repo.name} proves about your skills, limitations, and next improvement.`,
      reason: `Summarize what ${repo.name} proves about your skills, limitations, and next improvement.`,
      status: "todo",
      type: "Skill",
      tags: ["career", "documentation"],
      evidence: [repo.name],
      reward_xp: 180,
    },
  ]
}

function repoSpecificMilestones(repo: RepoSummary, index: number, generatedSteps?: LearningPathStep[]) {
  const fallback = fallbackMilestones(repo, index)
  if (!generatedSteps?.length) return fallback

  return fallback.map((step, stepIndex) => {
    const generated = generatedSteps[stepIndex]
    if (!generated) return step
    return {
      ...step,
      status: generated.status || step.status,
      reward_xp: generated.reward_xp || generated.estimated_xp || step.reward_xp,
      estimated_xp: generated.estimated_xp,
      resources: generated.resources,
      ai_explanation: generated.ai_explanation,
      progression_logic: generated.progression_logic,
      evidence: unique([...(step.evidence || []), ...(generated.evidence || [])], 8),
    }
  })
}

function stagesFor(repo: RepoSummary | undefined, milestones: LearningPathStep[]): StageCard[] {
  const repoText = repoSignalText(repo)
  const milestoneText = milestones
    .flatMap((step) => [step.title, step.description, step.reason, step.type, ...(step.tags || []), ...(step.evidence || [])])
    .join(" ")
    .toLowerCase()
  const text = `${repoText} ${milestoneText}`.trim()
  const hasFrontend = /\b(react|vite|frontend|html|css|javascript|typescript|ui)\b/.test(text)
  const hasBackend = /\b(api|backend|server|fastapi|express|node|auth|rest)\b/.test(text)
  const hasDatabase = /\b(database|sql|postgres|mysql|mongodb|supabase|crud)\b/.test(text)
  const hasTesting = /\b(test|testing|pytest|jest|vitest|playwright|cypress)\b/.test(text)
  const hasDeployment = /\b(deploy|deployment|vercel|render|netlify|docker|ci|cd)\b/.test(text)
  const hasEvidence = /\b(readme|docs|documentation|screenshot|demo|video|walkthrough|case study|portfolio)\b/.test(text)
  const hasData = /\b(data|dataset|csv|pandas|numpy|etl|preprocess|clean)\b/.test(text)
  const hasModel = /\b(model|train|training|sklearn|tensorflow|pytorch|xgboost)\b/.test(text)
  const hasMetrics = /\b(accuracy|f1|precision|recall|roc|rmse|mae|mse|bleu|rouge|bertscore|evaluation)\b/.test(text)
  const hasServing = /\b(inference|serve|endpoint|fastapi|flask|api)\b/.test(text)
  const hasInfra = /\b(terraform|kubernetes|k8s|helm|docker|ansible|aws|gcp|azure|cloudformation)\b/.test(text)
  const hasCicd = /\b(ci|cd|pipeline|github actions|gitlab|jenkins)\b/.test(text)
  const hasMonitoring = /\b(monitor|logging|metrics|alert|prometheus|grafana)\b/.test(text)
  const hasSecurity = /\b(security|secrets|vault|oauth|auth|rbac|iam|jwt)\b/.test(text)
  const milestoneDone = milestones.filter((step) => String(step.status || "").toLowerCase() === "done").length
  const milestoneTotal = milestones.length
  const milestoneRatio = milestoneTotal ? milestoneDone / milestoneTotal : 0
  const foundationDone = milestoneDone > 0
  const commitCount = Number(repo?.commitCount || 0)
  const activityBoost = Math.min(18, Math.floor(commitCount / 4))
  const milestoneBoost = Math.min(22, Math.round(milestoneRatio * 22))
  const statusFromPercent = (percent: number): StageCard["status"] => {
    if (percent >= 85) return "done"
    if (percent >= 35 || foundationDone) return "in_progress"
    return "not_started"
  }
  const progressFor = (hasSignal: boolean, baseTrue: number, baseFalse: number, boost = 0): Pick<StageCard, "status" | "percent"> => {
    const base = hasSignal ? baseTrue : baseFalse
    const percent = clamp(base + activityBoost + milestoneBoost + boost)
    return { status: statusFromPercent(percent), percent }
  }
  const stageTwoState = (hasSignal: boolean) => {
    const base = progressFor(hasSignal, 62, 26, foundationDone ? 8 : 0)
    if (!foundationDone) return base
    const percent = Math.max(base.percent, 40)
    return { status: statusFromPercent(percent), percent }
  }
  const frontendResources = hasFrontend ? combineResources(STAGE_RESOURCES.frontend, STAGE_RESOURCES.uiux) : STAGE_RESOURCES.feature
  const backendResources = hasBackend
    ? combineResources(STAGE_RESOURCES.backend, inferRepoArchetype(repo) === "auth-system" ? STAGE_RESOURCES.auth : STAGE_RESOURCES.architecture)
    : STAGE_RESOURCES.architecture
  const track = inferRepoTrack(repo)
  const foundationPercent = clamp((foundationDone ? 70 : 35) + activityBoost + (hasEvidence ? 10 : 0))
  const baseStage: StageCard = {
    title: "Scope & foundation",
    summary: "Clarify what this repository is solving, who it is for, and what proof reviewers should see before they judge the implementation.",
    status: foundationPercent >= 85 ? "done" : "in_progress",
    percent: foundationPercent,
    items: unique(
      [
        "Write a clear problem statement that explains the purpose of the project in simple terms.",
        "List the target users, their main workflow, and what success should look like when they use it.",
        "Complete the repository setup, README, and project overview so the project is easy to understand at first glance.",
      ],
      3
    ),
    resources: STAGE_RESOURCES.foundation,
  }

  if (track === "Data science / ML") {
    return [
      baseStage,
      {
        title: "Data pipeline & prep",
        summary: "Explain where the data comes from, how it is cleaned, and how the final dataset is prepared before any model training starts.",
        ...stageTwoState(hasData),
        items: unique(
          [
            "Prepare a dataset inventory that explains each source file, feature, and target column being used.",
            "Document the cleaning and preprocessing steps so the transformation from raw data to usable data is easy to follow.",
            "Show the train and validation split strategy together with the reason for choosing it.",
          ],
          3
        ),
        resources: combineResources(STAGE_RESOURCES.dataPrep, STAGE_RESOURCES.data),
      },
      {
        title: "Model build",
        summary: "Create a baseline model and make the training process reproducible so another reviewer can rerun it without guessing.",
        ...progressFor(hasModel, 60, 25),
        items: unique(
          [
            "Build a baseline model that can serve as the first measurable version of the solution.",
            "Provide a training script or notebook that shows the full training flow from input to output.",
            "List the final features or inputs used by the model and why they were selected.",
          ],
          3
        ),
        resources: combineResources(STAGE_RESOURCES.modeling, STAGE_RESOURCES.data),
      },
      {
        title: "Evaluation & iteration",
        summary: "Prove whether the model is working by showing evaluation metrics, validation results, and a short explanation of weak spots.",
        ...progressFor(hasMetrics, 55, 20),
        items: unique(
          [
            "Prepare a metrics table that clearly shows how the model performs on the chosen evaluation criteria.",
            "Summarize the validation results so reviewers can see whether the model generalizes beyond the training data.",
            "Add an error analysis note that explains common mistakes, limitations, or areas that still need improvement.",
          ],
          3
        ),
        resources: combineResources(STAGE_RESOURCES.evaluation, STAGE_RESOURCES.testing),
      },
      {
        title: "Serving & integration",
        summary: "Turn the model output into something usable, whether through a script, notebook workflow, or API endpoint.",
        ...progressFor(hasServing, 50, 20),
        items: unique(
          [
            "Create an inference script or endpoint that can run predictions using new input data.",
            "Explain how the model is used in batch processing, notebooks, or an application workflow.",
            "Write short integration notes so another developer can connect the model to the rest of the system.",
          ],
          3
        ),
        resources: STAGE_RESOURCES.backend,
      },
      {
        title: "Deployment proof",
        summary: "Show a reliable way to run or deploy the model so the output can be verified outside your own device.",
        ...progressFor(hasDeployment, 60, 20),
        items: unique(
          [
            "Write reproducible run steps so the project can be launched again without missing dependencies or hidden setup.",
            "Provide a demo link, sample output, or video walkthrough that proves the model can actually be used.",
            "List the environment setup notes, package requirements, and configuration needed for deployment.",
          ],
          3
        ),
        resources: STAGE_RESOURCES.deployment,
      },
      {
        title: "Evidence & reflection",
        summary: "Gather evidence that proves the work is real and add reflection notes that explain what was learned from the project.",
        ...progressFor(hasEvidence, 55, 20),
        items: unique(
          [
            "Collect screenshots, plots, or artifacts that help reviewers verify the results quickly.",
            "Record a demo video or walkthrough that shows the project working from start to finish.",
            "Write a reflection that explains the main lessons, limitations, and next improvement targets.",
          ],
          3
        ),
        resources: STAGE_RESOURCES.evidence,
      },
    ]
  }

  if (track === "DevOps / cloud") {
    return [
      baseStage,
      {
        title: "Infrastructure build",
        summary: "Define the infrastructure setup clearly so the environment can be rebuilt without relying on manual steps.",
        ...stageTwoState(hasInfra),
        items: unique(
          [
            "Prepare infrastructure code that defines the core services, runtime, and deployment dependencies.",
            "Create a container build or environment setup that can be reproduced consistently across machines.",
            "Document the cloud or hosting configuration that supports the application lifecycle.",
          ],
          3
        ),
        resources: combineResources(STAGE_RESOURCES.devops, STAGE_RESOURCES.architecture),
      },
      {
        title: "CI/CD automation",
        summary: "Show that the project can build, test, and deploy through a repeatable automation workflow instead of manual release steps.",
        ...progressFor(hasCicd, 60, 25),
        items: unique(
          [
            "Set up a pipeline that runs the key build, test, and validation tasks automatically.",
            "Explain the build and test steps so reviewers can see what quality checks happen before release.",
            "Document the deployment rules, triggers, or release conditions used by the workflow.",
          ],
          3
        ),
        resources: combineResources(STAGE_RESOURCES.devops, STAGE_RESOURCES.testing),
      },
      {
        title: "Observability & security",
        summary: "Add monitoring, logs, and access control so the system is easier to operate, inspect, and protect in production.",
        ...progressFor(hasMonitoring || hasSecurity, 55, 20),
        items: unique(
          [
            "Set up metrics and logs that help explain the current health and behavior of the service.",
            "Define alerts or warning signals that show when failures, slowdowns, or unusual events happen.",
            "Document the access control, secret handling, or role-based restrictions protecting the system.",
          ],
          3
        ),
        resources: combineResources(STAGE_RESOURCES.monitoring, STAGE_RESOURCES.security),
      },
      {
        title: "Deployment proof",
        summary: "Document how the service is released, how it can be rolled back, and how a reviewer can access the live environment.",
        ...progressFor(hasDeployment, 60, 20),
        items: unique(
          [
            "Prepare a short runbook that explains the release flow from start to finish.",
            "Include rollback steps so service recovery is possible when a bad deployment happens.",
            "Provide the service URL or deployment target together with the context needed to verify it.",
          ],
          3
        ),
        resources: STAGE_RESOURCES.deployment,
      },
      {
        title: "Evidence & reflection",
        summary: "Capture proof from the deployment lifecycle and explain what the team learned from building and operating it.",
        ...progressFor(hasEvidence, 55, 20),
        items: unique(
          [
            "Collect screenshots, logs, or dashboards that prove the deployment and automation are working.",
            "Record a walkthrough or demo video showing the infrastructure or pipeline in action.",
            "Write a reflection about the main operational lessons, blockers, and next improvements.",
          ],
          3
        ),
        resources: STAGE_RESOURCES.evidence,
      },
    ]
  }

  if (track === "Backend architect") {
    return [
      baseStage,
      {
        title: inferRepoArchetype(repo) === "auth-system" ? "Auth scope & core build" : "API scope & core build",
        summary: "Deliver a complete auth or API flow and make the request, validation, and response behavior easy to understand.",
        ...stageTwoState(hasBackend),
        items: unique(
          inferRepoArchetype(repo) === "auth-system"
            ? [
                "Implement the login and registration flow so account access can be tested end to end.",
                "Show how JWTs, sessions, or tokens are issued, validated, and used during requests.",
                "Explain the role checks or permission logic protecting sensitive routes and actions.",
              ]
            : [
                "Build the core endpoints and show what each route is expected to receive and return.",
                "Add validation rules so incorrect or incomplete input is handled in a predictable way.",
                "Document the error handling behavior so failures are easier to debug and review.",
              ],
          3
        ),
        resources: inferRepoArchetype(repo) === "auth-system"
          ? combineResources(STAGE_RESOURCES.backend, STAGE_RESOURCES.auth)
          : STAGE_RESOURCES.backend,
      },
      {
        title: "Data layer & migrations",
        summary: "Define the schema, migration flow, and database interactions so the backend structure is easy to inspect and maintain.",
        ...progressFor(hasDatabase, 55, 20),
        items: unique(
          [
            "Design the schema so the key entities, relationships, and constraints are clearly represented.",
            "Include migrations or setup steps that keep the database structure reproducible over time.",
            "Show the CRUD flow so reviewers can follow how data is created, updated, retrieved, and deleted.",
          ],
          3
        ),
        resources: STAGE_RESOURCES.database,
      },
      {
        title: "Quality, security & reliability",
        summary: "Prove that the backend is reliable by showing tests, security rules, and operational safeguards around the service.",
        ...progressFor(hasTesting || hasSecurity || hasMonitoring, 55, 20),
        items: unique(
          [
            "Add tests that prove the critical routes, validations, and edge cases behave correctly.",
            "Document the authentication and authorization rules that protect users and system actions.",
            "Show the logging, rate limits, or monitoring practices that improve service reliability.",
          ],
          3
        ),
        resources: combineResources(STAGE_RESOURCES.testing, STAGE_RESOURCES.security),
      },
      {
        title: "Deployment proof",
        summary: "Ship a live API and explain how it is configured, deployed, and verified in a real environment.",
        ...progressFor(hasDeployment, 60, 20),
        items: unique(
          [
            "Provide the service URL or deployment target so the API can be reviewed outside the local machine.",
            "Explain the environment configuration and secrets setup needed for the deployed service.",
            "Show how monitoring or health checks confirm that the deployment is stable.",
          ],
          3
        ),
        resources: STAGE_RESOURCES.deployment,
      },
      {
        title: "Evidence & reflection",
        summary: "Document the final outcomes, supporting evidence, and the lessons learned from building the backend workflow.",
        ...progressFor(hasEvidence, 55, 20),
        items: unique(
          [
            "Collect screenshots, logs, or API samples that prove the backend behavior is working as described.",
            "Record a demo or walkthrough that shows the flow from request to response.",
            "Write a reflection on the main implementation lessons, weaknesses, and next fixes.",
          ],
          3
        ),
        resources: STAGE_RESOURCES.evidence,
      },
    ]
  }

  const archetype = inferRepoArchetype(repo)
  const frontendStageTitle: Record<RepoArchetype, string> = {
    "frontend-dashboard": "Experience & dashboard flow",
    "backend-api": "Client experience proof",
    "data-ml": "Results narrative",
    "portfolio-site": "Storytelling & layout",
    ecommerce: "Customer journey flow",
    "auth-system": "Auth UX flow",
    "admin-system": "Admin UX flow",
    "mobile-app": "Mobile UX flow",
    game: "Game loop & UX",
    devops: "Platform walkthrough",
    "generic-app": hasFrontend ? "Experience & feature flow" : "Core feature flow",
  }
  const backendStageTitle: Record<RepoArchetype, string> = {
    "frontend-dashboard": "Integration & data",
    "backend-api": "Integration & data",
    "data-ml": "Integration & data",
    "portfolio-site": "Content structure",
    ecommerce: "Orders & inventory",
    "auth-system": "Access logic & sessions",
    "admin-system": "Management logic",
    "mobile-app": "Sync & state",
    game: "Game state logic",
    devops: "Service orchestration",
    "generic-app": hasBackend || hasDatabase ? "Integration & data" : "Architecture depth",
  }
  const hasIntegration = hasBackend || hasDatabase
  const integrationResources = hasBackend
    ? backendResources
    : hasDatabase
      ? combineResources(STAGE_RESOURCES.database, STAGE_RESOURCES.architecture)
      : STAGE_RESOURCES.architecture

  return [
    baseStage,
    {
      title: frontendStageTitle[archetype],
      summary: "Deliver the main user flow clearly so a reviewer can understand how a user starts, interacts with, and completes the core experience.",
      ...stageTwoState(hasFrontend),
      items: unique(
        hasFrontend
          ? [
              "Build the primary flow that shows how a user enters the feature and reaches the intended result.",
              "Make the layout responsive and readable so the interface still works well on different screen sizes.",
              "Explain the state handling or UI logic that keeps the experience stable during interaction.",
            ]
          : [
              "Show the core feature clearly so the reviewer understands the most important part of the project.",
              "Use the README and screen-by-screen notes to explain what the project currently supports.",
              "Add screenshots or visual proof that make the project easier to inspect without running it first.",
            ],
        3
      ),
      resources: frontendResources,
    },
    {
      title: backendStageTitle[archetype],
      summary: "Show the data flow or service integration behind the experience so the project feels complete and technically believable.",
      ...progressFor(hasIntegration, 65, 25),
      items: unique(
        hasBackend
          ? [
              "Map the request flow so it is clear how the UI talks to the backend or service layer.",
              "Show the validation rules that prevent broken or incomplete data from moving through the system.",
              "Explain the error handling so failures still produce understandable outcomes for the user.",
            ]
          : hasDatabase
            ? [
                "Show the schema and data structure that support the main features of the project.",
                "Explain the CRUD flow so reviewers can follow how records move through the system.",
                "Provide sample data or examples that make the database usage easier to understand.",
              ]
            : [
                "Write an integration plan that explains how external data or services fit into the project.",
                "Show proof that the data flow or system output is connected to something real and testable.",
                "Add service notes or architecture notes that explain the hidden technical layer behind the interface.",
              ],
        3
      ),
      resources: integrationResources,
    },
    {
      title: "Quality & testing",
      summary: "Increase trust in the project by showing tests, edge cases, and quality checks that reduce reviewer doubt.",
      ...progressFor(hasTesting, 45, 15),
      items: unique(
        hasTesting
          ? [
              "Add unit or functional tests that prove the most important logic works correctly.",
              "Include the test command or workflow so the reviewer can rerun the checks without guessing.",
              "Write short quality notes that explain what has already been tested and what still needs coverage.",
            ]
          : [
              "Prepare a simple test plan that explains what parts of the project should be checked first.",
              "List the common edge cases or failure scenarios that users or reviewers should watch for.",
              "Add run instructions so the project can still be checked even if full automated tests are missing.",
            ],
        3
      ),
      resources: combineResources(STAGE_RESOURCES.testing, hasFrontend ? STAGE_RESOURCES.uiux : STAGE_RESOURCES.feature),
    },
    {
      title: "Deployment proof",
      summary: "Provide a live demo or a repeatable run path so the project can be verified outside the development setup.",
      ...progressFor(hasDeployment, 60, 20),
      items: unique(
        hasDeployment
          ? [
              "Share the live link or deployed environment so the reviewer can inspect the finished result directly.",
              "Explain the environment notes and configuration needed to keep the deployment working.",
              "Show the CI/CD or deployment flow that keeps updates repeatable and controlled.",
            ]
          : [
              "Provide the local run command or startup steps needed to open the project correctly.",
              "Add a demo link, screenshot sequence, or short walkthrough that proves the main features are usable.",
              "Include an environment example so another user knows what variables or setup are expected.",
            ],
        3
      ),
      resources: STAGE_RESOURCES.deployment,
    },
    {
      title: "Evidence & reflection",
      summary: "Capture proof of what was built, explain the outcomes, and record the next improvements that would make the project stronger.",
      ...progressFor(hasEvidence, 55, 20),
      items: unique(
        [
          "Collect screenshots or artifacts that give quick visual proof of the finished features.",
          "Record a demo video or walkthrough so the full user flow can be understood in sequence.",
          "Write a reflection and feedback note describing the strongest part of the project and what should improve next.",
        ],
        3
      ),
      resources: STAGE_RESOURCES.evidence,
    },
  ]
}

function stageStyles(status: StageCard["status"]) {
  if (status === "complete_stage") return {
    border: "border-[#166534]",
    badge: "bg-[#dcfce7] text-[#166534]",
    bar: "bg-[#15803d]",
    accent: "bg-gradient-to-r from-[#166534] via-[#22c55e] to-[#86efac]",
  }
  if (status === "done") return {
    border: "border-[#2f7d32]",
    badge: "bg-[#dfeeda] text-[#2f6b2f]",
    bar: "bg-[#17a267]",
    accent: "bg-gradient-to-r from-[#0f766e] via-[#22c55e] to-[#84cc16]",
  }
  if (status === "in_progress") return {
    border: "border-[#3182e8]",
    badge: "bg-[#dbeafe] text-[#1d5fae]",
    bar: "bg-[#f59e0b]",
    accent: "bg-gradient-to-r from-[#2563eb] via-[#60a5fa] to-[#f59e0b]",
  }
  return {
    border: "border-[#d6dce8]",
    badge: "bg-[#eeeeea] text-[#666b62]",
    bar: "bg-[#8d9189]",
    accent: "bg-gradient-to-r from-[#cbd5e1] via-[#e2e8f0] to-[#e2e8f0]",
  }
}

function stageLabel(status: StageCard["status"]) {
  if (status === "complete_stage") return "Complete stage"
  if (status === "done") return "Done"
  if (status === "in_progress") return "Ongoing"
  return "Not started"
}

function normalizeStageStatusValue(value?: string | null): StageCard["status"] {
  const normalized = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_")
  if (normalized === "complete" || normalized === "completed" || normalized === "complete_stage") return "complete_stage"
  if (normalized === "done") return "done"
  if (normalized === "ongoing" || normalized === "on_going" || normalized === "in_progress") return "in_progress"
  return "not_started"
}

function isStageDoneLike(status: StageCard["status"]) {
  return status === "done" || status === "complete_stage"
}

function normalizeStorageKey(value?: string | null) {
  return String(value || "").trim().toLowerCase()
}

function getRecordValue<T>(record: Record<string, T> | undefined | null, key?: string | null) {
  if (!record || !key) return undefined
  if (Object.prototype.hasOwnProperty.call(record, key)) return record[key]
  const normalizedKey = normalizeStorageKey(key)
  const matchedKey = Object.keys(record).find((item) => normalizeStorageKey(item) === normalizedKey)
  return matchedKey ? record[matchedKey] : undefined
}

function readStoredStageStatuses() {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(STAGE_STATUS_STORAGE_KEY)
    return raw ? JSON.parse(raw) as Record<string, Record<string, Record<string, StageCard["status"]>>> : {}
  } catch {
    return {}
  }
}

function readStoredStageChecks() {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(STAGE_CHECK_STORAGE_KEY)
    return raw ? JSON.parse(raw) as Record<string, Record<string, Record<string, boolean[]>>> : {}
  } catch {
    return {}
  }
}

function readStoredStageProofStatus() {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(STAGE_PROOF_STATUS_KEY)
    return raw ? JSON.parse(raw) as Record<string, Record<string, Record<string, number>>> : {}
  } catch {
    return {}
  }
}

function normalizeStageChecks(items: string[], checks?: boolean[]) {
  return items.map((_, index) => Boolean(checks?.[index]))
}

function evidenceItemKey(item: Pick<EvidenceItem, "name" | "url">) {
  return `${item.name}-${item.url}`
}

function evidenceKindLabel(kind: EvidenceKind) {
  if (kind === "image") return "Image"
  if (kind === "video") return "Video"
  if (kind === "pdf") return "PDF"
  return "File"
}

function evidenceKindFromUrl(url: string): EvidenceKind {
  const cleanUrl = String(url || "").trim().toLowerCase()
  if (!cleanUrl) return "file"
  if (/\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/.test(cleanUrl)) return "image"
  if (/\.(mp4|webm|mov|avi|mkv)(\?|#|$)/.test(cleanUrl)) return "video"
  if (/\.pdf(\?|#|$)/.test(cleanUrl)) return "pdf"
  return "file"
}

function proofNameFromUrl(url: string, fallback: string) {
  const trimmed = String(url || "").trim()
  if (!trimmed) return fallback
  const cleanUrl = trimmed.split("?")[0].split("#")[0]
  const rawName = cleanUrl.split("/").filter(Boolean).pop() || ""
  if (!rawName) return fallback
  try {
    return decodeURIComponent(rawName) || fallback
  } catch {
    return rawName || fallback
  }
}

function cleanProofName(value?: string | null, fallback?: string | null) {
  const trimmed = String(value || "").trim()
  if (trimmed) return trimmed
  return String(fallback || "").trim()
}

function buildProofLinkItem(rawName: string, rawUrl: string, fallbackLabel: string) {
  const url = String(rawUrl || "").trim()
  if (!/^https?:\/\//i.test(url)) return null
  return {
    name: cleanProofName(rawName, proofNameFromUrl(url, fallbackLabel)),
    url,
    kind: evidenceKindFromUrl(url),
  }
}

function collectRepoShowcaseItems(
  project?: ProjectLearningPathResponse["projects"][number] | null,
  repo?: RepoSummary | null
) {
  const items: RepoShowcaseItem[] = []
  if (repo?.htmlUrl) {
    items.push({
      name: `${repo.name} GitHub repository`,
      url: repo.htmlUrl,
      kind: "repo",
      source: "Full working system",
    })
  }
  const updates = project?.stage_progress_updates || {}
  Object.entries(updates).forEach(([stageTitle, update]) => {
    const archivedProofItems = normalizeStageProgressEntries(update as Record<string, unknown>).flatMap((entry) => entry.proof_items || [])
    archivedProofItems.forEach((item, index) => {
      const url = String(item?.url || "").trim()
      if (!url) return
      items.push({
        name: String(item?.name || `${stageTitle} proof ${index + 1}`),
        url,
        kind: item?.kind === "image" || item?.kind === "video" || item?.kind === "pdf" || item?.kind === "file"
          ? item.kind
          : evidenceKindFromUrl(url),
        source: stageTitle,
        stageTitle,
      })
    })
    const finalProofItems = Array.isArray((update as Record<string, unknown>).final_proof_items)
      ? ((update as Record<string, unknown>).final_proof_items as Array<{ name?: string; url?: string; kind?: string | null }>)
      : []
    finalProofItems.forEach((item, index) => {
      const url = String(item?.url || "").trim()
      if (!url) return
      items.push({
        name: String(item?.name || `${stageTitle} final proof ${index + 1}`),
        url,
        kind: item?.kind === "image" || item?.kind === "video" || item?.kind === "pdf" || item?.kind === "file"
          ? item.kind
          : evidenceKindFromUrl(url),
        source: `${stageTitle} final evidence`,
        stageTitle,
      })
    })
  })
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${item.kind}|${item.url}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function progressProofLabel(items?: Array<{ name?: string | null }>, fallback?: string) {
  const proofItems = Array.isArray(items) ? items : []
  const firstName = String(proofItems[0]?.name || "").trim()
  if (proofItems.length <= 1) return firstName || fallback || "Update"
  return `${firstName || fallback || "Update"} +${proofItems.length - 1} more`
}

function summarizeEvidenceKinds(items: Array<{ kind?: string | null }>) {
  const counts = {
    image: 0,
    video: 0,
    pdf: 0,
    file: 0,
  }
  items.forEach((item) => {
    const kind = String(item.kind || "file").trim().toLowerCase()
    if (kind === "image") counts.image += 1
    else if (kind === "video") counts.video += 1
    else if (kind === "pdf") counts.pdf += 1
    else counts.file += 1
  })
  return [
    counts.video ? `${counts.video} video${counts.video === 1 ? "" : "s"}` : "",
    counts.image ? `${counts.image} image${counts.image === 1 ? "" : "s"}` : "",
    counts.pdf ? `${counts.pdf} pdf${counts.pdf === 1 ? "" : "s"}` : "",
    counts.file ? `${counts.file} file${counts.file === 1 ? "" : "s"}` : "",
  ].filter(Boolean).join(", ")
}

function formatRealtimeStamp(value?: string | null) {
  if (!value) return "-"
  const normalized = /z$|[+-]\d{2}:\d{2}$/i.test(value) ? value : `${value}Z`
  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function normalizeReviewStatus(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase()
  if (normalized === "accepted") return "accepted"
  if (normalized === "rejected") return "rejected"
  return "pending"
}

function reviewStatusMeta(value?: string | null) {
  const status = normalizeReviewStatus(value)
  if (status === "accepted") return { label: "Accepted", className: "border-[#bbf7d0] bg-[#ecfdf3] text-[#166534]" }
  if (status === "rejected") return { label: "Rejected", className: "border-[#fecaca] bg-[#fff1f2] text-[#b42318]" }
  return { label: "Pending", className: "border-[#fde68a] bg-[#fffbeb] text-[#b45309]" }
}

type LearningPathsPageProps = {
  adminView?: boolean
  adminUsername?: string
  embedded?: boolean
  onClose?: () => void
}

export default function LearningPathsPage({ adminView = false, adminUsername, embedded = false, onClose }: LearningPathsPageProps) {
  const auth = getStoredAuth()
  const adminAuth = getStoredAdminAuth()
  const { username: routeUsername } = useParams()
  const targetUsername = adminView ? adminUsername || routeUsername || "" : auth.username
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null)
  const [projectPaths, setProjectPaths] = useState<ProjectLearningPathResponse | null>(null)
  const [selectedRepo, setSelectedRepo] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [projectPathError, setProjectPathError] = useState("")
  const [recomputing, setRecomputing] = useState(false)
  const [evidenceByRepo, setEvidenceByRepo] = useState<Record<string, EvidenceItem[]>>({})
  const [evidenceNameDraftByRepo, setEvidenceNameDraftByRepo] = useState<Record<string, string>>({})
  const [evidenceLinkDraftByRepo, setEvidenceLinkDraftByRepo] = useState<Record<string, string>>({})
  const [stageUpdateCommentByRepo, setStageUpdateCommentByRepo] = useState<Record<string, Record<string, string>>>({})
  const [stageUpdateFilesByRepo, setStageUpdateFilesByRepo] = useState<Record<string, Record<string, EvidenceItem[]>>>({})
  const [stageUpdateLinkNameDraftByRepo, setStageUpdateLinkNameDraftByRepo] = useState<Record<string, Record<string, string>>>({})
  const [stageUpdateLinkDraftByRepo, setStageUpdateLinkDraftByRepo] = useState<Record<string, Record<string, string>>>({})
  const [savingStageUpdateKey, setSavingStageUpdateKey] = useState("")
  const [savingAdminFeedbackKey, setSavingAdminFeedbackKey] = useState("")
  const [savingStudentReplyKey, setSavingStudentReplyKey] = useState("")
  const [savingEvidenceRepoKey, setSavingEvidenceRepoKey] = useState("")
  const [deletingProgressUpdateKey, setDeletingProgressUpdateKey] = useState("")
  const [deletingAdminCommentKey, setDeletingAdminCommentKey] = useState("")
  const [deletingStudentReplyKey, setDeletingStudentReplyKey] = useState("")
  const [claimingRepoRewardKey, setClaimingRepoRewardKey] = useState("")
  const [busyStageKeys, setBusyStageKeys] = useState<Record<string, boolean>>({})
  const [adminFeedbackDraftByRepo, setAdminFeedbackDraftByRepo] = useState<Record<string, Record<string, string>>>({})
  const [studentReplyDraftByRepo, setStudentReplyDraftByRepo] = useState<Record<string, Record<string, string>>>({})
  const [feedbackToast, setFeedbackToast] = useState("")
  const [stageUpdateToast, setStageUpdateToast] = useState("")
  const [stageStatusByRepo, setStageStatusByRepo] = useState<Record<string, Record<string, StageCard["status"]>>>({})
  const [stageChecksByRepo, setStageChecksByRepo] = useState<Record<string, Record<string, boolean[]>>>({})
  const [stageProofStatusByRepo, setStageProofStatusByRepo] = useState<Record<string, Record<string, number>>>({})
  const [unlockAnimationsByRepo, setUnlockAnimationsByRepo] = useState<Record<string, Record<string, boolean>>>({})
  const [warningStageItemsByRepo, setWarningStageItemsByRepo] = useState<Record<string, Record<string, Record<number, boolean>>>>({})
  const [proofViewer, setProofViewer] = useState<ProofViewerState | null>(null)
  const [expandedProofItem, setExpandedProofItem] = useState<ProofViewerState["proofItems"][number] | null>(null)
  const [adminFeedbackViewer, setAdminFeedbackViewer] = useState<AdminFeedbackViewerState | null>(null)
  const [showStudentGuide, setShowStudentGuide] = useState(false)
  const [notificationVersion, setNotificationVersion] = useState(0)
  const unlockTimersRef = useRef<Record<string, number>>({})
  const warningStageItemTimersRef = useRef<Record<string, number>>({})
  const prevLockedByRepoRef = useRef<Record<string, Record<string, boolean>>>({})
  const prevLastStageDoneByRepoRef = useRef<Record<string, boolean>>({})
  const previousUnreadNotificationCountRef = useRef(0)
  const recomputingRef = useRef(false)
  const optimisticStageChecksRef = useRef<Record<string, boolean[]>>({})
  const storageUsernameKey = normalizeStorageKey(portfolio?.profile?.username || targetUsername)

  function bumpNotificationVersion() {
    setNotificationVersion((current) => current + 1)
  }

  function getCurrentStageUpdate(repoName: string, stageTitle: string) {
    const project = projectPaths?.projects?.find(
      (item) => normalizeStorageKey(item.repo_name) === normalizeStorageKey(repoName)
    )
    return getRecordValue<Record<string, unknown>>(
      project?.stage_progress_updates as Record<string, Record<string, unknown>> | undefined,
      stageTitle
    )
  }

  function stageStateKey(repoName: string, stageTitle: string) {
    return `${normalizeStorageKey(repoName)}::${normalizeStorageKey(stageTitle)}`
  }

  function stageItemWarningKey(repoName: string, stageTitle: string, itemIndex: number) {
    return `${stageStateKey(repoName, stageTitle)}::${itemIndex}`
  }

  function triggerStageItemWarning(repoName: string, stageTitle: string, itemIndex: number) {
    const timerKey = stageItemWarningKey(repoName, stageTitle, itemIndex)
    const existingTimer = warningStageItemTimersRef.current[timerKey]
    if (existingTimer) {
      window.clearTimeout(existingTimer)
    }
    setWarningStageItemsByRepo((prev) => ({
      ...prev,
      [repoName]: {
        ...(prev[repoName] || {}),
        [stageTitle]: {
          ...((prev[repoName] || {})[stageTitle] || {}),
          [itemIndex]: false,
        },
      },
    }))
    window.requestAnimationFrame(() => {
      setWarningStageItemsByRepo((prev) => ({
        ...prev,
        [repoName]: {
          ...(prev[repoName] || {}),
          [stageTitle]: {
            ...((prev[repoName] || {})[stageTitle] || {}),
            [itemIndex]: true,
          },
        },
      }))
    })
    warningStageItemTimersRef.current[timerKey] = window.setTimeout(() => {
      setWarningStageItemsByRepo((prev) => ({
        ...prev,
        [repoName]: {
          ...(prev[repoName] || {}),
          [stageTitle]: {
            ...((prev[repoName] || {})[stageTitle] || {}),
            [itemIndex]: false,
          },
        },
      }))
      delete warningStageItemTimersRef.current[timerKey]
    }, 460)
  }

  function getResolvedStageChecks(repoName: string, stageTitle: string, items: string[]) {
    const optimisticChecks = optimisticStageChecksRef.current[stageStateKey(repoName, stageTitle)]
    if (optimisticChecks) {
      return normalizeStageChecks(items, optimisticChecks)
    }
    const localChecks = stageChecksByRepo[repoName]?.[stageTitle]
    const project = projectPaths?.projects?.find(
      (item) => normalizeStorageKey(item.repo_name) === normalizeStorageKey(repoName)
    )
    const backendChecks = getRecordValue(project?.stage_checks, stageTitle)
    return normalizeStageChecks(items, localChecks || backendChecks)
  }

  function markCurrentStageNotificationsSeen(repoName: string, stageTitle: string) {
    const update = getCurrentStageUpdate(repoName, stageTitle)
    const latestTimestamp = adminView
      ? getLatestAdminStageNotificationTimestamp(update)
      : getLatestStudentStageNotificationTimestamp(update)
    if (!latestTimestamp || !targetUsername) return
    markStageNotificationsSeen(adminView ? "admin" : "student", targetUsername, repoName, stageTitle, latestTimestamp)
    bumpNotificationVersion()
  }

  function markCurrentProofNotificationsSeen(repoName: string, stageTitle: string, proofUrl?: string | null) {
    const update = getCurrentStageUpdate(repoName, stageTitle)
    const latestTimestamp = adminView
      ? getLatestAdminProofNotificationTimestamp(update, proofUrl)
      : getLatestStudentProofNotificationTimestamp(update, proofUrl)
    if (!latestTimestamp || !targetUsername || !proofUrl) return
    markProofNotificationsSeen(adminView ? "admin" : "student", targetUsername, repoName, stageTitle, proofUrl, latestTimestamp)
    bumpNotificationVersion()
  }

  function getProofViewerUrls(viewer: ProofViewerState) {
    const urls = new Set<string>()
    viewer.proofItems.forEach((item) => {
      const url = String(item.url || "").trim()
      if (url) urls.add(url)
    })
    ;(viewer.progressEntries || []).forEach((entry) => {
      ;(entry.proof_items || []).forEach((item) => {
        const url = String(item.url || "").trim()
        if (url) urls.add(url)
      })
    })
    return Array.from(urls)
  }

  function openProofViewer(nextViewer: ProofViewerState) {
    setProofViewer(nextViewer)
    markCurrentStageNotificationsSeen(nextViewer.repoName, nextViewer.stageTitle)
    const proofUrls = getProofViewerUrls(nextViewer)
    proofUrls.forEach((proofUrl) => {
      markCurrentProofNotificationsSeen(nextViewer.repoName, nextViewer.stageTitle, proofUrl)
    })
  }

  function openFinalStageProofViewer(repoName: string, stageTitle: string, update?: Record<string, unknown> | null) {
    const thread = Array.isArray(update?.admin_feedback_thread)
      ? (update.admin_feedback_thread as ProofViewerState["adminFeedbackThread"])
      : []
    const byProof = update?.admin_feedback_by_proof && typeof update.admin_feedback_by_proof === "object"
      ? (update.admin_feedback_by_proof as ProofViewerState["adminFeedbackByProof"])
      : {}
    const proofItems = Array.isArray(update?.final_proof_items)
      ? (update.final_proof_items as ProofViewerState["proofItems"])
      : []
    openProofViewer({
      repoName,
      stageTitle,
      proofLabel: "Final stage proof",
      fallbackMessage: "Final evidence bundle submitted from Evidence Files.",
      comment: typeof update?.comment === "string" ? update.comment : "Final evidence bundle submitted from Evidence Files.",
      proofItems,
      reviewStatus: typeof update?.review_status === "string" ? update.review_status : "pending",
      reviewStatusUpdatedAt: typeof update?.review_status_updated_at === "string" ? update.review_status_updated_at : null,
      updatedAt: typeof update?.updated_at === "string" ? update.updated_at : null,
      adminFeedback: typeof update?.admin_feedback === "string" ? update.admin_feedback : null,
      adminFeedbackBy: typeof update?.admin_feedback_by === "string" ? update.admin_feedback_by : null,
      adminFeedbackUpdatedAt: typeof update?.admin_feedback_updated_at === "string" ? update.admin_feedback_updated_at : null,
      adminFeedbackThread: thread,
      adminFeedbackByProof: byProof,
    })
  }

  function syncStageTrackingFromProjectPaths(projectPath: ProjectLearningPathResponse) {
    setStageStatusByRepo(() => {
      const next: Record<string, Record<string, StageCard["status"]>> = {}
      ;(projectPath.projects || []).forEach((project) => {
        const statuses: Record<string, StageCard["status"]> = {}
        Object.entries(project.stage_status_overrides || {}).forEach(([stageTitle, status]) => {
          statuses[stageTitle] = normalizeStageStatusValue(String(status || ""))
        })
        next[project.repo_name] = statuses
      })
      return next
    })
    setStageChecksByRepo(() => {
      const next: Record<string, Record<string, boolean[]>> = {}
      ;(projectPath.projects || []).forEach((project) => {
        next[project.repo_name] = project.stage_checks || {}
      })
      return next
    })
    setStageProofStatusByRepo(() => {
      const next: Record<string, Record<string, number>> = {}
      ;(projectPath.projects || []).forEach((project) => {
        const counts: Record<string, number> = { ...(project.stage_proof_counts || {}) }
        Object.entries(project.stage_progress_updates || {}).forEach(([stageTitle, update]) => {
          const progressProofCount = countSavedStageProgressProofItems(update as Record<string, unknown>)
          counts[stageTitle] = Math.max(Number(counts[stageTitle] || 0), progressProofCount)
        })
        next[project.repo_name] = counts
      })
      return next
    })
  }

  function patchProjectPathStageState(
    repoName: string,
    stageTitle: string,
    nextStatus: StageCard["status"],
    options: { checks?: boolean[]; proofCount?: number } = {}
  ) {
    setProjectPaths((prev) => {
      if (!prev?.projects?.length) return prev
      let changed = false
      const nextProjects = prev.projects.map((project) => {
        if (normalizeStorageKey(project.repo_name) !== normalizeStorageKey(repoName)) {
          return project
        }
        changed = true
        const nextStageStatusOverrides = {
          ...(project.stage_status_overrides || {}),
          [stageTitle]: nextStatus,
        }
        const nextStageChecks = options.checks
          ? {
              ...(project.stage_checks || {}),
              [stageTitle]: options.checks,
            }
          : (project.stage_checks || {})
        const nextStageProofCounts = { ...(project.stage_proof_counts || {}) }
        if (typeof options.proofCount === "number") {
          nextStageProofCounts[stageTitle] = Math.max(0, Number(options.proofCount || 0))
        }
        return {
          ...project,
          stage_status_overrides: nextStageStatusOverrides,
          stage_checks: nextStageChecks,
          stage_proof_counts: nextStageProofCounts,
        }
      })
      return changed ? { ...prev, projects: nextProjects } : prev
    })
  }

  function patchProjectPathStageUpdate(
    repoName: string,
    stageTitle: string,
    updater: (current: Record<string, unknown>) => Record<string, unknown>
  ) {
    setProjectPaths((prev) => {
      if (!prev?.projects?.length) return prev
      let changed = false
      const nextProjects = prev.projects.map((project) => {
        if (normalizeStorageKey(project.repo_name) !== normalizeStorageKey(repoName)) {
          return project
        }
        const stageUpdates = { ...(project.stage_progress_updates || {}) }
        const currentUpdate = stageUpdates[stageTitle]
        const nextUpdate = updater(
          currentUpdate && typeof currentUpdate === "object" ? (currentUpdate as Record<string, unknown>) : {}
        )
        stageUpdates[stageTitle] = nextUpdate
        changed = true
        return { ...project, stage_progress_updates: stageUpdates }
      })
      return changed ? { ...prev, projects: nextProjects } : prev
    })
  }

  function addEvidenceLink(repoName: string, rawName: string, rawUrl: string) {
    const nextItem = buildProofLinkItem(rawName, rawUrl, `${repoName} evidence`)
    if (!nextItem) return false
    setEvidenceByRepo((prev) => {
      const existing = prev[repoName] || []
      const byKey = new Map<string, EvidenceItem>()
      existing.forEach((item) => byKey.set(evidenceItemKey(item), item))
      const key = evidenceItemKey(nextItem)
      if (!byKey.has(key)) byKey.set(key, nextItem)
      return { ...prev, [repoName]: Array.from(byKey.values()) }
    })
    setEvidenceNameDraftByRepo((prev) => ({ ...prev, [repoName]: "" }))
    setEvidenceLinkDraftByRepo((prev) => ({ ...prev, [repoName]: "" }))
    return true
  }

  function removeEvidenceFile(repoName: string, key: string) {
    setEvidenceByRepo((prev) => {
      const existing = prev[repoName] || []
      const next = existing.filter((item) => evidenceItemKey(item) !== key)
      if (!next.length) {
        const { [repoName]: _removed, ...rest } = prev
        return rest
      }
      return { ...prev, [repoName]: next }
    })
  }

  function addStageUpdateLink(repoName: string, stageTitle: string, rawName: string, rawUrl: string) {
    const nextItem = buildProofLinkItem(rawName, rawUrl, `${stageTitle} proof`)
    if (!nextItem) return false
    setStageUpdateFilesByRepo((prev) => {
      const repoDrafts = prev[repoName] || {}
      const existing = repoDrafts[stageTitle] || []
      const byKey = new Map<string, EvidenceItem>()
      existing.forEach((item) => byKey.set(evidenceItemKey(item), item))
      const key = evidenceItemKey(nextItem)
      if (!byKey.has(key)) byKey.set(key, nextItem)
      return {
        ...prev,
        [repoName]: {
          ...repoDrafts,
          [stageTitle]: Array.from(byKey.values()),
        },
      }
    })
    setStageUpdateLinkNameDraftByRepo((prev) => ({
      ...prev,
      [repoName]: {
        ...(prev[repoName] || {}),
        [stageTitle]: "",
      },
    }))
    setStageUpdateLinkDraftByRepo((prev) => ({
      ...prev,
      [repoName]: {
        ...(prev[repoName] || {}),
        [stageTitle]: "",
      },
    }))
    return true
  }

  function removeStageUpdateFile(repoName: string, stageTitle: string, key: string) {
    setStageUpdateFilesByRepo((prev) => {
      const repoDrafts = prev[repoName] || {}
      const existing = repoDrafts[stageTitle] || []
      const nextItems = existing.filter((item) => evidenceItemKey(item) !== key)
      const nextRepoDrafts = { ...repoDrafts }
      if (nextItems.length) nextRepoDrafts[stageTitle] = nextItems
      else delete nextRepoDrafts[stageTitle]
      if (!Object.keys(nextRepoDrafts).length) {
        const { [repoName]: _removed, ...rest } = prev
        return rest
      }
      return {
        ...prev,
        [repoName]: nextRepoDrafts,
      }
    })
  }

  useEffect(() => {
    if (!projectPaths?.projects?.length || !targetUsername) return
    const unreadCount = adminView
      ? getAdminLearningPathNotificationCount(targetUsername, projectPaths)
      : getStudentLearningPathNotificationCount(targetUsername, projectPaths)
    if (unreadCount <= 0) {
      previousUnreadNotificationCountRef.current = 0
      return
    }
    if (unreadCount === previousUnreadNotificationCountRef.current) return
    previousUnreadNotificationCountRef.current = unreadCount
    if (adminView) {
      setFeedbackToast(`You have ${unreadCount} student learning-path update${unreadCount === 1 ? "" : "s"} to review.`)
    } else {
      setFeedbackToast(`You have ${unreadCount} new admin feedback notification${unreadCount === 1 ? "" : "s"}.`)
    }
  }, [adminView, notificationVersion, projectPaths, targetUsername])

  useEffect(() => {
    if (!projectPaths?.projects?.length) return
    setAdminFeedbackDraftByRepo((prev) => {
      const next = { ...prev }
      projectPaths.projects.forEach((project) => {
        const updates = project.stage_progress_updates || {}
        const stageFeedback: Record<string, string> = { ...(next[project.repo_name] || {}) }
        Object.entries(updates).forEach(([stageTitle, update]) => {
          const savedFeedback = String(update?.admin_feedback || "")
          if (savedFeedback && !String(stageFeedback[stageTitle] || "").trim()) {
            stageFeedback[stageTitle] = savedFeedback
          }
        })
        next[project.repo_name] = stageFeedback
      })
      return next
    })
  }, [projectPaths])

  useEffect(() => {
    if (!proofViewer || !projectPaths?.projects?.length) return
    const project = projectPaths.projects.find(
      (item) => normalizeStorageKey(item.repo_name) === normalizeStorageKey(proofViewer.repoName)
    )
    const update = getRecordValue<Record<string, unknown>>(
      project?.stage_progress_updates as Record<string, Record<string, unknown>> | undefined,
      proofViewer.stageTitle
    )
    if (!update) return
    const thread = Array.isArray(update.admin_feedback_thread)
      ? (update.admin_feedback_thread as Array<{ feedback: string; by?: string; updated_at?: string }>)
      : []
    const byProof = update.admin_feedback_by_proof && typeof update.admin_feedback_by_proof === "object"
      ? (update.admin_feedback_by_proof as ProofViewerState["adminFeedbackByProof"])
      : {}
    const nextProgressEntries = normalizeStageProgressEntries(update)
    const nextSelectedEntry =
      proofViewer.proofLabel === "Progress proof archive"
        ? nextProgressEntries.find((entry) => entry.entry_id === proofViewer.selectedEntryId) ||
          nextProgressEntries[nextProgressEntries.length - 1] ||
          null
        : null
    const nextProofItems = (() => {
      const rawProgressProofItems = nextSelectedEntry?.proof_items || (
        Array.isArray(update.proof_items)
          ? (update.proof_items as ProofViewerState["proofItems"])
          : []
      )
      const rawFinalProofItems = Array.isArray(update.final_proof_items)
        ? (update.final_proof_items as ProofViewerState["proofItems"])
        : []
      return proofViewer.proofLabel === "Final stage proof" ? rawFinalProofItems : rawProgressProofItems
    })()
    setProofViewer((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        selectedEntryId: nextSelectedEntry?.entry_id || prev.selectedEntryId,
        progressEntries: nextProgressEntries.length ? nextProgressEntries : prev.progressEntries,
        comment:
          proofViewer.proofLabel === "Progress proof archive"
            ? (nextSelectedEntry?.comment ?? null)
            : proofViewer.proofLabel === "Final stage proof"
              ? prev.comment
              : (typeof update.comment === "string" || update.comment === null ? (update.comment as string | null) : prev.comment),
        proofItems: nextProofItems,
        reviewStatus: String(update.review_status || prev.reviewStatus || "pending"),
        reviewStatusUpdatedAt: String(update.review_status_updated_at || prev.reviewStatusUpdatedAt || ""),
        updatedAt:
          proofViewer.proofLabel === "Progress proof archive"
            ? String(nextSelectedEntry?.updated_at || update.updated_at || prev.updatedAt || "")
            : String(update.updated_at || prev.updatedAt || ""),
        adminFeedback: String(update.admin_feedback || prev.adminFeedback || ""),
        adminFeedbackBy: String(update.admin_feedback_by || prev.adminFeedbackBy || ""),
        adminFeedbackUpdatedAt: String(update.admin_feedback_updated_at || prev.adminFeedbackUpdatedAt || ""),
        adminFeedbackThread: thread,
        adminFeedbackByProof: byProof,
      }
    })
  }, [projectPaths, proofViewer?.repoName, proofViewer?.stageTitle])

  useEffect(() => {
    if (adminView) return
    if (!storageUsernameKey) return
    setStageStatusByRepo({})
    setStageChecksByRepo({})
    setStageProofStatusByRepo({})
    if (typeof window === "undefined") return
    const statusStore = readStoredStageStatuses()
    if (storageUsernameKey in statusStore) {
      delete statusStore[storageUsernameKey]
      window.localStorage.setItem(STAGE_STATUS_STORAGE_KEY, JSON.stringify(statusStore))
    }
    const checksStore = readStoredStageChecks()
    if (storageUsernameKey in checksStore) {
      delete checksStore[storageUsernameKey]
      window.localStorage.setItem(STAGE_CHECK_STORAGE_KEY, JSON.stringify(checksStore))
    }
    const proofStore = readStoredStageProofStatus()
    if (storageUsernameKey in proofStore) {
      delete proofStore[storageUsernameKey]
      window.localStorage.setItem(STAGE_PROOF_STATUS_KEY, JSON.stringify(proofStore))
    }
  }, [adminView, storageUsernameKey])

  useEffect(() => {
    return
  }, [adminView, stageStatusByRepo, storageUsernameKey])

  useEffect(() => {
    return
  }, [adminView, stageChecksByRepo, storageUsernameKey])

  useEffect(() => {
    return
  }, [adminView, stageProofStatusByRepo, storageUsernameKey])

  async function handleStageStatusChange(
    repoName: string,
    stageTitle: string,
    nextStatus: StageCard["status"],
    options: { checks?: boolean[]; proofCount?: number } = {}
  ) {
    setStageStatusByRepo((prev) => ({
      ...prev,
      [repoName]: {
        ...(prev[repoName] || {}),
        [stageTitle]: nextStatus,
      },
    }))
    if (adminView || !auth.token) return
    try {
      await updateProjectStageStatus(auth.token, {
        repo_name: repoName,
        stage_title: stageTitle,
        status: nextStatus,
        checks: options.checks,
        proof_count: options.proofCount,
      })
      patchProjectPathStageState(repoName, stageTitle, nextStatus, options)
    } catch {
      setProjectPathError("Stage status could not be updated right now. Try again.")
    }
  }

  async function toggleStageItem(
    repoName: string,
    stageTitle: string,
    items: string[],
    itemIndex: number,
    locked: boolean,
    progressProofLocked: boolean
  ) {
    const stageKey = stageStateKey(repoName, stageTitle)
    if (adminView || locked) return
    if (busyStageKeys[stageKey]) return
    const currentChecks = getResolvedStageChecks(repoName, stageTitle, items)
    const firstIncompleteIndex = currentChecks.findIndex((checked) => !checked)
    const isUnchecking = Boolean(currentChecks[itemIndex])
    if (isUnchecking) {
      const lastCheckedIndex = currentChecks.reduce((latest, checked, index) => (checked ? index : latest), -1)
      if (lastCheckedIndex >= 0 && itemIndex !== lastCheckedIndex) {
        setProjectPathError(`Uncheck Output ${lastCheckedIndex + 1} first before unchecking Output ${itemIndex + 1}.`)
        return
      }
    } else {
      if (firstIncompleteIndex >= 0 && itemIndex !== firstIncompleteIndex) {
        setProjectPathError(`Finish Output ${firstIncompleteIndex + 1} first before selecting Output ${itemIndex + 1}.`)
        return
      }
    }
    if (progressProofLocked && currentChecks[itemIndex]) {
      setProjectPathError("Delete the saved progress proof for this stage before unchecking its completed outputs.")
      return
    }
    const project = projectPaths?.projects?.find(
      (entry) => normalizeStorageKey(entry.repo_name) === normalizeStorageKey(repoName)
    )
    const stageUpdate = getRecordValue(project?.stage_progress_updates, stageTitle)
    const savedProofCount = countSavedStageProgressProofItems(stageUpdate)
    const proofCount = Math.max(
      stageProofStatusByRepo[repoName]?.[stageTitle] || 0,
      getRecordValue(project?.stage_proof_counts, stageTitle) || 0,
      savedProofCount
    )
    const checkingLastOutput =
      !isUnchecking &&
      itemIndex === items.length - 1 &&
      currentChecks.slice(0, Math.max(items.length - 1, 0)).every(Boolean)
    if (checkingLastOutput && !canUnlockLastStageOutput(items, proofCount)) {
      const neededBeforeFinal = items.length <= 1 ? 1 : items.length - 1
      setProjectPathError(
        `Post at least ${neededBeforeFinal} saved progress proof ${neededBeforeFinal === 1 ? "item" : "items"} before checking the last output in this stage.`
      )
      return
    }
    setBusyStageKeys((prev) => ({ ...prev, [stageKey]: true }))
    try {
      const nextChecks = currentChecks.map((checked, index) => (index === itemIndex ? !checked : checked))
      optimisticStageChecksRef.current[stageKey] = nextChecks
      setStageChecksByRepo((prev) => ({
        ...prev,
        [repoName]: {
          ...(prev[repoName] || {}),
          [stageTitle]: nextChecks,
        },
      }))

      const anyDone = nextChecks.some(Boolean)
      const allDone = nextChecks.length > 0 && nextChecks.every(Boolean)
      const nextStatus =
        allDone && hasRequiredStageProgressProof(items, proofCount)
          ? "complete_stage"
          : anyDone
            ? "in_progress"
            : "not_started"
      await handleStageStatusChange(repoName, stageTitle, nextStatus, {
        checks: nextChecks,
        proofCount,
      })
    } finally {
      delete optimisticStageChecksRef.current[stageKey]
      setBusyStageKeys((prev) => {
        const next = { ...prev }
        delete next[stageKey]
        return next
      })
    }
  }

  async function saveStageProgressUpdate(repoName: string, stageTitle: string) {
    if (adminView || !auth.token) return
    const updateKey = `${repoName}::${stageTitle}`
    const comment = String(stageUpdateCommentByRepo[repoName]?.[stageTitle] || "").trim()
    const files = stageUpdateFilesByRepo[repoName]?.[stageTitle] || []
    const combinedItems = [...files]
    if (!comment && !combinedItems.length) {
      setProjectPathError("Add a short comment or at least one proof link before posting an update.")
      return
    }

    setSavingStageUpdateKey(updateKey)
    setProjectPathError("")
    setStageUpdateToast("")
    try {
      const uploadedItems: StageUpdateAttachment[] = combinedItems.map((item) => ({
        name: item.name,
        url: String(item.url || "").trim(),
        kind: item.kind,
      }))
      const updated = await updateProjectStageProgressUpdate(auth.token, {
        repo_name: repoName,
        stage_title: stageTitle,
        comment,
        proof_items: uploadedItems,
      })
      if (updated && typeof updated === "object") {
        patchProjectPathStageUpdate(repoName, stageTitle, (current) => ({
          ...current,
          ...(updated as Record<string, unknown>),
        }))
      }
      setStageUpdateCommentByRepo((prev) => ({
        ...prev,
        [repoName]: {
          ...(prev[repoName] || {}),
          [stageTitle]: "",
        },
      }))
      const targetRoadmap = roadmaps.find((roadmap) => roadmap.repoName === repoName)
      const targetStage = targetRoadmap?.stages.find((stage) => stage.title === stageTitle)
      const checks = getResolvedStageChecks(repoName, stageTitle, targetStage?.items || [])
      const savedProofCount = countSavedStageProgressProofItems(updated as Record<string, unknown>)
      const nextStatus =
        checks.length > 0 && checks.every(Boolean) && hasRequiredStageProgressProof(targetStage?.items || [], savedProofCount)
          ? "complete_stage"
          : "in_progress"
      await handleStageStatusChange(repoName, stageTitle, nextStatus, { checks, proofCount: savedProofCount })
      const ownerUsername = portfolio?.profile?.username || auth.username
      if (ownerUsername) {
        const refreshed = await fetchProjectLearningPaths(ownerUsername)
        setProjectPaths(refreshed)
        syncStageTrackingFromProjectPaths(refreshed)
      }
      setStageUpdateFilesByRepo((prev) => {
        const repoDrafts = prev[repoName] || {}
        const nextRepoDrafts = { ...repoDrafts }
        delete nextRepoDrafts[stageTitle]
        if (!Object.keys(nextRepoDrafts).length) {
          const { [repoName]: _removed, ...rest } = prev
          return rest
        }
        return {
          ...prev,
          [repoName]: nextRepoDrafts,
        }
      })
      setStageUpdateLinkDraftByRepo((prev) => ({
        ...prev,
        [repoName]: {
          ...(prev[repoName] || {}),
          [stageTitle]: "",
        },
      }))
      setStageUpdateToast(
        uploadedItems.length > 1
          ? `Stage proof saved with ${uploadedItems.length} links.`
          : uploadedItems.length === 1
            ? "Stage proof saved with 1 link."
            : "Stage note saved to this stage archive."
      )
    } catch (err) {
      setProjectPathError(err instanceof Error ? err.message : "Progress update could not be posted right now.")
    } finally {
      setSavingStageUpdateKey("")
    }
  }

  async function saveEvidenceFilesForRepo(repoName: string) {
    if (adminView || !auth.token) return
    const targetRoadmap = roadmaps.find((roadmap) => normalizeStorageKey(roadmap.repoName) === normalizeStorageKey(repoName))
    const targetStages = targetRoadmap?.stages || []
    const lastStage = targetStages[targetStages.length - 1]
    const repo = (portfolio?.repos || []).find((item) => normalizeStorageKey(item.name) === normalizeStorageKey(repoName))
    const repoGithubUrl = String(
      repo?.htmlUrl ||
      activeRepoLinkItem?.url ||
      buildGithubRepoUrl(targetUsername || portfolio?.profile?.username || auth.username, repoName) ||
      ""
    ).trim()
    const files = evidenceByRepo[repoName] || []
    const combinedItems = [...files]
    if (!repoGithubUrl) {
      setProjectPathError("Add or sync the GitHub repository link first before sending the evidence bundle.")
      return
    }
    if (!lastStage) {
      setProjectPathError("No final stage was found for this repo right now.")
      return
    }
    if (!combinedItems.length) {
      setProjectPathError("Add at least one evidence link before sending the final evidence bundle.")
      return
    }
    const unresolvedStage = activeStages.find(
      (stage) => !isStageDoneLike(stage.status) && !stageHasAllOutputsChecked(stage as StageCard & { checks?: boolean[] })
    )
    if (unresolvedStage) {
      setProjectPathError(`Finish all outputs first. "${unresolvedStage.title}" still has unfinished items.`)
      return
    }

    setSavingEvidenceRepoKey(repoName)
    setProjectPathError("")
    setStageUpdateToast("")
    try {
      const uploadedItems: StageUpdateAttachment[] = combinedItems.map((item) => ({
        name: item.name,
        url: String(item.url || "").trim(),
        kind: item.kind,
      }))
      await updateProjectStageProgressUpdate(auth.token, {
        repo_name: repoName,
        stage_title: lastStage.title,
        comment: "Final evidence bundle submitted from Evidence Files together with the updated GitHub repository link.",
        final_proof_items: uploadedItems,
      })

      for (const stage of activeStages) {
        const checks = normalizeStageChecks(stage.items, (stage as StageCard & { checks?: boolean[] }).checks)
        const project = projectPaths?.projects?.find(
          (entry) => normalizeStorageKey(entry.repo_name) === normalizeStorageKey(repoName)
        )
        const stageUpdate = getRecordValue(project?.stage_progress_updates, stage.title)
        const proofCount = Math.max(
          stageProofStatusByRepo[repoName]?.[stage.title] || 0,
          getRecordValue(project?.stage_proof_counts, stage.title) || 0,
          countSavedStageProgressProofItems(stageUpdate),
          stage.title === lastStage.title ? uploadedItems.length : 0
        )
        await handleStageStatusChange(repoName, stage.title, "complete_stage", { checks, proofCount })
      }

      const ownerUsername = portfolio?.profile?.username || auth.username
      if (ownerUsername) {
        const refreshed = await fetchProjectLearningPaths(ownerUsername)
        setProjectPaths(refreshed)
        syncStageTrackingFromProjectPaths(refreshed)
      }
      setEvidenceByRepo((prev) => {
        const { [repoName]: _removed, ...rest } = prev
        return rest
      })
      setEvidenceLinkDraftByRepo((prev) => ({ ...prev, [repoName]: "" }))
      setStageUpdateToast("Evidence files sent. The GitHub link and evidence bundle are now part of the final stage review.")
      window.setTimeout(() => {
        scrollToSection("learning-path-stages")
      }, 180)
    } catch (err) {
      setProjectPathError(err instanceof Error ? err.message : "Evidence files could not be sent right now.")
    } finally {
      setSavingEvidenceRepoKey("")
    }
  }

  async function saveAdminStageFeedback(
    repoName: string,
    stageTitle: string,
    proofItem?: { name?: string | null; url?: string | null },
    statusOverride?: "pending" | "accepted" | "rejected"
  ) {
    if (!adminView || !adminAuth.token || !targetUsername) return
    const draftKey = proofItem?.url ? `${stageTitle}::${proofItem.url}` : stageTitle
    const feedback = String(adminFeedbackDraftByRepo[repoName]?.[draftKey] || "").trim()
    if (!feedback && !statusOverride) {
      setProjectPathError("Write a short feedback message or choose a review status first.")
      return
    }
    const saveKey = `${repoName}::${stageTitle}`
    setSavingAdminFeedbackKey(saveKey)
    setProjectPathError("")
    try {
      const response = await upsertAdminStageFeedback(adminAuth.token, targetUsername, {
        repo_name: repoName,
        stage_title: stageTitle,
        feedback: feedback || undefined,
        proof_url: proofItem?.url || undefined,
        proof_name: proofItem?.name || undefined,
        status: statusOverride,
      })
      const feedbackTimestamp = response?.updated_at || new Date().toISOString()
      const proofUrl = String(proofItem?.url || "").trim()
      const proofName = String(proofItem?.name || "").trim()
      if (proofUrl) {
        patchProjectPathStageUpdate(repoName, stageTitle, (current) => {
          const existingByProof =
            current.admin_feedback_by_proof && typeof current.admin_feedback_by_proof === "object"
              ? (current.admin_feedback_by_proof as Record<string, Record<string, unknown>>)
              : {}
          const existingProof =
            existingByProof[proofUrl] && typeof existingByProof[proofUrl] === "object"
              ? (existingByProof[proofUrl] as Record<string, unknown>)
              : {}
          const nextThread = Array.isArray(response?.feedback_thread) && response.feedback_thread.length
            ? response.feedback_thread
            : [
                ...((Array.isArray(existingProof.thread) ? existingProof.thread : []) as Array<Record<string, unknown>>),
                {
                  feedback,
                  by: adminAuth.username,
                  role: "admin",
                  updated_at: feedbackTimestamp,
                  proof_url: proofUrl,
                  proof_name: proofName,
                },
              ]
          return {
            ...current,
            review_status: statusOverride || current.review_status,
            review_status_updated_at: statusOverride ? feedbackTimestamp : current.review_status_updated_at,
            admin_feedback_by_proof: {
              ...existingByProof,
              [proofUrl]: {
                ...existingProof,
                proof_url: proofUrl,
                proof_name: proofName || existingProof.proof_name,
                latest_feedback: feedback,
                feedback_by: adminAuth.username,
                updated_at: feedbackTimestamp,
                thread: nextThread,
              },
            },
          }
        })
      } else {
        patchProjectPathStageUpdate(repoName, stageTitle, (current) => {
          const existingThread = Array.isArray(current.admin_feedback_thread)
            ? (current.admin_feedback_thread as Array<Record<string, unknown>>)
            : []
          const nextThread = Array.isArray(response?.feedback_thread) && response.feedback_thread.length
            ? response.feedback_thread
            : feedback
              ? [
                  ...existingThread,
                  { feedback, by: adminAuth.username, role: "admin", updated_at: feedbackTimestamp },
                ]
              : existingThread
          return {
            ...current,
            review_status: response?.status || statusOverride || current.review_status,
            review_status_updated_at:
              response?.status || statusOverride ? feedbackTimestamp : current.review_status_updated_at,
            admin_feedback_thread: nextThread,
            admin_feedback: feedback || current.admin_feedback,
            admin_feedback_by: feedback ? adminAuth.username : current.admin_feedback_by,
            admin_feedback_updated_at: feedback ? feedbackTimestamp : current.admin_feedback_updated_at,
          }
        })
      }
      setAdminFeedbackDraftByRepo((prev) => ({
        ...prev,
        [repoName]: {
          ...(prev[repoName] || {}),
          [draftKey]: "",
        },
      }))
      const refreshed = await fetchProjectLearningPaths(targetUsername)
      setProjectPaths(refreshed)
      return refreshed
    } catch (err) {
      setProjectPathError(err instanceof Error ? err.message : "Admin feedback could not be saved right now.")
      return null
    } finally {
      setSavingAdminFeedbackKey("")
    }
  }

  async function saveStudentStageFeedbackReply(
    repoName: string,
    stageTitle: string,
    draftKey: string,
    proofItem?: { name?: string | null; url?: string | null }
  ) {
    if (adminView || !auth.token) return null
    const feedback = String(studentReplyDraftByRepo[repoName]?.[draftKey] || "").trim()
    if (!feedback) {
      setProjectPathError("Write a short reply before posting.")
      return null
    }
    const saveKey = `${repoName}::${stageTitle}::${draftKey}`
    setSavingStudentReplyKey(saveKey)
    setProjectPathError("")
    try {
      const response = await replyProjectStageFeedback(auth.token, {
        repo_name: repoName,
        stage_title: stageTitle,
        feedback,
        proof_url: proofItem?.url || undefined,
        proof_name: proofItem?.name || undefined,
      })
      if (response) {
          const nextUpdate = {
            comment: response.comment,
            proof_items: response.proof_items,
            final_proof_items: response.final_proof_items,
            review_status: response.review_status,
            review_status_updated_at: response.review_status_updated_at,
            updated_at: response.updated_at,
            progress_entries: response.progress_entries,
          admin_feedback: response.admin_feedback,
          admin_feedback_by: response.admin_feedback_by,
          admin_feedback_updated_at: response.admin_feedback_updated_at,
          admin_feedback_thread: response.admin_feedback_thread,
          admin_feedback_by_proof: response.admin_feedback_by_proof,
        }
        patchProjectPathStageUpdate(repoName, stageTitle, (current) => ({
          ...current,
          ...nextUpdate,
        }))
      }
      setStudentReplyDraftByRepo((prev) => ({
        ...prev,
        [repoName]: {
          ...(prev[repoName] || {}),
          [draftKey]: "",
        },
      }))
      const ownerUsername = portfolio?.profile?.username || auth.username
      if (!ownerUsername) return null
      const refreshed = await fetchProjectLearningPaths(ownerUsername)
      setProjectPaths(refreshed)
      return refreshed
    } catch (err) {
      setProjectPathError(err instanceof Error ? err.message : "Reply could not be posted right now.")
      return null
    } finally {
      setSavingStudentReplyKey("")
    }
  }

  async function deleteProofThreadReply(
    repoName: string,
    stageTitle: string,
    updatedAt?: string | null,
    proofUrl?: string | null,
    deleteAll = false
  ) {
    const cleanUpdatedAt = String(updatedAt || "").trim()
    const cleanProofUrl = String(proofUrl || "").trim()
    if (!cleanUpdatedAt && !deleteAll) return null
    const saveKey = `${repoName}::${stageTitle}::${deleteAll ? "all" : cleanUpdatedAt}`
    setDeletingStudentReplyKey(saveKey)
    setProjectPathError("")
    try {
      const response = await deleteProjectStageFeedbackReply(auth.token, {
        repo_name: repoName,
        stage_title: stageTitle,
        updated_at: deleteAll ? undefined : cleanUpdatedAt,
        proof_url: cleanProofUrl || undefined,
        delete_all: deleteAll,
      })
      if (response) {
        patchProjectPathStageUpdate(repoName, stageTitle, (current) => ({
          ...current,
          comment: response.comment,
          proof_items: response.proof_items,
          final_proof_items: response.final_proof_items,
          review_status: response.review_status,
          review_status_updated_at: response.review_status_updated_at,
          updated_at: response.updated_at,
          progress_entries: response.progress_entries,
          admin_feedback: response.admin_feedback,
          admin_feedback_by: response.admin_feedback_by,
          admin_feedback_updated_at: response.admin_feedback_updated_at,
          admin_feedback_thread: response.admin_feedback_thread,
          admin_feedback_by_proof: response.admin_feedback_by_proof,
        }))
        const refreshed = await fetchProjectLearningPaths(portfolio?.profile?.username || auth.username)
        setProjectPaths(refreshed)
        syncStageTrackingFromProjectPaths(refreshed)
      }
      return response
    } catch (err) {
      setProjectPathError(err instanceof Error ? err.message : "Comment could not be deleted right now.")
      return null
    } finally {
      setDeletingStudentReplyKey("")
    }
  }

  async function removeSavedStageProgressEntry(repoName: string, stageTitle: string, entryId?: string | null) {
    if (adminView || !auth.token || !entryId) return
    setProjectPathError("")
    setDeletingProgressUpdateKey(`${repoName}::${stageTitle}::entry::${entryId}`)
    try {
      const updated = await deleteProjectStageProgressUpdate(auth.token, {
        repo_name: repoName,
        stage_title: stageTitle,
        entry_id: entryId,
        delete_entry: true,
      })
      const nextEntries = normalizeStageProgressEntries(updated as Record<string, unknown>)
      const nextSelectedEntry = nextEntries[nextEntries.length - 1] || null
      setProofViewer((prev) =>
        prev && prev.repoName === repoName && prev.stageTitle === stageTitle
          ? nextSelectedEntry
            ? {
                ...prev,
                selectedEntryId: nextSelectedEntry.entry_id,
                progressEntries: nextEntries,
                comment: nextSelectedEntry.comment || null,
                proofItems: nextSelectedEntry.proof_items || [],
                updatedAt: nextSelectedEntry.updated_at || null,
              }
            : null
          : prev
      )
      const ownerUsername = portfolio?.profile?.username || auth.username
      if (ownerUsername) {
        const refreshed = await fetchProjectLearningPaths(ownerUsername)
        setProjectPaths(refreshed)
        syncStageTrackingFromProjectPaths(refreshed)
      }
    } catch (err) {
      setProjectPathError(err instanceof Error ? err.message : "Progress update could not be deleted right now.")
    } finally {
      setDeletingProgressUpdateKey("")
    }
  }

  async function deleteAdminProofComment(
    repoName: string,
    stageTitle: string,
    updatedAt?: string | null,
    proofUrl?: string | null,
    deleteAll = false
  ) {
    if (!adminView || !adminAuth.token || !targetUsername) return null
    const cleanUpdatedAt = String(updatedAt || "").trim()
    const cleanProofUrl = String(proofUrl || "").trim()
    if (!cleanUpdatedAt && !deleteAll) return null
    const saveKey = `${repoName}::${stageTitle}::${deleteAll ? "all" : cleanUpdatedAt}`
    setDeletingAdminCommentKey(saveKey)
    setProjectPathError("")
    try {
      const response = await deleteAdminStageFeedback(adminAuth.token, targetUsername, {
        repo_name: repoName,
        stage_title: stageTitle,
        updated_at: deleteAll ? undefined : cleanUpdatedAt,
        proof_url: cleanProofUrl || undefined,
        delete_all: deleteAll,
      })
      if (response) {
        patchProjectPathStageUpdate(repoName, stageTitle, (current) => ({
          ...current,
          review_status: response.status || current.review_status,
          review_status_updated_at: response.updated_at || current.review_status_updated_at,
          admin_feedback: response.feedback || current.admin_feedback,
          admin_feedback_by: response.feedback_by || current.admin_feedback_by,
          admin_feedback_updated_at: response.updated_at || current.admin_feedback_updated_at,
          admin_feedback_thread: response.feedback_thread || current.admin_feedback_thread,
        }))
        const refreshed = await fetchProjectLearningPaths(targetUsername)
        setProjectPaths(refreshed)
        syncStageTrackingFromProjectPaths(refreshed)
      }
      return response
    } catch (err) {
      setProjectPathError(err instanceof Error ? err.message : "Admin comment could not be deleted right now.")
      return null
    } finally {
      setDeletingAdminCommentKey("")
    }
  }

  useEffect(() => {
    return () => {
      Object.values(unlockTimersRef.current).forEach((timerId) => window.clearTimeout(timerId))
      unlockTimersRef.current = {}
      Object.values(warningStageItemTimersRef.current).forEach((timerId) => window.clearTimeout(timerId))
      warningStageItemTimersRef.current = {}
    }
  }, [])

  useEffect(() => {
    if (adminView) {
      if (!targetUsername) {
        setPortfolio(null)
        setProjectPaths(null)
        setLoadError("")
        setProjectPathError("")
        setLoading(false)
        return
      }

      let cancelled = false
      async function loadAdminView(showLoading = true) {
        if (showLoading) setLoading(true)
        setLoadError("")
        setProjectPathError("")
        try {
          const nextPortfolio = await fetchPortfolio(targetUsername)
          if (cancelled) return
          setPortfolio(nextPortfolio)
          try {
            const projectPath = await fetchProjectLearningPaths(targetUsername) as ProjectLearningPathResponse
            if (cancelled) return
            setProjectPaths(projectPath)
            syncStageTrackingFromProjectPaths(projectPath)
          } catch {
            if (cancelled) return
            setProjectPaths(null)
            setProjectPathError("Repo learning paths could not be loaded. Showing fallback milestones from repository signals.")
          }
        } catch {
          if (cancelled) return
          setPortfolio(null)
          setProjectPaths(null)
          setLoadError("Unable to load this learning path right now. Check the username, GitHub sync, or API connection.")
        } finally {
          if (!cancelled && showLoading) setLoading(false)
        }
      }

      void loadAdminView()
      const intervalId = window.setInterval(() => {
        void loadAdminView(false)
      }, 2500)
      const handleFocus = () => void loadAdminView(false)
      window.addEventListener("focus", handleFocus)
      document.addEventListener("visibilitychange", handleFocus)
      return () => {
        cancelled = true
        window.clearInterval(intervalId)
        window.removeEventListener("focus", handleFocus)
        document.removeEventListener("visibilitychange", handleFocus)
      }
    }

    if (!auth.username || !auth.token) {
      setPortfolio(null)
      setProjectPaths(null)
      setLoadError("")
      setProjectPathError("")
      setLoading(false)
      return
    }

    let cancelled = false
    let intervalId: number | undefined

    const refreshProjectPaths = async () => {
      const stored = getStoredAuth()
      const currentUsername = stored.username || auth.username
      if (!currentUsername) return
      try {
        const projectPath = await fetchProjectLearningPaths(currentUsername)
        if (cancelled) return
        setProjectPaths(projectPath)
      } catch {
        // ignore background refresh errors
      }
    }

    const handleFocus = () => {
      if (document.visibilityState !== "visible") return
      void refreshProjectPaths()
    }
    async function load(showLoading = true) {
      if (showLoading) {
        setLoading(true)
        setLoadError("")
        setProjectPathError("")
      }
      try {
        const me = await fetchOwnerPortfolio(auth.token)
        if (cancelled) return
        setPortfolio(me)
        const ownerUsername = me.profile.username || auth.username
        if (ownerUsername && ownerUsername !== auth.username) {
          setStoredAuth(auth.token, ownerUsername)
        }
        try {
          const projectPath = await fetchProjectLearningPaths(ownerUsername)
          if (cancelled) return
          setProjectPaths(projectPath)
          syncStageTrackingFromProjectPaths(projectPath)
        } catch {
          if (cancelled) return
          setProjectPaths(null)
          setProjectPathError("Repo learning paths could not be loaded. Showing fallback milestones from repository signals.")
        }
      } catch {
        if (cancelled) return
        setPortfolio(null)
        setProjectPaths(null)
        setLoadError("Unable to load your learning path right now. Check GitHub sync or API connection, then refresh.")
      } finally {
        if (!cancelled && showLoading) setLoading(false)
      }
    }

    void load()
    intervalId = window.setInterval(() => {
      void refreshProjectPaths()
    }, 4000)
    window.addEventListener("focus", handleFocus)
    document.addEventListener("visibilitychange", handleFocus)
    return () => {
      cancelled = true
      if (intervalId) window.clearInterval(intervalId)
      window.removeEventListener("focus", handleFocus)
      document.removeEventListener("visibilitychange", handleFocus)
    }
  }, [adminView, auth.username, auth.token, targetUsername])

  const roadmaps = useMemo<RepoRoadmap[]>(() => {
    const portfolioRepos = portfolio?.repos || []
    const fallbackProjectRepos: RepoSummary[] = (projectPaths?.projects || []).map((project) => ({
      name: project.repo_name,
      description: "",
      language: "",
      languages: [],
      stars: 0,
      commitCount: 0,
    }))
    const repos = [...portfolioRepos, ...fallbackProjectRepos]
    const uniqueRepos: RepoSummary[] = []
    const seen = new Set<string>()
    repos.forEach((repo) => {
      const key = String(repo.name || "").trim().toLowerCase()
      if (!key || seen.has(key)) return
      seen.add(key)
      uniqueRepos.push(repo)
    })
    return uniqueRepos.map((repo, index) => {
      const projectPath = projectPaths?.projects?.find((project) => project.repo_name === repo.name)
      const milestones = repoSpecificMilestones(repo, index, projectPath?.steps).slice(0, 5)
      const done = milestones.filter((step) => String(step.status || "").toLowerCase() === "done").length
      const progress = clamp(Number(projectPath?.progress_percent ?? (milestones.length ? (done / milestones.length) * 100 : 0)))
      return {
        repoName: repo.name,
        progress,
        summary: inferRepoSummary(repo),
        evidence: unique([...repoEvidenceTags(repo), ...(milestones.flatMap((step) => step.evidence || []))], 10),
        stages: stagesFor(repo, milestones),
        milestones,
      }
    })
  }, [portfolio?.repos, projectPaths?.projects])

  useEffect(() => {
    if (!selectedRepo && roadmaps[0]?.repoName) {
      setSelectedRepo(roadmaps[0].repoName)
    }
  }, [roadmaps, selectedRepo])

  useEffect(() => {
    if (!roadmaps.length) return
    setStageStatusByRepo((prev) => {
      let changed = false
      const next = { ...prev }
      roadmaps.forEach((roadmap) => {
        const repoStatuses = { ...(next[roadmap.repoName] || {}) }
        let repoChanged = false
        const project = projectPaths?.projects?.find(
          (project) => normalizeStorageKey(project.repo_name) === normalizeStorageKey(roadmap.repoName)
        )
        roadmap.stages.forEach((stage, index, stages) => {
          const stageUpdate = getRecordValue(project?.stage_progress_updates, stage.title)
          const backendStatus = normalizeStageStatusValue(
            String(getRecordValue(project?.stage_status_overrides, stage.title) || "not_started")
          )
          const proofCount = Math.max(
            stageProofStatusByRepo[roadmap.repoName]?.[stage.title] || 0,
            getRecordValue(project?.stage_proof_counts, stage.title) || 0,
            countSavedStageProgressProofItems(stageUpdate)
          )
          const previousLocked = stages
            .slice(0, index)
            .some((earlierStage) => {
              const earlierStageUpdate = getRecordValue(project?.stage_progress_updates, earlierStage.title)
              const earlierProofCount = Math.max(
                stageProofStatusByRepo[roadmap.repoName]?.[earlierStage.title] || 0,
                getRecordValue(project?.stage_proof_counts, earlierStage.title) || 0,
                countSavedStageProgressProofItems(earlierStageUpdate)
              )
              const earlierStatus = normalizeStageStatusValue(
                String(getRecordValue(project?.stage_status_overrides, earlierStage.title) || repoStatuses[earlierStage.title] || "not_started")
              )
              const earlierChecks = normalizeStageChecks(
                earlierStage.items,
                getRecordValue(project?.stage_checks, earlierStage.title)
              )
              const earlierOutputsChecked = earlierStage.items.length > 0 && earlierChecks.every(Boolean)
              return !(
                earlierStatus === "complete_stage" ||
                (earlierStatus === "done" && hasRequiredStageProgressProof(earlierStage.items, earlierProofCount)) ||
                (earlierOutputsChecked && hasRequiredStageProgressProof(earlierStage.items, earlierProofCount))
              )
            })
          const backendChecks = normalizeStageChecks(
            stage.items,
            getRecordValue(project?.stage_checks, stage.title)
          )
          const backendStageActivity =
            backendChecks.some(Boolean) ||
            Boolean(stageUpdate?.comment) ||
            Boolean((stageUpdate?.proof_items || []).length) ||
            Boolean((stageUpdate?.progress_entries || []).length) ||
            proofCount > 0
          const currentStatus = normalizeStageStatusValue(
            String(repoStatuses[stage.title] || getRecordValue(project?.stage_status_overrides, stage.title) || "not_started")
          )
          if (!previousLocked && backendStageActivity && currentStatus === "not_started") {
            repoStatuses[stage.title] = "in_progress"
            repoChanged = true
          }
          if (
            !previousLocked &&
            !backendStageActivity &&
            backendStatus !== "done" &&
            backendStatus !== "complete_stage" &&
            currentStatus !== "not_started"
          ) {
            repoStatuses[stage.title] = "not_started"
            repoChanged = true
          }
        })
        if (repoChanged) {
          next[roadmap.repoName] = repoStatuses
          changed = true
        }
      })
      return changed ? next : prev
    })
    setStageChecksByRepo((prev) => {
      let changed = false
      const next = { ...prev }
      roadmaps.forEach((roadmap) => {
        const repoChecks = { ...(next[roadmap.repoName] || {}) }
        let repoChanged = false
        roadmap.stages.forEach((stage, index, stages) => {
          if (!repoChecks[stage.title]) {
            const backendChecks = getRecordValue(
              projectPaths?.projects?.find((project) => normalizeStorageKey(project.repo_name) === normalizeStorageKey(roadmap.repoName))?.stage_checks,
              stage.title
            )
            repoChecks[stage.title] = normalizeStageChecks(stage.items, backendChecks)
            repoChanged = true
            return
          }

          const project = projectPaths?.projects?.find(
            (project) => normalizeStorageKey(project.repo_name) === normalizeStorageKey(roadmap.repoName)
          )
          const stageUpdate = getRecordValue(project?.stage_progress_updates, stage.title)
          const backendStatus = normalizeStageStatusValue(
            String(getRecordValue(project?.stage_status_overrides, stage.title) || "not_started")
          )
          const proofCount = Math.max(
            stageProofStatusByRepo[roadmap.repoName]?.[stage.title] || 0,
            getRecordValue(project?.stage_proof_counts, stage.title) || 0,
            countSavedStageProgressProofItems(stageUpdate)
          )
          const previousLocked = stages
            .slice(0, index)
            .some((earlierStage) => {
              const earlierStageUpdate = getRecordValue(project?.stage_progress_updates, earlierStage.title)
              const earlierProofCount = Math.max(
                stageProofStatusByRepo[roadmap.repoName]?.[earlierStage.title] || 0,
                getRecordValue(project?.stage_proof_counts, earlierStage.title) || 0,
                countSavedStageProgressProofItems(earlierStageUpdate)
              )
              const earlierStatus = normalizeStageStatusValue(
                String(getRecordValue(project?.stage_status_overrides, earlierStage.title) || "not_started")
              )
              const earlierChecks = normalizeStageChecks(
                earlierStage.items,
                getRecordValue(project?.stage_checks, earlierStage.title) || repoChecks[earlierStage.title]
              )
              const earlierOutputsChecked = earlierStage.items.length > 0 && earlierChecks.every(Boolean)
              return !(
                earlierStatus === "complete_stage" ||
                (earlierStatus === "done" && hasRequiredStageProgressProof(earlierStage.items, earlierProofCount)) ||
                (earlierOutputsChecked && hasRequiredStageProgressProof(earlierStage.items, earlierProofCount))
              )
            })
          const backendChecks = normalizeStageChecks(
            stage.items,
            getRecordValue(project?.stage_checks, stage.title)
          )
          const backendStageActivity =
            backendChecks.some(Boolean) ||
            Boolean(stageUpdate?.comment) ||
            Boolean((stageUpdate?.proof_items || []).length) ||
            Boolean((stageUpdate?.progress_entries || []).length) ||
            proofCount > 0
          const stageKey = stageStateKey(roadmap.repoName, stage.title)
          const hasOptimisticChecks = Boolean(optimisticStageChecksRef.current[stageKey])
          const shouldResetChecks =
            !previousLocked &&
            !backendStageActivity &&
            backendStatus !== "done" &&
            backendStatus !== "complete_stage" &&
            repoChecks[stage.title].some(Boolean) &&
            !hasOptimisticChecks

          if (shouldResetChecks) {
            repoChecks[stage.title] = stage.items.map(() => false)
            repoChanged = true
          }
        })
        if (repoChanged) {
          next[roadmap.repoName] = repoChecks
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [roadmaps, projectPaths?.projects, stageChecksByRepo, stageProofStatusByRepo])

      const activeRoadmap = roadmaps.find((roadmap) => roadmap.repoName === selectedRepo) || roadmaps[0]
  const activeRepo = (portfolio?.repos || []).find(
    (repo) => normalizeStorageKey(repo.name) === normalizeStorageKey(activeRoadmap?.repoName)
  )
  const activeRepoName = activeRoadmap?.repoName || ""
  const activeEvidenceItems = activeRepoName ? evidenceByRepo[activeRepoName] || [] : []
  const activeProjectPath = projectPaths?.projects?.find(
    (project) => normalizeStorageKey(project.repo_name) === normalizeStorageKey(activeRoadmap?.repoName)
  )
  const activeRepoCompleted = Boolean(activeProjectPath?.repo_completed)
  const activeRepoShowcaseItems = useMemo(
    () => collectRepoShowcaseItems(activeProjectPath, activeRepo),
    [activeProjectPath, activeRepo]
  )
  const activeRepoLinkItem = activeRepoShowcaseItems.find((item) => item.kind === "repo")
  const fallbackRepoGithubUrl = buildGithubRepoUrl(targetUsername || portfolio?.profile?.username || auth.username, activeRepoName)
  const activeRepoGithubUrl = String(activeRepoLinkItem?.url || activeRepo?.htmlUrl || fallbackRepoGithubUrl || "").trim()
  const activeRepoProofShowcaseItems = activeRepoShowcaseItems.filter((item) => item.kind !== "repo")
  const activeStages = activeRoadmap
    ? activeRoadmap.stages.map((stage, index, stages) => {
        const repoName = activeRoadmap.repoName
        const localChecks = stageChecksByRepo[repoName]?.[stage.title]
        const backendChecks = getRecordValue(activeProjectPath?.stage_checks, stage.title)
        const backendCheckFlags = normalizeStageChecks(stage.items, backendChecks)
        const localCheckFlags = normalizeStageChecks(stage.items, localChecks)
        const backendStatus = getRecordValue(activeProjectPath?.stage_status_overrides, stage.title)
        const normalizedBackendStatus = normalizeStageStatusValue(String(backendStatus || "not_started"))
        const stageUpdate = getRecordValue(activeProjectPath?.stage_progress_updates, stage.title)
        const savedProgressProofCount = countSavedStageProgressProofItems(stageUpdate)
        const proofCount = Math.max(
          stageProofStatusByRepo[repoName]?.[stage.title] || 0,
          getRecordValue(activeProjectPath?.stage_proof_counts, stage.title) || 0,
          savedProgressProofCount
        )
        const hasRequiredProof = hasRequiredStageProgressProof(stage.items, proofCount)
        const storedStatus = normalizeStageStatusValue(String(adminView
          ? backendStatus || stageStatusByRepo[repoName]?.[stage.title] || "not_started"
          : stageStatusByRepo[repoName]?.[stage.title] || backendStatus || "not_started"))
        let checks = normalizeStageChecks(
          stage.items,
          adminView
            ? backendChecks || localChecks
            : localChecks || backendChecks
        )
        if ((storedStatus === "complete_stage" || (storedStatus === "done" && hasRequiredProof)) && stage.items.length > 0) {
          checks = stage.items.map(() => true)
        }
        const allOutputsChecked = stage.items.length > 0 && checks.every(Boolean)
        const isCompleteStage = storedStatus === "complete_stage" || (allOutputsChecked && hasRequiredProof)
        const backendStageActivity =
          backendCheckFlags.some(Boolean) ||
          Boolean(stageUpdate?.comment) ||
          Boolean((stageUpdate?.proof_items || []).length) ||
          Boolean((stageUpdate?.progress_entries || []).length) ||
          proofCount > 0
        const hasStageActivity = backendStageActivity || localCheckFlags.some(Boolean)
        const previousLocked = stages
          .slice(0, index)
          .some((earlierStage) => {
            const earlierLocalChecks = stageChecksByRepo[repoName]?.[earlierStage.title]
            const earlierBackendChecks = getRecordValue(activeProjectPath?.stage_checks, earlierStage.title)
            const earlierStatus = normalizeStageStatusValue(String(adminView
              ? getRecordValue(activeProjectPath?.stage_status_overrides, earlierStage.title) || stageStatusByRepo[repoName]?.[earlierStage.title] || "not_started"
              : stageStatusByRepo[repoName]?.[earlierStage.title] || getRecordValue(activeProjectPath?.stage_status_overrides, earlierStage.title) || "not_started"))
            const earlierStageUpdate = getRecordValue(activeProjectPath?.stage_progress_updates, earlierStage.title)
            const earlierSavedProgressProofCount = countSavedStageProgressProofItems(earlierStageUpdate)
            const earlierProofCount = Math.max(
              stageProofStatusByRepo[repoName]?.[earlierStage.title] || 0,
              getRecordValue(activeProjectPath?.stage_proof_counts, earlierStage.title) || 0,
              earlierSavedProgressProofCount
            )
            const earlierChecks = normalizeStageChecks(
              earlierStage.items,
              adminView ? earlierBackendChecks || earlierLocalChecks : earlierLocalChecks || earlierBackendChecks
            )
            const earlierOutputsChecked = earlierStage.items.length > 0 && earlierChecks.every(Boolean)
            const earlierComplete =
              earlierStatus === "complete_stage" ||
              (earlierStatus === "done" && hasRequiredStageProgressProof(earlierStage.items, earlierProofCount)) ||
              (earlierOutputsChecked && hasRequiredStageProgressProof(earlierStage.items, earlierProofCount))
            return !earlierComplete
          })

        if (previousLocked) {
          checks = stage.items.map(() => false)
        }

        const wasLocked = Boolean(prevLockedByRepoRef.current[repoName]?.[stage.title])
        const justUnlocked = wasLocked && !previousLocked
        if (justUnlocked && !backendStageActivity) {
          return {
            ...stage,
            status: "not_started" as StageCard["status"],
            locked: false,
            checks: stage.items.map(() => false),
          }
        }

        if (
          !previousLocked &&
          !backendStageActivity &&
          normalizedBackendStatus !== "done" &&
          normalizedBackendStatus !== "complete_stage"
        ) {
          return {
            ...stage,
            status: "not_started" as StageCard["status"],
            locked: false,
            checks: stage.items.map(() => false),
          }
        }

        if (isCompleteStage) {
          return {
            ...stage,
            status: "complete_stage" as StageCard["status"],
            locked: false,
            checks,
          }
        }

        if (storedStatus === "done") {
          return {
            ...stage,
            status: allOutputsChecked && !hasRequiredProof ? "in_progress" as StageCard["status"] : "done" as StageCard["status"],
            locked: false,
            checks,
          }
        }

        if (storedStatus === "in_progress") {
          return {
            ...stage,
            status: previousLocked
              ? "not_started" as StageCard["status"]
              : hasStageActivity
                ? "in_progress" as StageCard["status"]
                : "not_started" as StageCard["status"],
            locked: previousLocked,
            checks,
          }
        }

        const shouldMarkInProgress = hasStageActivity || checks.some(Boolean)
        return {
          ...stage,
          status: previousLocked
            ? "not_started" as StageCard["status"]
            : shouldMarkInProgress
              ? "in_progress" as StageCard["status"]
              : "not_started" as StageCard["status"],
          locked: previousLocked,
          checks,
        }
      })
    : []

  useEffect(() => {
    if (!activeRoadmap) return
    const repoName = activeRoadmap.repoName
    const prevRepo = prevLockedByRepoRef.current[repoName] || {}
    const nextRepo: Record<string, boolean> = {}

    activeStages.forEach((stage) => {
      const locked = Boolean((stage as StageCard & { locked?: boolean }).locked)
      nextRepo[stage.title] = locked
      const wasLocked = prevRepo[stage.title]
      if (wasLocked && !locked) {
        setUnlockAnimationsByRepo((prev) => ({
          ...prev,
          [repoName]: {
            ...(prev[repoName] || {}),
            [stage.title]: true,
          },
        }))

        const timerKey = `${repoName}::${stage.title}`
        if (unlockTimersRef.current[timerKey]) {
          window.clearTimeout(unlockTimersRef.current[timerKey])
        }
        unlockTimersRef.current[timerKey] = window.setTimeout(() => {
          setUnlockAnimationsByRepo((prev) => {
            const repoFlags = { ...(prev[repoName] || {}) }
            delete repoFlags[stage.title]
            const next = { ...prev }
            if (Object.keys(repoFlags).length) next[repoName] = repoFlags
            else delete next[repoName]
            return next
          })
          delete unlockTimersRef.current[timerKey]
        }, 1200)
      }
    })

    prevLockedByRepoRef.current = {
      ...prevLockedByRepoRef.current,
      [repoName]: nextRepo,
    }
  }, [activeRoadmap, activeStages])

  const activeTrack = inferRepoTrack(activeRepo)
  const totalXp = activeRoadmap?.milestones.reduce((sum, step) => sum + Number(step.reward_xp || step.estimated_xp || 0), 0) || 0
  const completeStages = activeStages.filter((stage) => stage.status === "complete_stage").length || 0
  const doneStages = activeStages.filter((stage) => stage.status === "done").length || 0
  const ongoingStages = activeStages.filter((stage) => stage.status === "in_progress").length || 0
  const notStartedStages = activeStages.filter((stage) => stage.status === "not_started").length || 0
  const nextMilestoneIndex = activeStages.findIndex((stage) => !isStageDoneLike(stage.status))
  const currentMilestoneStage = nextMilestoneIndex >= 0 ? activeStages[nextMilestoneIndex] : activeStages[activeStages.length - 1]
  const nextMilestone = nextMilestoneIndex >= 0
    ? activeRoadmap?.milestones[nextMilestoneIndex] || activeRoadmap?.milestones[0]
    : activeRoadmap?.milestones[activeRoadmap.milestones.length - 1]
  const currentMilestoneProofCount = currentMilestoneStage
    ? Math.max(
        stageProofStatusByRepo[activeRoadmap?.repoName || ""]?.[currentMilestoneStage.title] || 0,
        getRecordValue(activeProjectPath?.stage_proof_counts, currentMilestoneStage.title) || 0
      )
    : 0
  const currentMilestoneChecks = currentMilestoneStage
    ? normalizeStageChecks(
        currentMilestoneStage.items,
        (currentMilestoneStage as StageCard & { checks?: boolean[] }).checks
      )
    : []
  const currentMilestoneCompletedCount = currentMilestoneChecks.filter(Boolean).length
  const currentMilestoneProgressPercent = currentMilestoneStage?.items?.length
    ? Math.round((currentMilestoneCompletedCount / Math.max(currentMilestoneStage.items.length, 1)) * 100)
    : 0
  const currentMilestoneFocusIndex = currentMilestoneStage
    ? currentMilestoneChecks.findIndex((checked) => !checked)
    : -1
  const xpRemaining = activeRoadmap?.milestones
    .filter((step) => String(step.status || "todo").toLowerCase() !== "done")
    .reduce((sum, step) => sum + Number(step.reward_xp || step.estimated_xp || 0), 0) || 0
  const activeStageProofReadyCount = activeStages.filter((stage) => {
    const proofCount = Math.max(
      stageProofStatusByRepo[activeRoadmap?.repoName || ""]?.[stage.title] || 0,
      getRecordValue(activeProjectPath?.stage_proof_counts, stage.title) || 0
    )
    return stage.status === "complete_stage" || (stage.status === "done" && hasRequiredStageProgressProof(stage.items, proofCount))
  }).length
  const lastStage = activeStages[activeStages.length - 1]
  const isLastStageDone = Boolean(lastStage && isStageDoneLike(lastStage.status))
  const allSkillStagesReadyForFinalEvidence =
    activeStages.length > 0 &&
    activeStages.every((stage) => isStageDoneLike(stage.status) || stageHasAllOutputsChecked(stage as StageCard & { checks?: boolean[] }))
  const finalStageUpdate = lastStage ? getRecordValue(activeProjectPath?.stage_progress_updates, lastStage.title) : undefined
  const finalStageProofItems = Array.isArray(finalStageUpdate?.final_proof_items)
    ? (finalStageUpdate.final_proof_items as Array<{ name: string; url: string; kind?: string | null }>)
    : []
  const hasSubmittedFinalEvidence = finalStageProofItems.length > 0
  const finalStageReviewStatus = normalizeReviewStatus(String(finalStageUpdate?.review_status || "pending"))
  const finalStageReviewMeta = reviewStatusMeta(finalStageReviewStatus)
  const canPrepareFinalEvidence = allSkillStagesReadyForFinalEvidence || activeRepoCompleted || hasSubmittedFinalEvidence
  const finalStageNotificationCount = lastStage && finalStageUpdate && targetUsername
    ? (
        (adminView
          ? getAdminStageNotificationCount(targetUsername, activeRoadmap?.repoName || "", lastStage.title, finalStageUpdate)
          : getStudentStageNotificationCount(targetUsername, activeRoadmap?.repoName || "", lastStage.title, finalStageUpdate)) +
        finalStageProofItems.reduce(
          (total, item) =>
            total +
            (adminView
              ? getAdminProofNotificationCount(targetUsername, activeRoadmap?.repoName || "", lastStage.title, item.url, finalStageUpdate)
              : getStudentProofNotificationCount(targetUsername, activeRoadmap?.repoName || "", lastStage.title, item.url, finalStageUpdate)),
          0
        )
      )
    : 0
  const canClaimRepoReward = Boolean(
    !adminView &&
    activeRoadmap &&
    !activeRepoCompleted &&
    activeRepo?.htmlUrl &&
    activeStages.length > 0 &&
    activeStages.every((stage) => isStageDoneLike(stage.status)) &&
    activeStageProofReadyCount === activeStages.length
  )

  useEffect(() => {
    if (adminView || !activeRoadmap) return
    const repoName = activeRoadmap.repoName
    const wasDone = Boolean(prevLastStageDoneByRepoRef.current[repoName])
    if (!wasDone && isLastStageDone) {
      window.setTimeout(() => {
        scrollToSection("learning-path-evidence")
      }, 180)
      setStageUpdateToast("Last stage finished. Review your Evidence Files and confirm the GitHub repo link beside it.")
    }
    prevLastStageDoneByRepoRef.current = {
      ...prevLastStageDoneByRepoRef.current,
      [repoName]: isLastStageDone,
    }
  }, [adminView, activeRoadmap, isLastStageDone])

  async function handleClaimRepoReward(repoName: string) {
    if (adminView || !auth.token || !repoName) return
    setProjectPathError("")
    setStageUpdateToast("")
    setClaimingRepoRewardKey(repoName)
    try {
      const result = await claimProjectLearningPathReward(auth.token, { repo_name: repoName }) as { claimed_xp?: number; next_path_level?: number | null; repo_completed?: boolean }
      const ownerUsername = portfolio?.profile?.username || auth.username
      if (ownerUsername) {
        const refreshedPortfolio = await fetchOwnerPortfolio(auth.token)
        setPortfolio(refreshedPortfolio)
        const refreshedPaths = await fetchProjectLearningPaths(ownerUsername)
        setProjectPaths(refreshedPaths)
      }
      setStageStatusByRepo((prev) => ({
        ...prev,
        [repoName]: {},
      }))
      setStageChecksByRepo((prev) => ({
        ...prev,
        [repoName]: {},
      }))
      setStageProofStatusByRepo((prev) => ({
        ...prev,
        [repoName]: {},
      }))
      setStageUpdateCommentByRepo((prev) => ({
        ...prev,
        [repoName]: {},
      }))
      setStageUpdateFilesByRepo((prev) => ({
        ...prev,
        [repoName]: {},
      }))
      setProofViewer(null)
      setExpandedProofItem(null)
      const claimedXp = Number(result?.claimed_xp || totalXp || 0)
      if (result?.repo_completed) {
        setStageUpdateToast(`Claimed ${claimedXp} XP. Repo completed.`)
      } else {
        setStageUpdateToast(`Claimed ${claimedXp} XP.`)
      }
    } catch (err) {
      setProjectPathError(err instanceof Error ? err.message : "Repo reward could not be claimed right now.")
    } finally {
      setClaimingRepoRewardKey("")
    }
  }

  async function handleRecompute() {
    if (adminView || !auth.token || recomputingRef.current || recomputing) return
    recomputingRef.current = true
    setRecomputing(true)
    setLoadError("")
    setProjectPathError("")
    try {
      await recomputeInsights(auth.token)
      const me = await fetchOwnerPortfolio(auth.token)
      const ownerUsername = me.profile.username || auth.username
      setPortfolio(me)
      if (ownerUsername && ownerUsername !== auth.username) {
        setStoredAuth(auth.token, ownerUsername)
      }
      try {
        const projectPath = await fetchProjectLearningPaths(ownerUsername)
        setProjectPaths(projectPath)
      } catch {
        setProjectPaths(null)
        setProjectPathError("Insights were recomputed, but repo learning paths could not be loaded. Showing fallback milestones for now.")
      }
    } catch {
      setLoadError("Unable to recompute insights right now. Check the API connection, then try again.")
    } finally {
      recomputingRef.current = false
      setRecomputing(false)
    }
  }

  if (!targetUsername) {
    const missingUser = (
      <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="dp-card p-4 text-[13px] text-[#4B5368]">
          Student username not found.
        </div>
      </div>
    )
    return adminView ? <AdminFrame showBuiltInToolbar={false}>{missingUser}</AdminFrame> : missingUser
  }

  if (!adminView && !auth.username) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="dp-card p-4 text-[13px] text-[#4B5368]">
          Sign in with GitHub first to view your learning path.
        </div>
      </div>
    )
  }

  const unreadLearningPathCount = !adminView && targetUsername && projectPaths
    ? getStudentLearningPathNotificationCount(targetUsername, projectPaths)
    : 0

  const content = (
    <div className="lspu-stagger mx-auto max-w-[1240px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      {stageUpdateToast && !adminView ? (
        <div className="fixed right-5 top-5 z-[90] max-w-[320px] rounded-[12px] border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-[12px] text-[#166534] shadow-[0_10px_30px_rgba(22,101,52,0.16)]">
          <div className="flex items-start justify-between gap-3">
            <p>{stageUpdateToast}</p>
            <button
              type="button"
              onClick={() => setStageUpdateToast("")}
              className="rounded-full border border-[#bbf7d0] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#166534]"
            >
              x
            </button>
          </div>
        </div>
      ) : null}
      {feedbackToast ? (
        <div className={`fixed right-5 ${stageUpdateToast ? "top-24" : "top-5"} z-[90] max-w-[320px] rounded-[12px] border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-[12px] text-[#7f1d1d] shadow-[0_10px_30px_rgba(127,29,29,0.18)]`}>
          <div className="flex items-start justify-between gap-3">
            <p>{feedbackToast}</p>
            <button
              type="button"
              onClick={() => setFeedbackToast("")}
              className="rounded-full border border-[#fecaca] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#b42318]"
            >
              x
            </button>
          </div>
        </div>
      ) : null}
      {adminView ? (
        <section className="rounded-[22px] border border-violet-100 bg-white/90 p-5 shadow-[0_16px_28px_rgba(63,66,120,0.12)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#6D6AA6]">Admin View</p>
              <h1 className="mt-2 text-[24px] font-semibold text-[#1E1A3C]">Learning Path for @{targetUsername}</h1>
              <p className="mt-1 text-[12px] text-[#6A6F88]">Read-only roadmap view for faculty and admin review.</p>
            </div>
            {embedded ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-[#cfd6ff] bg-white px-4 py-2 text-[11px] font-semibold text-[#3b3a70] shadow-sm"
              >
                Close
              </button>
            ) : (
              <a
                href="/admin/students"
                className="rounded-full border border-[#cfd6ff] bg-white px-4 py-2 text-[11px] font-semibold text-[#3b3a70] shadow-sm"
              >
                Back to Students
              </a>
            )}
          </div>
        </section>
      ) : null}
      <section className="relative overflow-hidden rounded-[26px] border border-[#dfe6fb] bg-[linear-gradient(135deg,#f5f2ff,#eef6ff_55%,#f8fbff)] p-6 shadow-[0_20px_40px_rgba(76,81,164,0.12)]">
        <div className="pointer-events-none absolute -right-6 top-6 h-24 w-24 rounded-full bg-[#c7d2fe] opacity-40 blur-2xl" />
        <div className="pointer-events-none absolute -left-8 bottom-0 h-20 w-20 rounded-full bg-[#bae6fd] opacity-40 blur-2xl" />
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#6D6AA6]">Per-Repo Adaptive Roadmap</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="text-[26px] font-semibold text-[#1E1A3C]">Learning Path</h1>
              {!adminView && unreadLearningPathCount > 0 ? (
                <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-[#ef4444] px-2 py-1 text-[10px] font-bold leading-none text-white">
                  {unreadLearningPathCount > 99 ? "99+" : unreadLearningPathCount}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-[12px] text-[#6A6F88]">
              Select a repository to see its staged roadmap, evidence, and milestones.
            </p>
          </div>
          {!adminView ? (
            <button
              type="button"
              disabled={recomputing || loading}
              onClick={handleRecompute}
              className="rounded-full border border-[#cfd6ff] bg-white px-4 py-2 text-[11px] font-semibold text-[#3b3a70] shadow-sm disabled:opacity-60"
            >
              {recomputing ? "Recomputing..." : "Recompute Insights"}
            </button>
          ) : null}
        </div>
      </section>

      {loading ? (
        <section className="rounded-[14px] border border-[#d6dcef] bg-white px-4 py-3 text-[13px] text-[#55607A] shadow-sm">
          Loading learning path and repo roadmaps...
        </section>
      ) : null}

      {loadError ? (
        <section className="rounded-[14px] border border-[#f0b4b4] bg-[#fff1f1] px-4 py-3 text-[13px] text-[#9f1d1d] shadow-sm">
          {loadError}
        </section>
      ) : null}

      {projectPathError && !loadError ? (
        <section className="rounded-[14px] border border-[#f3d29a] bg-[#fff8e6] px-4 py-3 text-[13px] text-[#8a5a00] shadow-sm">
          {projectPathError}
        </section>
      ) : null}

      <section className="rounded-[22px] border border-[#e2e6fb] bg-white/85 p-5 shadow-[0_16px_28px_rgba(63,66,120,0.12)]">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[#6D6AA6]">Repositories</p>
        <p className="mt-1 text-[12px] text-[#6A6F88]">Pick a repo to view its skill stages and milestones.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {roadmaps.length ? roadmaps.map((roadmap) => {
            const repo = (portfolio?.repos || []).find((item) => item.name === roadmap.repoName)
            const projectPath = projectPaths?.projects?.find(
              (project) => normalizeStorageKey(project.repo_name) === normalizeStorageKey(roadmap.repoName)
            )
            const repoCompleted = Boolean(projectPath?.repo_completed)
            const repoStatuses = stageStatusByRepo[roadmap.repoName] || {}
            const repoStarted = Object.values(repoStatuses).some((status) => status !== "not_started")
            const repoStatusLabel = repoCompleted ? "Completed" : repoStarted ? "In Progress" : "Not Started"
            const selected = activeRoadmap?.repoName === roadmap.repoName
            return (
              <button
                key={roadmap.repoName}
                type="button"
                aria-pressed={selected}
                onClick={() => setSelectedRepo(roadmap.repoName)}
                className={`flex min-h-[42px] items-center gap-3 rounded-[12px] border px-4 py-2 text-left shadow-sm transition hover:-translate-y-[1px] ${
                  selected
                    ? "border-[#3b82f6] bg-[#eaf1ff] text-[#1e3a8a]"
                    : "border-[#d6dcef] bg-white text-[#1E2538]"
                }`}
              >
                <span className="grid h-6 w-6 place-items-center rounded-[6px] border border-current text-[10px]">#</span>
                <div className="min-w-0">
                  <p className="max-w-[170px] truncate text-[13px] font-semibold">{roadmap.repoName}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className="text-[11px] font-semibold text-[#6A6F88]">{inferRepoTrack(repo)}</p>
                    {adminView ? (
                      <span className="rounded-full border border-current/20 px-2 py-0.5 text-[10px] font-semibold">
                        {repoStatusLabel}
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            )
          }) : (
            <div className="rounded-[12px] border border-[#d6dcef] bg-white px-4 py-2 text-[12px] text-[#6A6F88]">
              {loading
                ? "Loading repositories..."
                : loadError
                  ? "Repositories could not be loaded. Resolve the error above, then refresh."
                  : "No repositories yet. Sync GitHub, then recompute insights."}
            </div>
          )}
        </div>
      </section>

      {activeRoadmap ? (
        <>
          <section id="learning-path-evidence" className="rounded-[22px] border border-[#e2e6fb] bg-white/85 p-5 shadow-[0_16px_28px_rgba(63,66,120,0.12)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-[#6D6AA6]">{adminView ? "Review Snapshot" : "Evidence Files"}</p>
                <p className="mt-1 text-[12px] text-[#6A6F88]">
                  {adminView
                    ? hasSubmittedFinalEvidence
                      ? "Faculty-friendly overview of the student's submitted final repo evidence."
                      : "Final repo evidence will appear here after the student finishes all skill stages and sends the evidence links."
                    : activeRepoCompleted
                      ? "Completed repos now show the submitted stage proof bundle and direct GitHub link for review."
                      : canPrepareFinalEvidence
                        ? "Add supporting screenshots, videos, and docs here for this repository."
                        : "Finish all skill stages first. Evidence Files will wait here until the repo is ready for final submission."}
                </p>
                {activeRepoName ? (
                  <p className="mt-1 text-[11px] font-semibold text-[#2563eb]">Repo: {activeRepoName}</p>
                ) : null}
                {!adminView && activeRepoGithubUrl && canPrepareFinalEvidence ? (
                  <a
                    href={activeRepoGithubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block text-[11px] font-semibold text-[#1d4ed8] hover:underline"
                  >
                    GitHub: {activeRepoGithubUrl}
                  </a>
                ) : null}
                {!adminView && canPrepareFinalEvidence && activeRepoGithubUrl ? (
                  <p className="mt-2 text-[11px] font-semibold text-[#0f766e]">
                    Final stage done. Check the GitHub repo link here before sending your final evidence.
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {lastStage && hasSubmittedFinalEvidence ? (
                  <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${finalStageReviewMeta.className}`}>
                    {adminView ? `Review: ${finalStageReviewMeta.label}` : "Complete send final proof"}
                  </span>
                ) : null}
                {lastStage && hasSubmittedFinalEvidence ? (
                  <button
                    type="button"
                    onClick={() => openFinalStageProofViewer(activeRoadmap?.repoName || "", lastStage.title, finalStageUpdate)}
                    className="relative rounded-full border border-[#d6e4ff] bg-white px-4 py-2 text-[11px] font-semibold text-[#1d4ed8] shadow-sm"
                  >
                    {adminView ? "Open review thread" : "Open evidence thread"}
                    {finalStageNotificationCount > 0 ? (
                      <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#ef4444] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                        {finalStageNotificationCount > 99 ? "99+" : finalStageNotificationCount}
                      </span>
                    ) : null}
                  </button>
                ) : null}
                {activeRepoGithubUrl && (adminView ? hasSubmittedFinalEvidence : canPrepareFinalEvidence) ? (
                  <a
                    href={activeRepoGithubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`rounded-full border bg-white px-4 py-2 text-[11px] font-semibold shadow-sm hover:underline ${
                      isLastStageDone || activeRepoCompleted
                        ? "border-[#bbf7d0] text-[#166534]"
                        : "border-[#bfd3ff] text-[#1d4ed8]"
                    }`}
                  >
                    {isLastStageDone || activeRepoCompleted ? "Updated GitHub link" : "Open GitHub repo"}
                  </a>
                ) : null}
                {!adminView && hasSubmittedFinalEvidence ? (
                  <span className="rounded-full border border-[#bbf7d0] bg-[#ecfdf3] px-4 py-2 text-[11px] font-semibold text-[#166534] shadow-sm">
                    Complete send final proof
                  </span>
                ) : null}
                {!adminView && canPrepareFinalEvidence && activeEvidenceItems.length && !hasSubmittedFinalEvidence ? (
                  <button
                    type="button"
                    disabled={
                      savingEvidenceRepoKey === activeRepoName ||
                      !activeRepoName ||
                      !activeRepoGithubUrl ||
                      !allSkillStagesReadyForFinalEvidence ||
                      activeRepoCompleted
                    }
                    onClick={() => void saveEvidenceFilesForRepo(activeRepoName)}
                    className="rounded-full border border-[#bbf7d0] bg-[#ecfdf3] px-4 py-2 text-[11px] font-semibold text-[#166534] shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingEvidenceRepoKey === activeRepoName ? "Sending evidence..." : "Send evidence links"}
                  </button>
                ) : null}
                {!adminView && canPrepareFinalEvidence ? (
                  <button
                    type="button"
                    disabled={!activeRepoName || activeRepoCompleted}
                    onClick={() => {
                      if (!activeRepoName) return
                      const added = addEvidenceLink(
                        activeRepoName,
                        evidenceNameDraftByRepo[activeRepoName] || "",
                        evidenceLinkDraftByRepo[activeRepoName] || ""
                      )
                      if (!added) {
                        setProjectPathError("Paste at least one valid evidence URL first.")
                      }
                    }}
                    className="rounded-full border border-[#cfd6ff] bg-white px-4 py-2 text-[11px] font-semibold text-[#3b3a70] shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {activeRepoCompleted ? "Repo completed" : "Add link"}
                  </button>
                ) : null}
                </div>
            </div>

            {adminView && lastStage && hasSubmittedFinalEvidence ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={savingAdminFeedbackKey === `${activeRoadmap?.repoName || ""}::${lastStage.title}`}
                  onClick={() => void saveAdminStageFeedback(activeRoadmap?.repoName || "", lastStage.title, undefined, "pending")}
                  className="rounded-full border border-[#fde68a] bg-[#fffbeb] px-3 py-1.5 text-[11px] font-semibold text-[#b45309] disabled:opacity-60"
                >
                  Mark pending
                </button>
                <button
                  type="button"
                  disabled={savingAdminFeedbackKey === `${activeRoadmap?.repoName || ""}::${lastStage.title}`}
                  onClick={() => void saveAdminStageFeedback(activeRoadmap?.repoName || "", lastStage.title, undefined, "accepted")}
                  className="rounded-full border border-[#bbf7d0] bg-[#ecfdf3] px-3 py-1.5 text-[11px] font-semibold text-[#166534] disabled:opacity-60"
                >
                  Accept
                </button>
                <button
                  type="button"
                  disabled={savingAdminFeedbackKey === `${activeRoadmap?.repoName || ""}::${lastStage.title}`}
                  onClick={() => void saveAdminStageFeedback(activeRoadmap?.repoName || "", lastStage.title, undefined, "rejected")}
                  className="rounded-full border border-[#fecaca] bg-[#fff1f2] px-3 py-1.5 text-[11px] font-semibold text-[#b42318] disabled:opacity-60"
                >
                  Reject
                </button>
                <p className="text-[11px] text-[#6A6F88]">
                  {finalStageReviewStatus === "pending"
                    ? "Student submitted final evidence. Review the GitHub link, files, and comments before accepting."
                    : finalStageReviewStatus === "accepted"
                      ? "Final evidence has been accepted. Student can see this update in their notifications."
                      : "Final evidence needs revision. Leave comments in the review thread so the student knows what to fix."}
                </p>
              </div>
            ) : null}

            {adminView ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className={`rounded-[16px] border p-4 ${hasSubmittedFinalEvidence && activeRepoGithubUrl ? "border-[#d6e4ff] bg-[linear-gradient(180deg,#f9fbff_0%,#eef4ff_100%)]" : "border-[#fecaca] bg-[#fff1f2]"}`}>
                  <p className={`text-[11px] font-bold uppercase tracking-[0.08em] ${activeRepoGithubUrl ? "text-[#31538f]" : "text-[#b42318]"}`}>
                    GitHub Link
                  </p>
                  {hasSubmittedFinalEvidence && activeRepoGithubUrl ? (
                    <>
                      <p className="mt-2 text-[13px] font-semibold text-[#0f172a]">{activeRepoLinkItem?.name || `${activeRepoName} GitHub repository`}</p>
                      <a
                        href={activeRepoGithubUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 block truncate text-[12px] font-semibold text-[#2563eb] hover:underline"
                      >
                        {activeRepoGithubUrl}
                      </a>
                      <a
                        href={activeRepoGithubUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex rounded-full border border-[#bfd3ff] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#1d4ed8] hover:underline"
                      >
                        Open GitHub repo
                      </a>
                    </>
                  ) : (
                    <>
                      <p className="mt-2 text-[13px] font-semibold text-[#7f1d1d]">
                        {hasSubmittedFinalEvidence ? "No GitHub link synced yet" : "Waiting for final evidence submission"}
                      </p>
                      <p className="mt-1 text-[12px] leading-5 text-[#7f1d1d]">
                        {hasSubmittedFinalEvidence
                          ? "The repository link is still missing, so the admin cannot verify the latest code update from GitHub yet."
                          : "The GitHub review link will appear here after the student completes all skill stages and sends the final evidence links."}
                      </p>
                    </>
                  )}
                </div>

                <div className={`rounded-[16px] border p-4 ${hasSubmittedFinalEvidence ? "border-[#dbe7ff] bg-[linear-gradient(180deg,#f8fbff_0%,#eef5ff_100%)]" : "border-[#fecaca] bg-[#fff1f2]"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className={`text-[11px] font-bold uppercase tracking-[0.08em] ${finalStageProofItems.length ? "text-[#31538f]" : "text-[#b42318]"}`}>
                        Evidence Files
                      </p>
                      {finalStageProofItems.length ? (
                        <p className="mt-2 text-[13px] font-semibold text-[#102a43]">
                          {finalStageProofItems.length} final evidence link{finalStageProofItems.length === 1 ? "" : "s"} submitted
                        </p>
                      ) : (
                        <p className="mt-2 text-[13px] font-semibold text-[#7f1d1d]">No evidence links submitted yet</p>
                      )}
                    </div>
                    {finalStageProofItems.length ? (
                      <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${finalStageReviewMeta.className}`}>
                        {finalStageReviewMeta.label}
                      </span>
                    ) : null}
                  </div>
                  <p className={`mt-1 text-[12px] leading-5 ${finalStageProofItems.length ? "text-[#52667a]" : "text-[#7f1d1d]"}`}>
                    {finalStageProofItems.length
                      ? "The final bundle is already in the repo review area together with the GitHub link."
                      : "The student has not sent the final evidence bundle for this repository review yet."}
                  </p>
                  {hasSubmittedFinalEvidence ? (
                    <button
                      type="button"
                      onClick={() => openFinalStageProofViewer(activeRoadmap?.repoName || "", lastStage?.title || "", finalStageUpdate)}
                      className="mt-3 inline-flex rounded-full border border-[#d6e4ff] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#1d4ed8]"
                    >
                      Open evidence links
                    </button>
                  ) : null}
                </div>

              </div>
            ) : null}

            {!adminView && !canPrepareFinalEvidence ? (
              <div className="mt-4 rounded-[16px] border border-[#fde68a] bg-[#fffbeb] px-4 py-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#b45309]">Waiting For Skill Stages</p>
                <p className="mt-2 text-[12px] leading-5 text-[#92400e]">
                  Finish all skill stages first. After that, this section will open the final `Evidence Files` flow and show the GitHub link you need to review before sending.
                </p>
              </div>
            ) : null}

            {!adminView && canPrepareFinalEvidence && activeEvidenceItems.length ? (
              <p className="mt-3 text-[11px] font-semibold text-[#166534]">
                Send these evidence links after all stage outputs are done and the GitHub repo link above is correct.
              </p>
            ) : null}

            {!adminView && hasSubmittedFinalEvidence ? (
              <div className="mt-3 rounded-[14px] border border-[#bbf7d0] bg-[#ecfdf3] px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#166534]">Complete Send Final Proof</p>
                <p className="mt-1 text-[12px] text-[#166534]">
                  Your evidence links and GitHub repo link were sent successfully. This final proof is now visible in the admin View Learning Path.
                </p>
              </div>
            ) : null}

            {!adminView && activeRepoGithubUrl && canPrepareFinalEvidence ? (
              <div className="mt-3 rounded-[14px] border border-[#d6e4ff] bg-white px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-semibold text-[#0f172a]">
                      {activeRepoLinkItem?.name || `${activeRepoName} GitHub repository`}
                    </p>
                    <p className="mt-1 text-[11px] text-[#64748b]">
                      {isLastStageDone && !activeRepoCompleted
                        ? "You are on the final step now. Confirm this updated repo link beside your evidence links."
                        : activeRepoLinkItem?.source || "Full working system"}
                    </p>
                  </div>
                  <a
                    href={activeRepoGithubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-[#bfd3ff] bg-[#eef4ff] px-3 py-1.5 text-[11px] font-semibold text-[#1d4ed8] hover:underline"
                  >
                    Open repo
                  </a>
                </div>
                <a
                  href={activeRepoGithubUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block truncate text-[12px] font-semibold text-[#2563eb] hover:underline"
                >
                  {activeRepoGithubUrl}
                </a>
              </div>
            ) : null}

            {adminView ? (
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[12px] border border-[#dcfce7] bg-[linear-gradient(180deg,#f3fff7_0%,#e8fff1_100%)] p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#166534]">Complete stage</p>
                  <p className="mt-2 text-[24px] font-semibold text-[#14532d]">{completeStages}</p>
                  <p className="mt-1 text-[12px] text-[#166534]">Outputs checked and stage proof already saved</p>
                </div>
                <div className="rounded-[12px] border border-[#d6e7ff] bg-[linear-gradient(180deg,#f8fbff_0%,#eef5ff_100%)] p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#4d6b99]">Done stages</p>
                  <p className="mt-2 text-[24px] font-semibold text-[#102a43]">{doneStages}</p>
                  <p className="mt-1 text-[12px] text-[#5f6c7b]">All outputs checked, still missing saved stage proof</p>
                </div>
                <div className="rounded-[12px] border border-[#fde7b2] bg-[linear-gradient(180deg,#fffaf0_0%,#fff4d8_100%)] p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8a5a00]">Ongoing stages</p>
                  <p className="mt-2 text-[24px] font-semibold text-[#7c4a03]">{ongoingStages}</p>
                  <p className="mt-1 text-[12px] text-[#7a6550]">Need more implementation or proof</p>
                </div>
                <div className="rounded-[12px] border border-[#e5e7eb] bg-[linear-gradient(180deg,#fcfcfd_0%,#f4f5f7_100%)] p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#667085]">Not started</p>
                  <p className="mt-2 text-[24px] font-semibold text-[#344054]">{notStartedStages}</p>
                  <p className="mt-1 text-[12px] text-[#667085]">Still missing clear repo signals</p>
                </div>
              </div>
            ) : null}

            {activeRepoCompleted || (adminView && hasSubmittedFinalEvidence) ? (
              <div className="mt-4 rounded-[16px] border border-[#dbe7ff] bg-[linear-gradient(180deg,#f9fbff_0%,#eef4ff_100%)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#31538f]">
                      {adminView ? "Review Bundle" : "Completed Repo Bundle"}
                    </p>
                    <p className="mt-1 text-[13px] text-[#4f6280]">
                      Direct GitHub repo link plus the saved stage proof links submitted across the completed skill stages.
                    </p>
                    {lastStage && finalStageProofItems.length ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${finalStageReviewMeta.className}`}>
                          Final review: {finalStageReviewMeta.label}
                        </span>
                        <span className="text-[11px] text-[#64748b]">
                          {finalStageProofItems.length} evidence file{finalStageProofItems.length === 1 ? "" : "s"}
                          {finalStageUpdate?.review_status_updated_at ? ` - ${formatRealtimeStamp(String(finalStageUpdate.review_status_updated_at))}` : ""}
                        </span>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {lastStage && finalStageProofItems.length ? (
                      <button
                        type="button"
                        onClick={() => openFinalStageProofViewer(activeRoadmap?.repoName || "", lastStage.title, finalStageUpdate)}
                        className="relative rounded-full border border-[#fbcfe8] bg-white px-4 py-2 text-[11px] font-semibold text-[#9f1239] shadow-sm"
                      >
                        {adminView ? "Review comments" : "View review comments"}
                        {finalStageNotificationCount > 0 ? (
                          <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#ef4444] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                            {finalStageNotificationCount > 99 ? "99+" : finalStageNotificationCount}
                          </span>
                        ) : null}
                      </button>
                    ) : null}
                    {activeRepoLinkItem ? (
                      <a
                        href={activeRepoLinkItem.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-[#bfd3ff] bg-white px-4 py-2 text-[11px] font-semibold text-[#1d4ed8] shadow-sm hover:underline"
                      >
                        Open GitHub repo
                      </a>
                    ) : null}
                  </div>
                </div>

                {activeRepoLinkItem ? (
                  <div className="mt-3 rounded-[14px] border border-[#d6e4ff] bg-white px-4 py-3">
                    <p className="text-[12px] font-semibold text-[#0f172a]">{activeRepoLinkItem.name}</p>
                    <p className="mt-1 text-[11px] text-[#64748b]">{activeRepoLinkItem.source}</p>
                    <a
                      href={activeRepoLinkItem.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 block truncate text-[12px] font-semibold text-[#2563eb] hover:underline"
                    >
                      {activeRepoLinkItem.url}
                    </a>
                  </div>
                ) : null}

                {activeRepoProofShowcaseItems.length ? (
                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
                    {activeRepoProofShowcaseItems.map((item) => (
                      <div key={`${item.kind}:${item.url}`} className="overflow-hidden rounded-[14px] border border-[#dbe4ee] bg-white shadow-sm">
                        <div className="group block w-full text-left">
                          <div className="relative aspect-[4/3] overflow-hidden bg-[#eef2f7]">
                            {item.kind === "image" ? (
                              <a href={item.url} target="_blank" rel="noreferrer" className="block h-full w-full">
                                <img src={item.url} alt={item.name} loading="lazy" className="h-full w-full object-cover" />
                              </a>
                            ) : item.kind === "video" ? (
                              <div className="h-full w-full bg-black">
                                <video
                                  src={item.url}
                                  controls
                                  playsInline
                                  preload="none"
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            ) : item.kind === "pdf" ? (
                              <a href={item.url} target="_blank" rel="noreferrer" className="flex h-full w-full items-center justify-center text-[13px] font-semibold text-[#334155]">
                                PDF
                              </a>
                            ) : (
                              <a href={item.url} target="_blank" rel="noreferrer" className="flex h-full w-full items-center justify-center text-[13px] font-semibold text-[#334155]">
                                FILE
                              </a>
                            )}
                          </div>
                          <div className="px-4 py-2.5">
                            <p className="truncate text-[14px] font-semibold text-[#111827]">{item.name}</p>
                            <p className="text-[12px] text-[#6A7288]">{item.source} • {item.kind === "repo" ? "Repository" : evidenceKindLabel(item.kind)}</p>
                          </div>
                        </div>
                        <div className="border-t border-[#e2e8f0] px-4 py-2 text-[12px]">
                          <a href={item.url} target="_blank" rel="noreferrer" className="font-semibold text-[#2563eb] hover:underline">
                            Open proof
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-[14px] border border-dashed border-[#d6e4ff] bg-white/80 px-4 py-4 text-[12px] text-[#5b6478]">
                    No saved stage proof links were found in the completed repo bundle yet.
                  </div>
                )}
              </div>
            ) : null}

            {!adminView && canPrepareFinalEvidence ? (
              <div className="mt-3 rounded-[14px] border border-dashed border-[#cfd6e6] bg-white p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#667085]">Final Evidence Links</p>
                <input
                  value={evidenceNameDraftByRepo[activeRepoName] || ""}
                  onChange={(event) =>
                    setEvidenceNameDraftByRepo((prev) => ({
                      ...prev,
                      [activeRepoName]: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-[10px] border border-[#d6dcef] bg-white px-3 py-2 text-[12px] text-[#111827] outline-none"
                  placeholder="Proof name (e.g. Final Demo Video)"
                />
                <textarea
                  value={evidenceLinkDraftByRepo[activeRepoName] || ""}
                  onChange={(event) =>
                    setEvidenceLinkDraftByRepo((prev) => ({
                      ...prev,
                      [activeRepoName]: event.target.value,
                    }))
                  }
                  rows={3}
                  className="mt-2 w-full rounded-[10px] border border-[#d6dcef] bg-white px-3 py-2 text-[12px] text-[#111827] outline-none"
                  placeholder="Paste one shareable proof URL"
                />
                <p className="mt-2 text-[11px] text-[#667085]">
                  Use public or shareable links from Google Drive, YouTube unlisted, Cloudinary, or another storage provider.
                </p>
              </div>
            ) : null}

            {!adminView && activeEvidenceItems.length ? (
              <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
                {activeEvidenceItems.map((item) => {
                  const key = evidenceItemKey(item)
                  return (
                    <div key={key} className="overflow-hidden rounded-[14px] border border-[#e2e8f0] bg-white shadow-sm">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="group block w-full text-left"
                      >
                        <div className="relative aspect-[4/3] overflow-hidden bg-[#eef2f7]">
                          {item.kind === "image" ? (
                            <img src={item.url} alt={item.name} className="h-full w-full object-cover" />
                          ) : item.kind === "video" ? (
                            <video
                              src={item.url}
                              muted
                              playsInline
                              preload="metadata"
                              className="h-full w-full object-cover"
                            />
                          ) : item.kind === "pdf" ? (
                            <div className="flex h-full w-full items-center justify-center text-[13px] font-semibold text-[#334155]">
                              PDF
                            </div>
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[13px] font-semibold text-[#334155]">
                              FILE
                            </div>
                          )}
                        </div>
                        <div className="px-4 py-2.5">
                          <p className="truncate text-[14px] font-semibold text-[#111827]">{item.name}</p>
                          <p className="text-[12px] text-[#6A7288]">{evidenceKindLabel(item.kind)} • Shareable link</p>
                        </div>
                      </a>
                      <div className="flex items-center justify-between border-t border-[#e2e8f0] px-4 py-2 text-[12px]">
                        <a href={item.url} target="_blank" rel="noreferrer" className="font-semibold text-[#2563eb] hover:underline">
                          Open
                        </a>
                        <button
                          type="button"
                          onClick={() => removeEvidenceFile(activeRepoName, key)}
                          className="font-semibold text-[#b91c1c] hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : !adminView ? (
              <div className="mt-3 rounded-[8px] border border-dashed border-[#cfd6e6] bg-[#f8fafc] px-3 py-4 text-[12px] text-[#6A7288]">
                {activeRepoCompleted
                  ? "No extra evidence links added for this repo."
                  : "No links yet. Add screenshots, demo videos, or documents using shareable URLs for this repo."}
              </div>
            ) : null}
          </section>

          <section className="rounded-[10px] border border-[#d6dce8] bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-[780px]">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#667085]">{activeRoadmap.repoName}</p>
                <h2 className="mt-1 text-[24px] font-semibold text-[#111827]">{activeTrack}</h2>
                <p className="mt-2 text-[13px] leading-6 text-[#4b5563]">{activeRoadmap.summary}</p>
              </div>
              <span className="rounded-full bg-[#dcecff] px-3 py-1 text-[12px] font-semibold text-[#2563eb]">
                {activeRoadmap.progress}% ready
              </span>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between text-[12px] text-[#4b5563]">
                <p>Overall progress</p>
                <p>{totalXp - xpRemaining} / {totalXp} XP</p>
              </div>
              <div className="mt-2 h-2.5 rounded-full bg-[#edf0e8]">
                <div className="h-2.5 rounded-full bg-[#3182e8]" style={{ width: `${activeRoadmap.progress}%` }} />
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-[8px] bg-[#f5f3ed] p-4">
                <p className="text-[24px] font-semibold text-[#111827]">{completeStages}/{activeRoadmap.stages.length}</p>
                <p className="text-[13px] text-[#4b5563]">Complete stages</p>
              </div>
              <div className="rounded-[8px] bg-[#f5f3ed] p-4">
                <p className="text-[24px] font-semibold text-[#111827]">{xpRemaining}</p>
                <p className="text-[13px] text-[#4b5563]">XP remaining</p>
              </div>
              <div className="rounded-[8px] bg-[#f5f3ed] p-4">
                <p className="line-clamp-2 text-[15px] font-semibold text-[#111827]">{currentMilestoneStage?.title || nextMilestone?.title || "Add project evidence"}</p>
                <p className="mt-1 text-[13px] text-[#4b5563]">Current milestone</p>
              </div>
            </div>

            {!adminView ? (
              <div className="mt-5 rounded-[12px] border border-[#dbeafe] bg-[linear-gradient(180deg,#f8fbff_0%,#f1f7ff_100%)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#3b82f6]">Need help?</p>
                    <p className="mt-1 text-[12px] text-[#52667a]">Open the step-by-step guide if you want to know exactly how to use this learning path page.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowStudentGuide(true)}
                    className="rounded-full border border-[#bfdbfe] bg-white px-4 py-2 text-[11px] font-semibold text-[#1d4ed8]"
                  >
                    View instructions
                  </button>
                </div>
              </div>
            ) : null}

            {!adminView ? (
              <div className="mt-5 rounded-[12px] border border-[#d8e3ff] bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#4d6b99]">Learning Path Reward</p>
                    <p className="mt-2 text-[18px] font-semibold text-[#102a43]">
                      {activeRepoCompleted ? "Learning Path Completed" : "Stage Reward"}
                    </p>
                    <p className="mt-1 text-[13px] text-[#52667a]">
                      {activeRepoCompleted
                        ? `This learning path is complete${activeProjectPath?.repo_completed_at ? ` as of ${formatRealtimeStamp(activeProjectPath.repo_completed_at)}` : ""}.`
                        : "Finish all skill stages, save the proof inside each stage archive, then claim the repo XP reward."}
                    </p>
                    <p className="mt-2 text-[12px] font-semibold text-[#1d4ed8]">
                      {activeRepoCompleted
                        ? `Total claim reward: ${totalXp} XP`
                        : `Proof-ready stages: ${activeStageProofReadyCount} / ${activeStages.length} | Claim reward: ${totalXp} XP`}
                    </p>
                    {!activeRepo?.htmlUrl ? (
                      <p className="mt-2 text-[12px] font-semibold text-[#b45309]">
                        Sync the repository link first. The completed bundle needs the GitHub repo link beside the saved stage proofs.
                      </p>
                    ) : null}
                  </div>
                  {activeRepoCompleted ? (
                    <span className="rounded-full border border-[#bbf7d0] bg-[#ecfdf3] px-4 py-2 text-[12px] font-semibold text-[#166534] shadow-sm">
                      Completed
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={!canClaimRepoReward || claimingRepoRewardKey === activeRoadmap.repoName}
                      onClick={() => void handleClaimRepoReward(activeRoadmap.repoName)}
                      className="rounded-full border border-[#93c5fd] bg-white px-4 py-2 text-[12px] font-semibold text-[#1d4ed8] shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {claimingRepoRewardKey === activeRoadmap.repoName ? "Claiming..." : "Claim XP reward"}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-[12px] border border-[#d8e3ff] bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#4d6b99]">Learning Path</p>
                <p className="mt-2 text-[18px] font-semibold text-[#102a43]">
                  {activeRepoCompleted ? "Learning Path Completed" : "Active Stage Reward"}
                </p>
                <p className="mt-2 text-[13px] text-[#52667a]">
                  Admin review sees the current learning-path reward progress without extra path-level UI.
                </p>
              </div>
            )}
          </section>

          <section id="learning-path-stages">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#3f4656]">Skill Stages</p>
                <p className="mt-1 text-[12px] text-[#6A7288]">Simple stage guide showing what outputs are already ready for review.</p>
              </div>
              <span className="rounded-full bg-[#eef2ff] px-2.5 py-1 text-[11px] font-semibold text-[#2f3a8c]">
                {completeStages} complete, {doneStages} missing proof, {activeRoadmap.stages.length} total stages
              </span>
            </div>
            <div className={`grid gap-3 ${adminView ? "md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"}`}>
              {activeStages.map((stage, index) => {
                const styles = stageStyles(stage.status)
                const savedStageUpdate = getRecordValue(activeProjectPath?.stage_progress_updates, stage.title)
                const progressArchiveEntries = normalizeStageProgressEntries(savedStageUpdate)
                const latestProgressArchiveEntry = progressArchiveEntries[progressArchiveEntries.length - 1] || null
                const rawProgressProofItems = latestProgressArchiveEntry?.proof_items || savedStageUpdate?.proof_items || []
                const progressProofItems = rawProgressProofItems
                const stageBusy = Boolean(busyStageKeys[stageStateKey(activeRoadmap.repoName, stage.title)])
                const draftStageFiles = stageUpdateFilesByRepo[activeRoadmap.repoName]?.[stage.title] || []
                const draftStageLinkName = stageUpdateLinkNameDraftByRepo[activeRoadmap.repoName]?.[stage.title] || ""
                const draftStageLinks = stageUpdateLinkDraftByRepo[activeRoadmap.repoName]?.[stage.title] || ""
                const draftStageComment = stageUpdateCommentByRepo[activeRoadmap.repoName]?.[stage.title] || ""
                const isSavingStageUpdate = savingStageUpdateKey === `${activeRoadmap.repoName}::${stage.title}`
                const stageChecks = normalizeStageChecks(stage.items, (stage as StageCard & { checks?: boolean[] }).checks)
                const stageLocked = Boolean((stage as StageCard & { locked?: boolean }).locked)
                const stageHasProgressProof = hasSavedStageProgressProof(savedStageUpdate)
                const stageSavedProofCount = countSavedStageProgressProofItems(savedStageUpdate)
                const stageProofCount = Math.max(
                  stageProofStatusByRepo[activeRoadmap.repoName]?.[stage.title] || 0,
                  getRecordValue(activeProjectPath?.stage_proof_counts, stage.title) || 0,
                  stageSavedProofCount
                )
                const lastOutputLockedByProof = !canUnlockLastStageOutput(stage.items, stageProofCount)
                const warningStageItems = warningStageItemsByRepo[activeRoadmap.repoName]?.[stage.title] || {}
                const isVisuallyLocked = stageLocked
                const isUnlocking = Boolean(unlockAnimationsByRepo[activeRoadmap.repoName]?.[stage.title])
                const stageNotificationCount = adminView
                  ? getAdminStageNotificationCount(targetUsername, activeRoadmap.repoName, stage.title, savedStageUpdate)
                  : getStudentStageNotificationCount(targetUsername, activeRoadmap.repoName, stage.title, savedStageUpdate)
                const countProofNotifications = (proofUrl?: string | null) => {
                  const normalizedProofUrl = String(proofUrl || "").trim()
                  if (!normalizedProofUrl) return 0
                  return adminView
                    ? getAdminProofNotificationCount(targetUsername, activeRoadmap.repoName, stage.title, normalizedProofUrl, savedStageUpdate)
                    : getStudentProofNotificationCount(targetUsername, activeRoadmap.repoName, stage.title, normalizedProofUrl, savedStageUpdate)
                }
                const progressArchiveNotificationCount = progressArchiveEntries.reduce((total, entry) => {
                  const proofUrls = Array.from(new Set((entry.proof_items || []).map((item) => String(item.url || "").trim()).filter(Boolean)))
                  return total + proofUrls.reduce((proofTotal, proofUrl) => proofTotal + countProofNotifications(proofUrl), 0)
                }, 0)
                const visibleStageNotificationCount = stageNotificationCount
                const stageStarted = stage.status === "in_progress" || isStageDoneLike(stage.status)
                const hasSavedStageUpdate = Boolean(latestProgressArchiveEntry?.comment || progressProofItems.length || progressArchiveEntries.length)
                const showAdminProgressPlaceholder =
                  adminView && stage.status === "in_progress" && !hasSavedStageUpdate
                const showOnlyViewProof = !adminView && hasSavedStageUpdate
                const showSavedProgressArchive = hasSavedStageUpdate || progressArchiveEntries.length > 0
                const showStageUpdate = adminView
                  ? showSavedProgressArchive || showAdminProgressPlaceholder
                  : stageStarted || showSavedProgressArchive
                return (
                  <article key={`${stage.title}-${index}`} className={`relative min-h-[190px] overflow-hidden rounded-[12px] border bg-white p-4 shadow-sm transition hover:-translate-y-[2px] ${styles.border} ${!adminView ? "md:min-h-0 md:p-0" : ""} ${isVisuallyLocked ? "opacity-60 stage-locked" : ""}`}>
                    {isVisuallyLocked ? (
                      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[12px] bg-white/60 bg-[linear-gradient(90deg,rgba(255,255,255,0.35)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.35)_1px,transparent_1px)] bg-[size:7px_7px] backdrop-blur-[1px]">
                        <div className="lock-pill">
                          <span className="lock-icon">
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 24 24"
                              className="lock-svg"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect className="lock-body" x="5" y="11" width="14" height="10" rx="2" />
                              <path className="lock-shackle" d="M8 11V8a4 4 0 1 1 8 0v3" />
                            </svg>
                          </span>
                          <span className="lock-text">Locked</span>
                        </div>
                      </div>
                    ) : null}
                    {isUnlocking ? (
                      <div className="pointer-events-none absolute right-4 top-4 z-20">
                        <div className="lock-pill lock-unlock">
                          <span className="lock-icon">
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 24 24"
                              className="lock-svg lock-unlock-anim"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect className="lock-body" x="5" y="11" width="14" height="10" rx="2" />
                              <path className="lock-shackle" d="M8 11V8a4 4 0 1 1 8 0v3" />
                            </svg>
                          </span>
                          <span className="lock-text">Unlocked</span>
                        </div>
                      </div>
                    ) : null}
                    <div className={`${isVisuallyLocked ? "blur-[2px] select-none" : ""} ${!adminView ? "md:grid md:grid-cols-[minmax(0,1fr)_minmax(290px,360px)]" : ""}`}>
                      <div className={`absolute inset-x-0 top-0 h-1 ${styles.accent}`} />
                      <div className={!adminView ? "md:p-5" : ""}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className={`grid h-9 w-9 place-items-center rounded-[8px] border text-[12px] font-semibold ${styles.border}`}>
                              {index + 1}
                            </div>
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.08em] text-[#667085]">Stage {index + 1}</p>
                              <div className="mt-1 flex items-start gap-2">
                                <h3 className="line-clamp-2 text-[15px] font-bold text-[#171a1f]">{stage.title}</h3>
                                {visibleStageNotificationCount > 0 ? (
                                  <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-[#ef4444] px-2 py-1 text-[10px] font-bold leading-none text-white">
                                    {visibleStageNotificationCount > 99 ? "99+" : visibleStageNotificationCount}
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 text-[12px] leading-5 text-[#5b647a]">{stage.summary}</p>
                            </div>
                          </div>
                          <span className={`min-w-[132px] rounded-full border px-3 py-1.5 text-center text-[11px] font-bold ${styles.border} ${styles.badge}`}>
                            {stageLocked ? "Locked" : stageLabel(stage.status)}
                          </span>
                        </div>

                        <div className="mt-3">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#667085]">Outputs</p>
                            {!adminView && stageHasProgressProof ? (
                              <p className="max-w-[220px] text-right text-[10px] font-semibold text-[#9a3412]">
                                Checked outputs are locked while progress proof exists.
                              </p>
                            ) : !adminView && lastOutputLockedByProof ? (
                              <p className="max-w-[220px] text-right text-[10px] font-semibold text-[#9a3412]">
                                Save a progress proof first.
                              </p>
                            ) : null}
                          </div>
                          <ul className="mt-2 space-y-1.5">
                            {stage.items.map((item, itemIndex) => {
                              const isLastOutput = itemIndex === stage.items.length - 1
                              const outputLockedByProof =
                                !adminView &&
                                !stageLocked &&
                                isLastOutput &&
                                !stageChecks[itemIndex] &&
                                lastOutputLockedByProof
                              const showWarningShake = Boolean(warningStageItems[itemIndex])
                              return (
                              <li key={`${stage.title}-${itemIndex}-${item}`}>
                                <button
                                  type="button"
                                  disabled={adminView || stageBusy}
                                  onClick={(event) => {
                                    event.preventDefault()
                                    event.stopPropagation()
                                    if (stageLocked) {
                                      triggerStageItemWarning(activeRoadmap.repoName, stage.title, itemIndex)
                                      setProjectPathError("Finish the earlier stage first before working on this locked output.")
                                      return
                                    }
                                    if (outputLockedByProof) {
                                      triggerStageItemWarning(activeRoadmap.repoName, stage.title, itemIndex)
                                      setProjectPathError(
                                        "Finish this stage first and save a progress proof before unlocking the last output."
                                      )
                                      return
                                    }
                                    void toggleStageItem(
                                      activeRoadmap.repoName,
                                      stage.title,
                                      stage.items,
                                      itemIndex,
                                      stageLocked,
                                      !adminView && stageHasProgressProof && stageChecks[itemIndex]
                                    )
                                  }}
                                  className={`flex w-full items-start gap-2 rounded-[8px] px-2 py-1 text-left text-[13px] leading-5 transition ${
                                    adminView || stageLocked || stageBusy || outputLockedByProof
                                      ? "cursor-default"
                                      : "hover:bg-[#f8fafc]"
                                  } ${stageChecks[itemIndex] ? "text-[#166534]" : "text-[#374151]"} ${showWarningShake ? "stage-output-warning-shake" : ""}`}
                                >
                                  <span className={
                                    stageLocked
                                      ? "text-[#73776f]"
                                      : stageChecks[itemIndex] || isStageDoneLike(stage.status)
                                        ? "text-[#2f7d32]"
                                        : "text-[#966006]"
                                  }>
                                    {stageLocked ? (
                                      <svg
                                        aria-hidden="true"
                                        viewBox="0 0 24 24"
                                        className="mt-[1px] h-4 w-4"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      >
                                        <rect x="5" y="11" width="14" height="10" rx="2" />
                                        <path d="M8 11V8a4 4 0 1 1 8 0v3" />
                                      </svg>
                                    ) : stageChecks[itemIndex] || isStageDoneLike(stage.status) ? "[x]" : "-"}
                                  </span>
                                  <span className={`font-medium ${stageChecks[itemIndex] || isStageDoneLike(stage.status) ? "line-through decoration-[#86efac]" : ""}`}>
                                    {item}
                                  </span>
                                </button>
                                {outputLockedByProof ? (
                                  <p className="pl-8 pr-2 text-[10px] font-medium text-[#b45309]">
                                    Save a progress proof first.
                                  </p>
                                ) : null}
                              </li>
                              )
                            })}
                          </ul>
                        </div>
                      </div>

                      <div className={!adminView ? "md:border-l md:border-[#e5eaf2] md:bg-[#fbfdff] md:p-4 md:[&>*:first-child]:mt-0" : ""}>
                    {!stageLocked ? (
                      <div className="mt-3 rounded-[12px] border border-[#dbe4ee] bg-white p-3 shadow-sm">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#667085]">Suggested resources</p>
                        <ul className="mt-2 space-y-1">
                          {stage.resources.map((resource) => (
                            <li key={`${stage.title}-${resource.url}`} className="text-[12px] text-[#1d4ed8]">
                              <a href={resource.url} target="_blank" rel="noreferrer" className="hover:underline">
                                {resource.name}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {showStageUpdate ? (
                      <div className={`mt-3 rounded-[12px] border p-3 shadow-sm ${
                        showAdminProgressPlaceholder
                          ? "border-[#fecaca] bg-[#fff1f2]"
                          : showOnlyViewProof
                            ? "border-[#cfd6ff] bg-[#f5f7ff]"
                          : "border-[#dbe4ee] bg-[#fbfdff]"
                      }`}>
                        {!showOnlyViewProof ? (
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${
                                showAdminProgressPlaceholder ? "text-[#b42318]" : "text-[#667085]"
                              }`}>
                                {showAdminProgressPlaceholder ? "No progress proof posted yet" : "Progress proof archive"}
                              </p>
                              <p className={`mt-1 text-[12px] ${
                                showAdminProgressPlaceholder ? "text-[#7f1d1d]" : "text-[#5b647a]"
                              }`}>
                                {showAdminProgressPlaceholder
                                  ? "The student has started this stage, but no progress message or update proof has been saved for admin review yet."
                                  : "Every posted progress proof is kept here for admin review and archived by update."}
                              </p>
                            </div>
                            {!adminView && latestProgressArchiveEntry?.updated_at ? (
                              <span className="rounded-full border border-[#d7dee8] bg-white px-2.5 py-1 text-[10px] font-semibold text-[#475467]">
                                {formatRealtimeStamp(latestProgressArchiveEntry.updated_at)}
                              </span>
                            ) : null}
                          </div>
                        ) : null}

                        {latestProgressArchiveEntry?.comment || progressProofItems.length || progressArchiveEntries.length ? (
                          adminView ? (
                            <div className="mt-3 rounded-[10px] border border-[#fecaca] bg-[#fff1f2] p-3">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#b42318]">
                                  Student progress
                                </p>
                                {progressArchiveEntries.length ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openProofViewer({
                                        repoName: activeRoadmap.repoName,
                                        stageTitle: stage.title,
                                        selectedEntryId: latestProgressArchiveEntry?.entry_id || null,
                                        progressEntries: progressArchiveEntries,
                                        proofLabel: "Progress proof archive",
                                        fallbackMessage: "The student submitted progress proof for this stage update.",
                                        comment: latestProgressArchiveEntry?.comment,
                                        proofItems: progressProofItems,
                                        updatedAt: latestProgressArchiveEntry?.updated_at,
                                        adminFeedback: savedStageUpdate?.admin_feedback,
                                        adminFeedbackBy: savedStageUpdate?.admin_feedback_by,
                                        adminFeedbackUpdatedAt: savedStageUpdate?.admin_feedback_updated_at,
                                        adminFeedbackThread: (savedStageUpdate?.admin_feedback_thread || []) as Array<{ feedback: string; by?: string; updated_at?: string }>,
                                        adminFeedbackByProof: (savedStageUpdate?.admin_feedback_by_proof || {}) as ProofViewerState["adminFeedbackByProof"],
                                      })
                                    }
                                    className="rounded-full border border-[#fecaca] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#b42318] shadow-sm"
                                  >
                                    <span className="inline-flex items-center gap-2">
                                      <span>View archive</span>
                                      {progressArchiveNotificationCount > 0 ? (
                                        <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#ef4444] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                                          {progressArchiveNotificationCount > 99 ? "99+" : progressArchiveNotificationCount}
                                        </span>
                                      ) : null}
                                    </span>
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          ) : (
                            <div
                              className={`${showOnlyViewProof ? "" : "mt-3"} flex flex-wrap items-center justify-between gap-3 rounded-[10px] ${
                                progressArchiveNotificationCount > 0
                                  ? "border border-[#fecaca] bg-[#fff7f7] px-3 py-2"
                                  : ""
                              }`}
                            >
                              {showOnlyViewProof ? (
                                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#2f3a8c]">
                                  Progress Proof Archive
                                </p>
                              ) : null}
                              {progressArchiveNotificationCount > 0 ? (
                                <p className="text-[11px] font-semibold text-[#b42318]">
                                  New admin comment. Open the archive to review and reply.
                                </p>
                              ) : null}
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    openProofViewer({
                                      repoName: activeRoadmap.repoName,
                                      stageTitle: stage.title,
                                      selectedEntryId: latestProgressArchiveEntry?.entry_id || null,
                                      progressEntries: progressArchiveEntries,
                                      proofLabel: "Progress proof archive",
                                      fallbackMessage: "The student submitted progress proof for this stage update.",
                                      comment: latestProgressArchiveEntry?.comment,
                                      proofItems: progressProofItems,
                                      updatedAt: latestProgressArchiveEntry?.updated_at,
                                      adminFeedback: savedStageUpdate?.admin_feedback,
                                      adminFeedbackBy: savedStageUpdate?.admin_feedback_by,
                                      adminFeedbackUpdatedAt: savedStageUpdate?.admin_feedback_updated_at,
                                      adminFeedbackThread: (savedStageUpdate?.admin_feedback_thread || []) as Array<{ feedback: string; by?: string; updated_at?: string }>,
                                      adminFeedbackByProof: (savedStageUpdate?.admin_feedback_by_proof || {}) as ProofViewerState["adminFeedbackByProof"],
                                    })
                                  }
                                  className="rounded-full border border-[#cfd6ff] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#2f3a8c] shadow-sm"
                                >
                                  <span className="inline-flex items-center gap-2">
                                    <span>View archive</span>
                                    {progressArchiveNotificationCount > 0 ? (
                                      <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#ef4444] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                                        {progressArchiveNotificationCount > 99 ? "99+" : progressArchiveNotificationCount}
                                      </span>
                                    ) : null}
                                  </span>
                                </button>
                              </div>
                            </div>
                          )
                        ) : null}
                      </div>
                    ) : null}

                    {!adminView && !stageLocked && showStageUpdate ? (
                      <div className="mt-3 rounded-[12px] border border-dashed border-[#cfd6e6] bg-white p-3 shadow-sm">
                        <div className="grid gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#667085]">What are you working on now?</p>
                            <textarea
                              value={draftStageComment}
                              onChange={(event) =>
                                setStageUpdateCommentByRepo((prev) => ({
                                  ...prev,
                                  [activeRoadmap.repoName]: {
                                    ...(prev[activeRoadmap.repoName] || {}),
                                    [stage.title]: event.target.value,
                                  },
                                }))
                              }
                              className="mt-2 h-20 w-full rounded-[8px] border border-[#d6dcef] bg-white px-3 py-2 text-[12px] text-[#111827] outline-none"
                              placeholder="Example: I finished the login flow, added screenshots, and I am now testing the validation behavior."
                            />
                          </div>
                          <div className="flex flex-col items-start gap-2">
                            <input
                              value={draftStageLinkName}
                              onChange={(event) =>
                                setStageUpdateLinkNameDraftByRepo((prev) => ({
                                  ...prev,
                                  [activeRoadmap.repoName]: {
                                    ...(prev[activeRoadmap.repoName] || {}),
                                    [stage.title]: event.target.value,
                                  },
                                }))
                              }
                              className="w-full rounded-[10px] border border-[#cfd6ff] bg-white px-3 py-2 text-[11px] text-[#3b3a70] shadow-sm outline-none"
                              placeholder="Proof name (e.g. Login Screenshot)"
                            />
                            <textarea
                              value={draftStageLinks}
                              onChange={(event) =>
                                setStageUpdateLinkDraftByRepo((prev) => ({
                                  ...prev,
                                  [activeRoadmap.repoName]: {
                                    ...(prev[activeRoadmap.repoName] || {}),
                                    [stage.title]: event.target.value,
                                  },
                                }))
                              }
                              rows={3}
                              className="w-full rounded-[10px] border border-[#cfd6ff] bg-white px-3 py-2 text-[11px] text-[#3b3a70] shadow-sm outline-none"
                              placeholder="Paste one shareable proof URL"
                            />
                            <p className="text-[11px] text-[#667085]">
                              Add a shareable proof link here and give it a clear name so the admin knows what the proof is.
                              The text in `What are you working on now?` will be posted together with these links after you click `Post update`.
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                const added = addStageUpdateLink(
                                  activeRoadmap.repoName,
                                  stage.title,
                                  draftStageLinkName,
                                  draftStageLinks
                                )
                                if (!added) {
                                  setProjectPathError("Paste at least one valid proof URL first.")
                                }
                              }}
                              className="rounded-full border border-[#cfd6ff] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#3b3a70] shadow-sm"
                            >
                              Add link to this update
                            </button>
                            {draftStageFiles.length ? (
                              <p className="text-[11px] font-semibold text-[#475467]">
                                {draftStageFiles.length} link{draftStageFiles.length === 1 ? "" : "s"} ready{summarizeEvidenceKinds(draftStageFiles) ? `: ${summarizeEvidenceKinds(draftStageFiles)}` : ""}.
                                {draftStageComment.trim() ? " Your progress note is included in this pending update." : ""}
                              </p>
                            ) : null}
                            <button
                              type="button"
                              disabled={isSavingStageUpdate}
                              onClick={() => void saveStageProgressUpdate(activeRoadmap.repoName, stage.title)}
                              className="rounded-full border border-[#d7dee8] bg-[#eef2ff] px-3 py-1.5 text-[11px] font-semibold text-[#2f3a8c] disabled:opacity-60"
                            >
                              {isSavingStageUpdate ? "Posting..." : "Post update with note and links"}
                            </button>
                          </div>
                        </div>
                        {draftStageFiles.length ? (
                          <div className="mt-3 rounded-[10px] border border-[#e4e7ec] bg-white p-3">
                            <div className="mb-3 flex items-center justify-between gap-2">
                              <p className="text-[11px] font-semibold text-[#344054]">Pending update bundle</p>
                              <span className="rounded-full bg-[#f2f4f7] px-2.5 py-1 text-[10px] font-semibold text-[#475467]">
                                {draftStageFiles.length} attached
                              </span>
                            </div>
                            <div className="mb-3 rounded-[10px] border border-[#e4e7ec] bg-[#fffaf0] px-3 py-3">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#667085]">What will be posted</p>
                              <p className="mt-2 text-[11px] leading-5 text-[#344054]">
                                {draftStageComment.trim()
                                  ? "Your note and the selected links will be saved together when you click `Post update with note and links`."
                                  : "The selected links will be saved when you click `Post update with note and links`."}
                              </p>
                            </div>
                            <p className="mb-2 text-[11px] font-semibold text-[#344054]">Selected links</p>
                            <div className="space-y-2">
                            {draftStageFiles.map((item) => {
                              const itemKey = evidenceItemKey(item)
                              return (
                                <div key={`${stage.title}-draft-${itemKey}`} className="flex items-start justify-between gap-3 rounded-[10px] border border-[#e4e7ec] bg-[#f8fafc] px-3 py-2">
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-[11px] font-semibold text-[#344054]">{item.name}</p>
                                    <p className="break-all text-[10px] leading-5 text-[#667085]">
                                      {item.url} / {evidenceKindLabel(item.kind)}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeStageUpdateFile(activeRoadmap.repoName, stage.title, itemKey)}
                                    className="shrink-0 self-start rounded-full border border-[#d0d5dd] bg-white px-2 py-1 text-[10px] font-semibold text-[#667085] hover:text-[#111827]"
                                  >
                                    Remove
                                  </button>
                                </div>
                              )
                            })}
                            </div>
                            {draftStageComment.trim() ? (
                              <div className="mt-3 rounded-[10px] border border-[#e4e7ec] bg-[#f8fafc] px-3 py-3">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#667085]">Current update note</p>
                                <p className="mt-2 whitespace-pre-wrap text-[11px] leading-5 text-[#344054]">{draftStageComment}</p>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>

          <section className="rounded-[10px] border border-[#d6dce8] bg-white p-5 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#3f4656]">Evidence From This Repo</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-[#f5f3ed] px-2.5 py-1 text-[12px] font-semibold text-[#3f4656]">{activeRoadmap.repoName}</span>
              {activeRoadmap.evidence.map((item) => (
                <span key={`${activeRoadmap.repoName}-${item}`} className="rounded-full bg-[#cfe4ff] px-2.5 py-1 text-[12px] font-semibold text-[#1d5fae]">
                  {item}
                </span>
              ))}
            </div>
          </section>

          <section className="rounded-[10px] border border-[#d6dce8] bg-white p-5 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#3f4656]">Milestone Checklist</p>
            {currentMilestoneStage ? (
              <div className="mt-3">
                <div className="overflow-hidden rounded-[20px] border border-[#dbe4f0] bg-[linear-gradient(180deg,#fbfcff_0%,#f4f7fb_100%)] shadow-[0_16px_32px_rgba(15,23,42,0.07)]">
                  <div className="border-b border-[#e5eaf2] px-5 py-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-[#d7deea] bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#55607a]">
                            {nextMilestoneIndex >= 0 ? `Stage ${nextMilestoneIndex + 1}` : "Latest Stage"}
                          </span>
                          <span className="rounded-full border border-[#d9e7ff] bg-[#eef4ff] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#315ea8]">
                            Current Milestone
                          </span>
                        </div>
                        <h3 className="mt-3 text-[20px] font-semibold leading-tight text-[#171a1f]">{currentMilestoneStage.title}</h3>
                        <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[#4b5563]">{currentMilestoneStage.summary}</p>
                      </div>
                      <div className="flex flex-col items-start gap-2 md:items-end">
                        <span className="w-fit rounded-full border border-[#d7deea] bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#41618f]">
                          {stageLabel(currentMilestoneStage.status)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.75fr)]">
                      <div className="rounded-[16px] border border-[#e3e8f1] bg-white px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">Milestone progress</p>
                            <p className="mt-2 text-[24px] font-semibold text-[#101828]">
                              {currentMilestoneCompletedCount}
                              <span className="ml-1 text-[13px] font-medium text-[#667085]">/ {currentMilestoneStage.items.length} outputs</span>
                            </p>
                          </div>
                          <span className="rounded-full bg-[#eef4ff] px-3 py-1 text-[11px] font-semibold text-[#315ea8]">
                            {currentMilestoneProgressPercent}% done
                          </span>
                        </div>
                        <div className="mt-4 h-2.5 rounded-full bg-[#e8eef7]">
                          <div
                            className="h-2.5 rounded-full bg-[linear-gradient(90deg,#4f46e5_0%,#3b82f6_100%)] transition-[width] duration-300"
                            style={{ width: `${currentMilestoneProgressPercent}%` }}
                          />
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
                          <span className="rounded-full border border-[#e3e8f1] bg-[#f8fafc] px-2.5 py-1 font-semibold text-[#516074]">
                            {currentMilestoneProofCount > 0 ? "Proof submitted" : "Proof needed before release"}
                          </span>
                        </div>
                      </div>
                      <div className="rounded-[16px] border border-[#dbe4f0] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-4 py-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">Current focus</p>
                        <p className="mt-2 text-[15px] font-semibold leading-6 text-[#111827]">
                          {currentMilestoneFocusIndex >= 0
                            ? currentMilestoneStage.items[currentMilestoneFocusIndex]
                            : "All outputs are ready. Submit proof to finish this stage."}
                        </p>
                        <p className="mt-2 text-[12px] leading-5 text-[#667085]">
                          {currentMilestoneFocusIndex >= 0
                            ? "Work through this deliverable next to move the stage forward cleanly."
                            : "This stage is already wrapped up on the checklist side."}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3 px-4 py-4">
                    {currentMilestoneStage.items.map((item, index) => {
                      const checked = currentMilestoneChecks[index] || isStageDoneLike(currentMilestoneStage.status)
                      const locked = Boolean((currentMilestoneStage as StageCard & { locked?: boolean }).locked)
                      const focused = !locked && !checked && index === currentMilestoneFocusIndex
                      return (
                        <div
                          key={`${currentMilestoneStage.title}-${index}-${item}`}
                          className={`grid w-full gap-3 rounded-[16px] border px-4 py-4 text-left transition-colors md:grid-cols-[minmax(0,1fr)_auto] md:items-start ${
                            focused
                              ? "border-[#c7d7ff] bg-[#eef4ff] shadow-[0_8px_24px_rgba(59,130,246,0.08)]"
                              : "border-[#e5e7eb] bg-white"
                          }`}
                        >
                          <div className="flex gap-3">
                            <div
                              className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[11px] font-bold ${
                                locked
                                  ? "border-[#c7ccd6] bg-[#f3f4f6] text-[#73776f]"
                                  : checked
                                    ? "border-[#bbf7d0] bg-[#ecfdf3] text-[#166534]"
                                    : "border-[#fde68a] bg-[#fffbeb] text-[#966006]"
                              }`}
                            >
                              {locked ? (
                                <svg
                                  aria-hidden="true"
                                  viewBox="0 0 24 24"
                                  className="h-3.5 w-3.5"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <rect x="5" y="11" width="14" height="10" rx="2" />
                                  <path d="M8 11V8a4 4 0 1 1 8 0v3" />
                                </svg>
                              ) : checked ? "OK" : index + 1}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className={`text-[13px] font-bold text-[#171a1f] ${checked ? "line-through decoration-[#86efac]" : ""}`}>
                                  {item}
                                </h3>
                                {focused ? (
                                  <span className="rounded-full bg-[#dbeafe] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#1d4ed8]">
                                    Current focus
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[#98a2b3]">
                                Output {index + 1}
                              </p>
                              <p className="mt-1 text-[12px] leading-5 text-[#4b5563]">
                                {locked
                                  ? "Finish the earlier stage first before this output becomes available."
                                  : checked
                                    ? "Output completed for this stage."
                                    : focused
                                      ? "This is the next best deliverable to finish for a clean stage progression."
                                      : "Complete this output to move the current milestone forward."}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-start gap-2 md:items-end">
                            <span className="rounded-full border border-[#e5e7eb] bg-[#f8fafc] px-2.5 py-1 text-[10px] font-semibold text-[#64748b]">
                              {locked ? "Locked" : checked ? "Completed" : focused ? "In focus" : "Pending"}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                    {!adminView ? (
                      <p className="text-[12px] text-[#667085]">
                        Update these outputs from the matching card in <span className="font-semibold text-[#111827]">Skill Stages</span> below.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </section>

        </>
      ) : null}
      {adminFeedbackViewer ? (
        <div className="fixed inset-0 z-[82] flex items-center justify-center bg-[#0f172a]/55 px-4 py-6">
          <div className="max-h-[88vh] w-full max-w-[760px] overflow-y-auto rounded-[18px] border border-[#d7dee8] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
            <div className="sticky top-0 z-10 border-b border-[#e5e7eb] bg-[#f8fafc] px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#475467]">Admin feedback thread</p>
                  <h3 className="mt-1 truncate text-[18px] font-semibold text-[#111827]">{adminFeedbackViewer.stageTitle}</h3>
                  <p className="mt-1 text-[12px] text-[#667085]">{adminFeedbackViewer.repoName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAdminFeedbackViewer(null)}
                  className="rounded-full border border-[#d7dee8] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#344054]"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="space-y-4 px-5 py-5">
              <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                {adminView && targetUsername && (adminFeedbackViewer.thread || []).some((entry) => String(entry.by || "").trim() === adminAuth.username) ? (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={deletingAdminCommentKey === `${adminFeedbackViewer.repoName}::${adminFeedbackViewer.stageTitle}::all`}
                      onClick={async () => {
                        setDeletingAdminCommentKey(`${adminFeedbackViewer.repoName}::${adminFeedbackViewer.stageTitle}::all`)
                        try {
                          await deleteAdminStageFeedback(adminAuth.token, targetUsername, {
                            repo_name: adminFeedbackViewer.repoName,
                            stage_title: adminFeedbackViewer.stageTitle,
                            delete_all: true,
                          })
                          const refreshed = await fetchProjectLearningPaths(targetUsername)
                          setProjectPaths(refreshed)
                          const refreshedProject = (refreshed.projects || []).find((project: { repo_name: string }) =>
                            normalizeStorageKey(project.repo_name) === normalizeStorageKey(adminFeedbackViewer.repoName)
                          )
                          const refreshedUpdate = getRecordValue<Record<string, unknown>>(
                            refreshedProject?.stage_progress_updates as Record<string, Record<string, unknown>> | undefined,
                            adminFeedbackViewer.stageTitle
                          )
                          const refreshedThread = Array.isArray(refreshedUpdate?.admin_feedback_thread)
                            ? (refreshedUpdate?.admin_feedback_thread as Array<{ feedback: string; by?: string; updated_at?: string }>)
                            : []
                          setAdminFeedbackViewer((prev) => (prev ? { ...prev, thread: refreshedThread } : prev))
                        } finally {
                          setDeletingAdminCommentKey("")
                        }
                      }}
                      className="rounded-full border border-[#d7dee8] bg-white px-3 py-1 text-[10px] font-semibold text-[#344054] disabled:opacity-60"
                    >
                      {deletingAdminCommentKey === `${adminFeedbackViewer.repoName}::${adminFeedbackViewer.stageTitle}::all` ? "Deleting..." : "Delete all"}
                    </button>
                  </div>
                ) : null}
                {(adminFeedbackViewer.thread || []).length ? (
                  adminFeedbackViewer.thread.map((entry, index) => (
                    <article key={`${adminFeedbackViewer.stageTitle}-feedback-${index}`} className="rounded-[12px] border border-[#e5e7eb] bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] leading-6 text-[#334155]">{entry.feedback}</p>
                        {adminView && entry.updated_at && targetUsername ? (
                          <button
                            type="button"
                            disabled={deletingAdminCommentKey === `${adminFeedbackViewer.repoName}::${adminFeedbackViewer.stageTitle}::${entry.updated_at || ""}`}
                            onClick={async () => {
                              setDeletingAdminCommentKey(`${adminFeedbackViewer.repoName}::${adminFeedbackViewer.stageTitle}::${entry.updated_at || ""}`)
                              try {
                                await deleteAdminStageFeedback(adminAuth.token, targetUsername, {
                                  repo_name: adminFeedbackViewer.repoName,
                                  stage_title: adminFeedbackViewer.stageTitle,
                                  updated_at: entry.updated_at || "",
                                })
                                const refreshed = await fetchProjectLearningPaths(targetUsername)
                                setProjectPaths(refreshed)
                                const refreshedProject = (refreshed.projects || []).find((project: { repo_name: string }) =>
                                  normalizeStorageKey(project.repo_name) === normalizeStorageKey(adminFeedbackViewer.repoName)
                                )
                                const refreshedUpdate = getRecordValue<Record<string, unknown>>(
                                  refreshedProject?.stage_progress_updates as Record<string, Record<string, unknown>> | undefined,
                                  adminFeedbackViewer.stageTitle
                                )
                                const refreshedThread = Array.isArray(refreshedUpdate?.admin_feedback_thread)
                                  ? (refreshedUpdate?.admin_feedback_thread as Array<{ feedback: string; by?: string; updated_at?: string }>)
                                  : []
                                setAdminFeedbackViewer((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        thread: refreshedThread,
                                      }
                                    : prev
                                )
                              } finally {
                                setDeletingAdminCommentKey("")
                              }
                            }}
                            className="shrink-0 rounded-full border border-[#d7dee8] bg-white px-2 py-1 text-[10px] font-semibold text-[#344054]"
                          >
                            {deletingAdminCommentKey === `${adminFeedbackViewer.repoName}::${adminFeedbackViewer.stageTitle}::${entry.updated_at || ""}` ? "Deleting..." : "Delete"}
                          </button>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[11px] text-[#667085]">
                        {entry.by ? `By ${entry.by}` : "By admin"}
                        {entry.updated_at ? ` - ${formatRealtimeStamp(entry.updated_at)}` : ""}
                      </p>
                    </article>
                  ))
                ) : (
                  <div className="rounded-[12px] border border-dashed border-[#cfd6e6] bg-[#fcfdff] px-3 py-4 text-[12px] text-[#667085]">
                    No feedback comments yet.
                  </div>
                )}
              </div>
              {adminView ? (
                <div className="rounded-[12px] border border-dashed border-[#cfd6e6] bg-[#fcfdff] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#667085]">Write feedback</p>
                  <textarea
                    value={adminFeedbackDraftByRepo[adminFeedbackViewer.repoName]?.[adminFeedbackViewer.stageTitle] || ""}
                    onChange={(event) =>
                      setAdminFeedbackDraftByRepo((prev) => ({
                        ...prev,
                        [adminFeedbackViewer.repoName]: {
                          ...(prev[adminFeedbackViewer.repoName] || {}),
                          [adminFeedbackViewer.stageTitle]: event.target.value,
                        },
                      }))
                    }
                    className="mt-2 h-24 w-full rounded-[8px] border border-[#d6dcef] bg-white px-3 py-2 text-[12px] text-[#111827] outline-none"
                    placeholder="Type your feedback for this stage."
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={async () => {
                        await saveAdminStageFeedback(adminFeedbackViewer.repoName, adminFeedbackViewer.stageTitle)
                        const refreshed = await fetchProjectLearningPaths(targetUsername)
                        setProjectPaths(refreshed)
                        const refreshedProject = (refreshed.projects || []).find((project: { repo_name: string }) =>
                          normalizeStorageKey(project.repo_name) === normalizeStorageKey(adminFeedbackViewer.repoName)
                        )
                        const refreshedUpdate = getRecordValue<Record<string, unknown>>(
                          refreshedProject?.stage_progress_updates as Record<string, Record<string, unknown>> | undefined,
                          adminFeedbackViewer.stageTitle
                        )
                        const refreshedThread = Array.isArray(refreshedUpdate?.admin_feedback_thread)
                          ? (refreshedUpdate?.admin_feedback_thread as Array<{ feedback: string; by?: string; updated_at?: string }>)
                          : []
                        setAdminFeedbackViewer((prev) =>
                          prev
                            ? {
                                ...prev,
                                thread: refreshedThread,
                              }
                            : prev
                        )
                      }}
                      disabled={savingAdminFeedbackKey === `${adminFeedbackViewer.repoName}::${adminFeedbackViewer.stageTitle}`}
                      className="rounded-full border border-[#d7dee8] bg-[#eef2ff] px-3 py-1.5 text-[11px] font-semibold text-[#2f3a8c] disabled:opacity-60"
                    >
                      {savingAdminFeedbackKey === `${adminFeedbackViewer.repoName}::${adminFeedbackViewer.stageTitle}` ? "Saving..." : "Post feedback"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {proofViewer ? (() => {
        const progressEntries = proofViewer.progressEntries || []
        const selectedEntry =
          progressEntries.find((entry) => entry.entry_id === proofViewer.selectedEntryId) || progressEntries[0] || null
        const activeProofItems = selectedEntry?.proof_items?.length ? selectedEntry.proof_items : proofViewer.proofItems
        const activeTimestamp = selectedEntry?.updated_at || proofViewer.updatedAt || null
        const activeTitle = progressProofLabel(activeProofItems, selectedEntry ? "Update" : proofViewer.fallbackMessage || "Proof")
        const activeProofItem = activeProofItems[0] || null
        const activeDraftKey = selectedEntry?.entry_id || activeProofItem?.url || proofViewer.stageTitle
        const currentUpdate = getCurrentStageUpdate(proofViewer.repoName, proofViewer.stageTitle)
        const selectedEntryProofUrls = Array.from(
          new Set((selectedEntry?.proof_items || []).map((item) => String(item.url || "").trim()).filter(Boolean))
        )
        const activeProofUrl = activeProofItem?.url || selectedEntryProofUrls[0] || ""
        const seedCommentEntry = proofViewer.comment
          ? {
              feedback: proofViewer.comment,
              by: targetUsername || "Student",
              role: "student",
              updated_at: activeTimestamp,
            }
          : null
        const commentThreadEntries = proofViewer.adminFeedbackThread || []
        const displayCommentThread = seedCommentEntry
          ? [seedCommentEntry, ...commentThreadEntries]
          : commentThreadEntries
        const currentCommentRole = adminView ? "admin" : "student"
        const currentCommentAuthor = adminView ? adminAuth.username : auth.username
        const deletableThreadEntries = displayCommentThread.filter(
          (entry, index) =>
            index >= (seedCommentEntry ? 1 : 0) &&
            String(entry.role || "").trim().toLowerCase() === currentCommentRole &&
            String(entry.by || "").trim() === currentCommentAuthor
        )
        const entryNotificationCount = selectedEntryProofUrls.reduce(
          (total, proofUrl) =>
            total +
            (adminView
              ? getAdminProofNotificationCount(targetUsername, proofViewer.repoName, proofViewer.stageTitle, proofUrl, currentUpdate)
              : getStudentProofNotificationCount(targetUsername, proofViewer.repoName, proofViewer.stageTitle, proofUrl, currentUpdate)),
          0
        )
        return (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0f172a]/55 px-4 py-6">
            <div className="max-h-[90vh] w-full max-w-[1200px] overflow-hidden rounded-[22px] border border-[#e5e7eb] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
              <div className="sticky top-0 z-10 border-b border-[#fee2e2] bg-[#fff1f2] px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b42318]">
                      {proofViewer.proofLabel || "Proof message"}
                    </p>
                    <h3 className="mt-1 truncate text-[18px] font-semibold text-[#7f1d1d]">{proofViewer.stageTitle}</h3>
                    <p className="mt-1 text-[12px] text-[#9f1239]">
                      {proofViewer.repoName}
                      {activeTimestamp ? ` - ${formatRealtimeStamp(activeTimestamp)}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProofViewer(null)}
                    className="rounded-full border border-[#fecaca] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#b42318]"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="grid gap-0 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                <section className="border-b border-[#eef2f7] bg-[#fffdfd] px-5 py-4 md:max-h-[calc(90vh-74px)] md:border-b-0 md:border-r md:overflow-y-auto">
                  {progressEntries.length > 1 ? (
                    <div className="rounded-[16px] border border-[#e5e7eb] bg-white p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#667085]">Posted updates</p>
                        {!adminView && selectedEntry ? (
                          <button
                            type="button"
                            disabled={deletingProgressUpdateKey === `${proofViewer.repoName}::${proofViewer.stageTitle}::entry::${selectedEntry.entry_id}`}
                            onClick={() => void removeSavedStageProgressEntry(proofViewer.repoName, proofViewer.stageTitle, selectedEntry.entry_id)}
                            className="rounded-full border border-[#fecaca] bg-white px-3 py-1 text-[10px] font-semibold text-[#b42318] disabled:opacity-60"
                          >
                            {deletingProgressUpdateKey === `${proofViewer.repoName}::${proofViewer.stageTitle}::entry::${selectedEntry.entry_id}` ? "Deleting..." : "Delete update"}
                          </button>
                        ) : null}
                      </div>
                      <div className="mt-3 max-h-[180px] space-y-2 overflow-y-auto pr-1">
                        {progressEntries.map((entry, entryIndex) => {
                          const active = entry.entry_id === selectedEntry?.entry_id
                          const entryProofUrls = Array.from(
                            new Set((entry.proof_items || []).map((item) => String(item.url || "").trim()).filter(Boolean))
                          )
                          const notificationCount = entryProofUrls.reduce(
                            (total, proofUrl) =>
                              total +
                              (adminView
                                ? getAdminProofNotificationCount(targetUsername, proofViewer.repoName, proofViewer.stageTitle, proofUrl, currentUpdate)
                                : getStudentProofNotificationCount(targetUsername, proofViewer.repoName, proofViewer.stageTitle, proofUrl, currentUpdate)),
                            0
                          )
                          return (
                            <button
                              key={`${entry.entry_id}-${entryIndex}`}
                              type="button"
                              onClick={() => {
                                entryProofUrls.forEach((proofUrl) => {
                                  markCurrentProofNotificationsSeen(proofViewer.repoName, proofViewer.stageTitle, proofUrl)
                                })
                                setProofViewer((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        selectedEntryId: entry.entry_id,
                                        comment: entry.comment || null,
                                        proofItems: entry.proof_items || [],
                                        updatedAt: entry.updated_at || null,
                                      }
                                    : prev
                                )
                              }}
                              className={`w-full rounded-[12px] border px-3 py-2 text-left ${
                                active ? "border-[#1f1f1f] bg-[#fff5f5]" : "border-[#e5e7eb] bg-white"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="min-w-0 truncate text-[12px] font-semibold text-[#111827]">
                                  {progressProofLabel(entry.proof_items, `Update ${entryIndex + 1}`)}
                                </p>
                                {notificationCount > 0 ? (
                                  <span className="inline-flex min-w-[18px] shrink-0 items-center justify-center rounded-full bg-[#ef4444] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                                    {notificationCount > 99 ? "99+" : notificationCount}
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 text-[11px] text-[#667085]">
                                {entry.updated_at ? formatRealtimeStamp(entry.updated_at) : "No timestamp"}
                              </p>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#667085]">Proof list</p>
                          {entryNotificationCount > 0 ? (
                            <span className="inline-flex min-w-[18px] shrink-0 items-center justify-center rounded-full bg-[#ef4444] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                              {entryNotificationCount > 99 ? "99+" : entryNotificationCount}
                            </span>
                          ) : null}
                        </div>
                        <h4 className="mt-1 text-[16px] font-semibold text-[#111827]">{activeTitle}</h4>
                        <p className="mt-1 text-[11px] text-[#667085]">
                          {activeTimestamp ? formatRealtimeStamp(activeTimestamp) : "No timestamp"} {activeProofItems.length ? `- ${activeProofItems.length} attached` : ""}
                        </p>
                      </div>
                      {!adminView && selectedEntry ? (
                        <button
                          type="button"
                          disabled={deletingProgressUpdateKey === `${proofViewer.repoName}::${proofViewer.stageTitle}::entry::${selectedEntry.entry_id}`}
                          onClick={() => void removeSavedStageProgressEntry(proofViewer.repoName, proofViewer.stageTitle, selectedEntry.entry_id)}
                          className="rounded-full border border-[#fecaca] bg-white px-3 py-1 text-[10px] font-semibold text-[#b42318] disabled:opacity-60"
                        >
                          Delete update
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-3 space-y-3">
                      {!activeProofItems.length ? (
                        <div className="rounded-[14px] border border-dashed border-[#d7dee8] bg-[#fcfdff] px-4 py-5 text-[12px] text-[#667085]">
                          No proof links were attached to this update. Check the comment thread for the student note and admin replies.
                        </div>
                      ) : null}
                      {activeProofItems.map((item, index) => {
                        const itemName = item.name || `Proof ${index + 1}`
                        return (
                          <article key={`${item.url}-${index}`} className="rounded-[14px] border border-[#e5e7eb] bg-white px-4 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-[13px] font-semibold text-[#111827]">{itemName}</p>
                                <p className="mt-1 text-[11px] text-[#667085]">
                                  {activeTimestamp ? formatRealtimeStamp(activeTimestamp) : "No timestamp"}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => window.open(item.url, "_blank", "noopener,noreferrer")}
                                className="shrink-0 rounded-full border border-[#d7dee8] bg-[#f8fafc] px-3 py-1.5 text-[11px] font-semibold text-[#344054]"
                              >
                                Open link
                              </button>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  </div>
                </section>

                <aside className="bg-[#fcfdff] px-5 py-4 md:max-h-[calc(90vh-74px)] md:overflow-y-auto">
                  <div className="rounded-[18px] border border-[#e5e7eb] bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#667085]">Comment Threads</p>
                      {deletableThreadEntries.length ? (
                        <button
                          type="button"
                          disabled={
                            (adminView
                              ? deletingAdminCommentKey
                              : deletingStudentReplyKey) === `${proofViewer.repoName}::${proofViewer.stageTitle}::all`
                          }
                          onClick={() =>
                            void (adminView
                              ? deleteAdminProofComment(proofViewer.repoName, proofViewer.stageTitle, undefined, activeProofUrl || undefined, true)
                              : deleteProofThreadReply(proofViewer.repoName, proofViewer.stageTitle, undefined, activeProofUrl || undefined, true))
                          }
                          className="rounded-full border border-[#dbeafe] bg-white px-3 py-1 text-[10px] font-semibold text-[#1d4ed8] disabled:opacity-60"
                        >
                          {(adminView ? deletingAdminCommentKey : deletingStudentReplyKey) === `${proofViewer.repoName}::${proofViewer.stageTitle}::all`
                            ? "Deleting..."
                            : "Delete all"}
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-3 max-h-[320px] space-y-2 overflow-y-auto pr-1">
                      {displayCommentThread.length ? (
                        displayCommentThread.map((entry, entryIndex) => {
                          const entryRole = String(entry.role || "admin").trim().toLowerCase() === "student" ? "student" : "admin"
                          const canDeleteEntry =
                            entryIndex >= (seedCommentEntry ? 1 : 0) &&
                            entryRole === currentCommentRole &&
                            String(entry.by || "").trim() === currentCommentAuthor &&
                            Boolean(entry.updated_at)
                          const deleteKey = `${proofViewer.repoName}::${proofViewer.stageTitle}::${entry.updated_at || ""}`
                          return (
                            <div
                              key={`${proofViewer.repoName}-thread-${entryIndex}`}
                              className={`rounded-[12px] border px-3 py-2 ${
                                entryRole === "student" ? "border-[#dbeafe] bg-[#f8fbff]" : "border-[#fee2e2] bg-[#fff7f7]"
                              }`}
                            >
                              <p className={`text-[12px] leading-5 ${entryRole === "student" ? "text-[#1e3a8a]" : "text-[#3f1d1d]"}`}>{entry.feedback}</p>
                              <div className="mt-1 flex items-center justify-between gap-2">
                                <p className={`text-[10px] font-semibold ${entryRole === "student" ? "text-[#1d4ed8]" : "text-[#9f1239]"}`}>
                                  {entry.by ? `By ${entry.by}` : entryRole === "student" ? "By student" : "By admin"}
                                  {entry.updated_at ? ` - ${formatRealtimeStamp(entry.updated_at)}` : ""}
                                </p>
                                {canDeleteEntry ? (
                                  <button
                                    type="button"
                                    disabled={(adminView ? deletingAdminCommentKey : deletingStudentReplyKey) === deleteKey}
                                    onClick={() =>
                                      void (adminView
                                        ? deleteAdminProofComment(
                                            proofViewer.repoName,
                                            proofViewer.stageTitle,
                                            entry.updated_at || undefined,
                                            activeProofUrl || undefined,
                                            false
                                          )
                                        : deleteProofThreadReply(
                                            proofViewer.repoName,
                                            proofViewer.stageTitle,
                                            entry.updated_at || undefined,
                                            activeProofUrl || undefined,
                                            false
                                          ))
                                    }
                                    className={`rounded-full border bg-white px-2 py-1 text-[10px] font-semibold disabled:opacity-60 ${
                                      entryRole === "student"
                                        ? "border-[#bfdbfe] text-[#1d4ed8]"
                                        : "border-[#fecaca] text-[#b42318]"
                                    }`}
                                  >
                                    {(adminView ? deletingAdminCommentKey : deletingStudentReplyKey) === deleteKey ? "Deleting..." : "Delete"}
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <p className="rounded-[12px] border border-dashed border-[#d7dee8] bg-[#fcfdff] px-3 py-3 text-[12px] leading-5 text-[#667085]">
                          No comments yet for this proof.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 rounded-[18px] border border-[#f2caca] bg-white p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b45454]">Write Comment</p>
                    {adminView ? (
                      <>
                        <textarea
                          value={adminFeedbackDraftByRepo[proofViewer.repoName]?.[activeDraftKey] || ""}
                          onChange={(event) =>
                            setAdminFeedbackDraftByRepo((prev) => ({
                              ...prev,
                              [proofViewer.repoName]: {
                                ...(prev[proofViewer.repoName] || {}),
                                [activeDraftKey]: event.target.value,
                              },
                            }))
                          }
                          rows={4}
                          className="mt-3 w-full rounded-[14px] border border-[#d6dcf2] px-3 py-2 text-[12px] outline-none"
                          placeholder="Type admin comment for this post."
                        />
                        <div className="mt-3 flex justify-end">
                          <button
                            type="button"
                            disabled={savingAdminFeedbackKey === `${proofViewer.repoName}::${proofViewer.stageTitle}` || !String(adminFeedbackDraftByRepo[proofViewer.repoName]?.[activeDraftKey] || "").trim()}
                            onClick={() => void saveAdminStageFeedback(proofViewer.repoName, proofViewer.stageTitle, activeProofItem || undefined)}
                            className="rounded-full bg-[#b45454] px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60"
                          >
                            {savingAdminFeedbackKey === `${proofViewer.repoName}::${proofViewer.stageTitle}` ? "Saving..." : "Save comment"}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <textarea
                          value={studentReplyDraftByRepo[proofViewer.repoName]?.[activeDraftKey] || ""}
                          onChange={(event) =>
                            setStudentReplyDraftByRepo((prev) => ({
                              ...prev,
                              [proofViewer.repoName]: {
                                ...(prev[proofViewer.repoName] || {}),
                                [activeDraftKey]: event.target.value,
                              },
                            }))
                          }
                          rows={4}
                          className="mt-3 w-full rounded-[14px] border border-[#d6dcf2] px-3 py-2 text-[12px] outline-none"
                          placeholder="Type your reply for this post."
                        />
                        <div className="mt-3 flex justify-end">
                          <button
                            type="button"
                            disabled={savingStudentReplyKey === `${proofViewer.repoName}::${proofViewer.stageTitle}::${activeDraftKey}` || !String(studentReplyDraftByRepo[proofViewer.repoName]?.[activeDraftKey] || "").trim()}
                            onClick={() => void saveStudentStageFeedbackReply(proofViewer.repoName, proofViewer.stageTitle, activeDraftKey, activeProofItem || undefined)}
                            className="rounded-full bg-[#3b82f6] px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60"
                          >
                            {savingStudentReplyKey === `${proofViewer.repoName}::${proofViewer.stageTitle}::${activeDraftKey}` ? "Saving..." : "Save comment"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </aside>
              </div>
            </div>
          </div>
        )
      })() : null}
      {expandedProofItem ? (() => {
        const kind = String(expandedProofItem.kind || "").toLowerCase()
        const isImage = kind === "image" || /\.(png|jpe?g|gif|webp)$/i.test(expandedProofItem.url)
        const isVideo = kind === "video" || /\.(mp4|webm|mov)$/i.test(expandedProofItem.url)
        const isPdf = kind === "pdf" || /\.pdf$/i.test(expandedProofItem.url)
        return (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#020617]/75 px-4 py-6">
            <div className="max-h-[92vh] w-full max-w-[980px] overflow-hidden rounded-[18px] border border-white/15 bg-white shadow-[0_24px_80px_rgba(2,6,23,0.45)]">
              <div className="flex items-center justify-between gap-3 border-b border-[#e5e7eb] bg-[#f8fafc] px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-[#111827]">{expandedProofItem.name || "Proof file"}</p>
                  <p className="text-[11px] uppercase tracking-[0.08em] text-[#667085]">{kind || "file"} proof</p>
                </div>
                <button
                  type="button"
                  onClick={() => setExpandedProofItem(null)}
                  className="rounded-full border border-[#d7dee8] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#344054]"
                >
                  Close
                </button>
              </div>
              <div className="max-h-[calc(92vh-58px)] overflow-auto bg-[#0f172a]">
                {isImage ? (
                  <img src={expandedProofItem.url} alt={expandedProofItem.name || "Proof image"} className="mx-auto max-h-[calc(92vh-58px)] w-full object-contain" />
                ) : isVideo ? (
                  <video src={expandedProofItem.url} controls autoPlay className="mx-auto max-h-[calc(92vh-58px)] w-full bg-black" />
                ) : isPdf ? (
                  <iframe title={expandedProofItem.name || "Proof PDF"} src={expandedProofItem.url} className="h-[calc(92vh-58px)] w-full bg-white" />
                ) : (
                  <div className="flex min-h-[320px] items-center justify-center bg-white px-6 text-center text-[13px] text-[#667085]">
                    This proof type cannot be previewed inside the app.
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })() : null}
      {showStudentGuide && !adminView ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-[#0f172a]/60 px-4 py-6">
          <div className="w-full max-w-3xl overflow-hidden rounded-[24px] border border-[#dbeafe] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
            <div className="flex items-start justify-between gap-3 border-b border-[#e5e7eb] bg-[#f8fbff] px-5 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#3b82f6]">Learning Path Instructions</p>
                <h3 className="mt-1 text-[22px] font-semibold text-[#111827]">How to use this learning path page</h3>
                <p className="mt-1 text-[12px] text-[#52667a]">Follow these steps while finishing your repo stages and submitting proof.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowStudentGuide(false)}
                className="rounded-full border border-[#d7dee8] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#344054]"
              >
                Close
              </button>
            </div>
            <div className="space-y-4 px-5 py-5">
              <div className="rounded-[16px] border border-[#dbeafe] bg-[#f8fbff] p-4">
                <p className="text-[13px] font-semibold text-[#0f172a]">Step 1. Choose your repo and check the stage tasks</p>
                <p className="mt-2 text-[13px] leading-6 text-[#52667a]">
                  Pick your repository first. Then open the stage cards and read the checklist so you know what outputs or tasks you need to finish.
                </p>
                <p className="mt-2 text-[13px] leading-6 text-[#52667a]">
                  This part is manual. You need to click the outputs one by one as you finish them. The system does not auto-check them for you, so make sure you only mark an output when it is really done.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowStudentGuide(false)
                    scrollToSection("learning-path-stages")
                  }}
                  className="mt-3 rounded-full border border-[#bfdbfe] bg-white px-4 py-2 text-[11px] font-semibold text-[#1d4ed8]"
                >
                  Go to stages
                </button>
              </div>
              <div className="rounded-[16px] border border-[#dbeafe] bg-[#f8fbff] p-4">
                <p className="text-[13px] font-semibold text-[#0f172a]">Step 2. Post stage proof updates</p>
                <p className="mt-2 text-[13px] leading-6 text-[#52667a]">
                  While you are still working, you can post progress notes and proof links here. Use the same stage archive for Google Drive, YouTube, PDF, image, or other supporting links so the admin can review everything in one place.
                </p>
                <p className="mt-2 text-[13px] leading-6 text-[#52667a]">
                  Use this archive both for partial progress and for the proof that completes the stage. Once all outputs in that stage are checked and there is saved proof in the archive, the next stage can open.
                </p>
                <p className="mt-2 text-[13px] leading-6 text-[#52667a]">
                  After you save proof in the archive, the system keeps it for review. You do not need to submit a separate final-proof section anymore.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowStudentGuide(false)
                    scrollToSection("learning-path-evidence")
                  }}
                  className="mt-3 rounded-full border border-[#bfdbfe] bg-white px-4 py-2 text-[11px] font-semibold text-[#1d4ed8]"
                >
                  Go to proof area
                </button>
              </div>
              <div className="rounded-[16px] border border-[#dbeafe] bg-[#f8fbff] p-4">
                <p className="text-[13px] font-semibold text-[#0f172a]">Step 3. Read feedback and continue to the next stage</p>
                <p className="mt-2 text-[13px] leading-6 text-[#52667a]">
                  If the admin comments on your proof, open it and read the feedback. Reply or update your proof if needed, then continue once the stage is accepted.
                </p>
                <p className="mt-2 text-[13px] leading-6 text-[#52667a]">
                  If you see a notification badge, that usually means the admin replied to one of your saved stage proof links or comments. Open the proof viewer, read the message, then reply there if you need to explain changes.
                </p>
                <p className="mt-2 text-[13px] leading-6 text-[#52667a]">
                  In short: check outputs manually, save proof in the stage archive, read comments, then continue stage by stage until the repo reward becomes claimable.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowStudentGuide(false)
                    scrollToSection("learning-path-stages")
                  }}
                  className="mt-3 rounded-full border border-[#bfdbfe] bg-white px-4 py-2 text-[11px] font-semibold text-[#1d4ed8]"
                >
                  Review my current stage
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )

  if (adminView && !embedded) {
    return <AdminFrame showBuiltInToolbar={false}>{content}</AdminFrame>
  }

  return content
}
