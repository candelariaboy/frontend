import { useEffect, useMemo, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Link, useSearchParams } from "react-router-dom"
import {
  claimBadges,
  fetchOwnerPortfolio,
  getStoredAuth,
} from "../lib/api"
import { cinematicStagger, softFloat } from "../lib/motion"
import type {
  PortfolioResponse,
} from "../types"

function formatRepoUpdated(value?: string | null) {
  if (!value) return "recently"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(parsed)
}

function formatRelativeRepoUpdate(value?: string | null) {
  if (!value) return "No repo activity yet"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return `Latest repo update ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(parsed)}`
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}


export default function DashboardPage() {
  const reduceMotion = useReducedMotion()
  const containerMotion = reduceMotion ? {} : { variants: cinematicStagger, initial: "hidden", animate: "visible" }
  const sectionMotion = reduceMotion ? {} : { variants: softFloat }
  const [params] = useSearchParams()
  const usernameParam = (params.get("username") || "").trim()
  const auth = getStoredAuth()
  const isAuthenticated = Boolean(auth.token && auth.username)

  const [data, setData] = useState<PortfolioResponse | null>(null)
  const [claimLoading, setClaimLoading] = useState(false)
  const [toast, setToast] = useState("")
  const [levelUp, setLevelUp] = useState<{ level: number; xp: number } | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      setData(null)
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        const portfolio = await fetchOwnerPortfolio(auth.token)
        if (cancelled) return
        setData(portfolio)
      } catch {
        if (cancelled) return
        setData(null)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, auth.token, auth.username])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(""), 3000)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!data?.profile || !auth.username) return
    const currentLevel = Number(data.profile.level || 1)
    const key = `devpath_level:${auth.username.toLowerCase()}`
    const previousLevel = Number(localStorage.getItem(key) || 0)
    if (previousLevel && currentLevel > previousLevel) {
      setLevelUp({ level: currentLevel, xp: Number(data.profile.xp || 0) })
    }
    if (currentLevel > 0) {
      localStorage.setItem(key, String(currentLevel))
    }
  }, [data?.profile, auth.username])

  const privateAccessMismatch =
    Boolean(usernameParam) &&
    Boolean(auth.username) &&
    usernameParam.toLowerCase() !== auth.username.toLowerCase()

  const xpRequiredForLevel = (level: number) => {
    const targetLevel = Math.max(1, Math.trunc(level || 1))
    if (targetLevel <= 1) return 0
    const steps = targetLevel - 1
    return Math.round((steps * (2 * 500 + (steps - 1) * 250)) / 2)
  }

  const levelProgress = useMemo(() => {
    if (!data) return 0
    const xp = Number(data.profile.xp || 0)
    const level = Math.max(1, Number(data.profile.level || 1))
    const nextLevelXp = Math.max(1, Number(data.profile.nextLevelXp || xpRequiredForLevel(level + 1)))
    const prevLevelXp = Math.max(0, xpRequiredForLevel(level))
    const range = Math.max(1, nextLevelXp - prevLevelXp)
    const progress = ((xp - prevLevelXp) / range) * 100
    return Math.max(0, Math.min(100, Math.round(progress)))
  }, [data])

  const totalXp = Number(data?.profile.xp || 0)

  const remainingXp = Math.max(0, Math.max(0, Number(data?.profile.nextLevelXp || 0)) - totalXp)
  const achievedBadges = (data?.badges || []).filter((badge) => badge.achieved)
  const claimableBadges = achievedBadges.filter((badge) => !badge.claimed)
  const shownBadges = achievedBadges
  const featuredRepos = (data?.repos || []).slice(0, 6)
  const totalRepos = data?.repos?.length || 0
  const streakDays = Number(data?.profile.streakDays || 0)
  const activeRepos30d = Number(data?.frequency?.active_repos_30d || 0)
  const portfolioCompleteness = Number(data?.profile.portfolioCompleteness || 0)
  const targetCertifications = data?.profile.targetCertifications || []
  const lastSync = useMemo(() => {
    const dates = (data?.repos || [])
      .map((repo) => repo.last_push)
      .filter(Boolean)
      .map((value) => new Date(String(value)).getTime())
      .filter((value) => !Number.isNaN(value))
    if (!dates.length) return null
    return new Date(Math.max(...dates)).toISOString()
  }, [data?.repos])
  const topCareerTrack = (data?.career_suggestions || [])[0] || null
  const focusDimension = data?.focus_domain || null
  const primaryLanguages = uniqueValues(
    (data?.repos || [])
      .flatMap((repo) => [repo.language, ...(repo.languages || [])])
      .map((value) => String(value || "").trim())
  ).slice(0, 5)
  const nextStepHint = useMemo(() => {
    if (focusDimension?.domain) {
      return `Continue building depth in ${focusDimension.domain}.`
    }
    if (topCareerTrack?.title) {
      return `Strengthen repos aligned with ${topCareerTrack.title}.`
    }
    return "Sync GitHub and add stronger project evidence to unlock guided next steps."
  }, [focusDimension, topCareerTrack])
  const recentSignals = useMemo(
    () =>
      [
        lastSync ? formatRelativeRepoUpdate(lastSync) : null,
        activeRepos30d > 0 ? `${activeRepos30d} repositories active in the last 30 days` : null,
        primaryLanguages.length ? `Primary stack: ${primaryLanguages.join(", ")}` : null,
        topCareerTrack?.title ? `Top career fit: ${topCareerTrack.title}` : null,
      ].filter(Boolean) as string[],
    [activeRepos30d, lastSync, primaryLanguages, topCareerTrack]
  )

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="dp-card p-4 text-[13px] text-[#4B5368]">
          Sign in with GitHub first to open your dashboard.
        </div>
      </div>
    )
  }

  if (privateAccessMismatch) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="dp-card p-4 text-[13px] text-[#4B5368]">
          This dashboard is private to the signed-in account.
        </div>
      </div>
    )
  }

  return (
    <motion.div {...containerMotion} className="mx-auto max-w-[1240px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      {toast ? (
        <div className="fixed right-5 top-5 z-50 rounded-[12px] border border-[#cad5f3] bg-white/95 px-4 py-2 text-[12px] text-[#2A3145] shadow-[0_12px_28px_rgba(23,37,84,0.15)] backdrop-blur">
          {toast}
        </div>
      ) : null}
      {levelUp ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-[420px] rounded-[24px] border border-[#dfe6fb] bg-white/95 p-6 text-center shadow-[0_24px_60px_rgba(30,41,84,0.2)] backdrop-blur">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[linear-gradient(135deg,#4f46e5,#22d3ee)] text-xl font-semibold text-white">
              {levelUp.level}
            </div>
            <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-[#6D6AA6]">Level Up</p>
            <h2 className="mt-1 text-[22px] font-semibold text-[#1E1A3C]">You leveled up!</h2>
            <p className="mt-2 text-[13px] text-[#5B5F7A]">
              Congrats! You reached level {levelUp.level} with {levelUp.xp} XP.
            </p>
            <button
              type="button"
              className="mt-4 rounded-full bg-[#4f46e5] px-5 py-2 text-[12px] font-semibold text-white shadow-[0_12px_24px_rgba(79,70,229,0.28)]"
              onClick={() => setLevelUp(null)}
            >
              Awesome
            </button>
          </div>
        </div>
      ) : null}

      <motion.section {...sectionMotion} className="relative overflow-hidden rounded-[28px] border border-[#dfe6fb] bg-[linear-gradient(135deg,#f3f0ff,#eef6ff_55%,#f7fbff)] p-6 shadow-[0_20px_40px_rgba(76,81,164,0.12)]">
        <div className="pointer-events-none absolute -right-10 top-6 h-32 w-32 rounded-full bg-[#c7d2fe] opacity-40 blur-2xl" />
        <div className="pointer-events-none absolute -left-8 bottom-0 h-24 w-24 rounded-full bg-[#bae6fd] opacity-50 blur-2xl" />
        <div className="relative z-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#6D6AA6]">Player HQ</p>
              <h1 className="mt-2 text-[30px] font-semibold text-[#1E1A3C]">
                Welcome back, {data?.profile.displayName || auth.username}
              </h1>
              <p className="text-[13px] text-[#5B5F7A]">@{data?.profile.username || auth.username}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                <span className="rounded-full bg-white/70 px-3 py-1 text-[#3A2D7D]">
                  Level {data?.profile.level || 1}
                </span>
                <span className="rounded-full bg-white/70 px-3 py-1 text-[#3A2D7D]">
                  {streakDays} day streak
                </span>
                <span className="rounded-full bg-white/70 px-3 py-1 text-[#3A2D7D]">
                  {formatRelativeRepoUpdate(lastSync)}
                </span>
                {data?.profile.program ? (
                  <span className="rounded-full bg-white/70 px-3 py-1 text-[#3A2D7D]">
                    Program {data.profile.program}
                  </span>
                ) : null}
                {data?.focus_domain?.domain ? (
                  <span className="rounded-full bg-[#ecfeff] px-3 py-1 text-[#155e75]">
                    Focus: {data.focus_domain.domain}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex flex-col gap-2 lg:items-end">
              <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-left lg:text-right">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#6D6AA6]">XP Runway</p>
                <p className="mt-1 text-[22px] font-semibold text-[#1E1A3C]">{totalXp} XP</p>
                <p className="text-[12px] text-[#5B5F7A]">{remainingXp} XP to level up</p>
              </div>
              <p className="max-w-[240px] text-left text-[12px] text-[#5B5F7A] lg:text-right">
                {nextStepHint}
              </p>
            </div>
          </div>
          <div className="mt-5">
            <div className="flex items-center justify-between gap-2 text-[12px] text-[#6A6F88]">
              <p>XP to next level</p>
              <p>{levelProgress}%</p>
            </div>
            <div className="mt-2 h-3 rounded-full bg-white/70">
              <div
                className="h-3 rounded-full bg-[linear-gradient(90deg,#4f46e5,#22d3ee)] shadow-[0_6px_18px_rgba(79,70,229,0.35)]"
                style={{ width: `${levelProgress}%` }}
              />
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section {...sectionMotion} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Repos", value: totalRepos, note: "Tracked projects" },
          { label: "Active Repos", value: activeRepos30d, note: "Updated in 30 days" },
          { label: "Badges", value: shownBadges.length, note: "Achievements" },
          { label: "Portfolio", value: `${portfolioCompleteness}%`, note: "Profile completeness" },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-[#e1e6fb] bg-white/80 px-4 py-3 shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#6A6F88]">{card.label}</p>
            <p className="mt-2 text-[20px] font-semibold text-[#1E1A3C]">{card.value}</p>
            <p className="text-[11px] text-[#7A7F96]">{card.note}</p>
          </div>
        ))}
      </motion.section>

      <motion.section {...sectionMotion} className="grid gap-4">
        <article className="rounded-[24px] border border-[#e2e6fb] bg-white/85 p-5 shadow-[0_16px_28px_rgba(63,66,120,0.12)]">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#6D6AA6]">Program Aligned Insight</p>
          <h3 className="mt-2 text-[19px] font-medium text-[#1E1A3C]">Career Track Fit</h3>
          <p className="mt-1 text-[12px] text-[#6A6F88]">Signals from repositories translated into recommended career tracks.</p>
          <div className="mt-4 space-y-3">
            {(data?.career_suggestions || []).slice(0, 4).map((item, index) => (
              <div key={`${item.title}-${index}`} className="rounded-[14px] border border-[#e1e6fb] bg-[#f8f9ff] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[14px] font-medium text-[#2A2D4A]">{item.title}</p>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-[#6A6F88]">
                  <span>{item.confidence}% track fit</span>
                  <span>Confidence</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white">
                  <div className="h-2 rounded-full bg-[linear-gradient(90deg,#4f46e5,#818cf8)]" style={{ width: `${item.confidence}%` }} />
                </div>
                <p className="mt-2 text-[12px] text-[#5F6480]">{item.reasoning}</p>
              </div>
            ))}
            {(data?.career_suggestions || []).length === 0 ? (
              <p className="text-[12px] text-[#6A6F88]">
                No repo activity yet. Push a project or add languages to see career suggestions.
              </p>
            ) : null}
          </div>
        </article>
      </motion.section>

      <motion.section {...sectionMotion} className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-[24px] border border-[#e2e6fb] bg-white/85 p-5 shadow-[0_16px_28px_rgba(63,66,120,0.12)]">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#6D6AA6]">Next Steps</p>
              <h3 className="mt-1 text-[18px] font-medium text-[#1E1A3C]">Learning Path Snapshot</h3>
            </div>
            <span className="rounded-full bg-[#eef2ff] px-3 py-1 text-[11px] font-semibold text-[#3730a3]">
              {portfolioCompleteness}% complete
            </span>
          </div>
          <div className="mt-3 space-y-3">
            <div className="rounded-[16px] border border-[#e1e6fb] bg-[#f8f9ff] px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[#6A6F88]">Current Focus</p>
              <p className="mt-1 text-[14px] font-semibold text-[#2A2D4A]">
                {focusDimension?.domain || topCareerTrack?.title || "Build stronger repo evidence"}
              </p>
              <p className="mt-1 text-[12px] text-[#5F6480]">
                {focusDimension?.description || nextStepHint}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[16px] border border-[#e1e6fb] bg-white px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#6A6F88]">Recommended Role</p>
                <p className="mt-1 text-[18px] font-semibold text-[#1E1A3C]">
                  {topCareerTrack?.title || "Not enough signals yet"}
                </p>
                <p className="text-[12px] text-[#5F6480]">
                  {topCareerTrack ? `${topCareerTrack.confidence}% fit confidence` : "Push more projects to improve track accuracy."}
                </p>
              </div>
              <div className="rounded-[16px] border border-[#e1e6fb] bg-white px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#6A6F88]">Primary Stack</p>
                <p className="mt-1 text-[18px] font-semibold text-[#1E1A3C]">
                  {primaryLanguages[0] || "Not detected"}
                </p>
                <p className="text-[12px] text-[#5F6480]">
                  {primaryLanguages.length > 1 ? `${primaryLanguages.length} languages detected in repos` : "Add richer repo metadata to surface more stack signals."}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/learning-paths"
              className="rounded-full bg-[#4f46e5] px-4 py-2 text-[11px] font-semibold text-white shadow-[0_8px_18px_rgba(79,70,229,0.35)]"
            >
              Open Learning Path
            </Link>
            <Link
              to="/certificates"
              className="rounded-full border border-[#cfd6ff] bg-white px-4 py-2 text-[11px] font-semibold text-[#3b3a70] shadow-sm"
            >
              View Certificates
            </Link>
            <Link
              to="/portfolio"
              className="rounded-full border border-[#cfd6ff] bg-white px-4 py-2 text-[11px] font-semibold text-[#3b3a70] shadow-sm"
            >
              Open Portfolio
            </Link>
          </div>
        </article>

        <article className="rounded-[24px] border border-[#e2e6fb] bg-white/85 p-5 shadow-[0_16px_28px_rgba(63,66,120,0.12)]">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#6D6AA6]">Milestones</p>
          <h3 className="mt-2 text-[18px] font-medium text-[#1E1A3C]">Achievements and Certificate Goals</h3>
          <div className="mt-4 grid gap-3">
            <div className="rounded-[16px] border border-[#e1e6fb] bg-[#f8f9ff] px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[#6A6F88]">Claimable Rewards</p>
              <p className="mt-1 text-[20px] font-semibold text-[#1E1A3C]">{claimableBadges.length}</p>
              <p className="text-[12px] text-[#5F6480]">
                {claimableBadges.length > 0 ? "Achievements ready to claim." : "No pending rewards right now."}
              </p>
            </div>
            <div className="rounded-[16px] border border-[#e1e6fb] bg-[#f8f9ff] px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[#6A6F88]">Target Certifications</p>
              <p className="mt-1 text-[20px] font-semibold text-[#1E1A3C]">{targetCertifications.length}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {targetCertifications.slice(0, 3).map((cert) => (
                  <span key={cert} className="rounded-full bg-white px-2 py-1 text-[10px] text-[#5F6680]">
                    {cert}
                  </span>
                ))}
                {targetCertifications.length === 0 ? (
                  <span className="text-[12px] text-[#5F6480]">No target certifications set yet.</span>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              disabled={claimLoading || claimableBadges.length === 0}
              className="rounded-full border border-[#cfd6ff] bg-white px-4 py-2 text-[11px] font-semibold text-[#3b3a70] shadow-sm disabled:opacity-60"
              onClick={async () => {
                if (!auth.token || claimableBadges.length === 0) return
                const claimableCount = claimableBadges.length
                const xpGain = claimableBadges.reduce((sum, badge) => sum + Number(badge.reward_xp || 0), 0)
                setClaimLoading(true)
                try {
                  const updated = await claimBadges(auth.token)
                  setData((prev) => ({ ...updated, settings: prev?.settings || {} }))
                  setToast(`Claimed ${claimableCount} achievement(s). +${xpGain} XP`)
                } finally {
                  setClaimLoading(false)
                }
              }}
            >
              {claimLoading ? "Claiming..." : "Claim Rewards"}
            </button>
          </div>
        </article>

        <article className="rounded-[24px] border border-[#e2e6fb] bg-white/85 p-5 shadow-[0_16px_28px_rgba(63,66,120,0.12)]">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#6D6AA6]">Signals</p>
          <h3 className="mt-2 text-[18px] font-medium text-[#1E1A3C]">Recent Repository Signals</h3>
          <div className="mt-4 space-y-3">
            {recentSignals.map((item) => (
              <div key={item} className="rounded-[16px] border border-[#e1e6fb] bg-[#f8f9ff] px-4 py-3">
                <p className="text-[12px] text-[#2A2D4A]">{item}</p>
              </div>
            ))}
            {recentSignals.length === 0 ? (
              <p className="text-[12px] text-[#6A6F88]">
                No recent repository signals yet. Connect GitHub and push project updates to populate this view.
              </p>
            ) : null}
          </div>
        </article>
      </motion.section>

      <motion.section {...sectionMotion} className="grid gap-4">
        <article className="rounded-[24px] border border-[#e2e6fb] bg-white/85 p-5 shadow-[0_16px_28px_rgba(63,66,120,0.12)]">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#6D6AA6]">Repo Highlights</p>
              <h3 className="mt-1 text-[18px] font-medium text-[#1E1A3C]">Featured Repos</h3>
            </div>
            <span className="rounded-full bg-[#ecfeff] px-3 py-1 text-[11px] font-semibold text-[#155e75]">
              {featuredRepos.length} shown
            </span>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {featuredRepos.map((repo) => (
              <article key={repo.name} className="rounded-[12px] border border-[#e0e6f7] bg-[#fbfcff] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-[#6A6F88]">{repo.language || "Unknown"}</span>
                  <span className="text-[11px] text-[#6A6F88]">{formatRepoUpdated(repo.lastUpdated || repo.last_push)}</span>
                </div>
                <p className="mt-1 text-[13px] font-medium text-[#2A2D4A]">{repo.name}</p>
                <p className="mt-1 text-[12px] text-[#6A6F88]">{repo.description || "No description."}</p>
                <p className="mt-1 text-[11px] text-[#6A6F88]">Stars: {repo.stars}</p>
              </article>
            ))}
            {featuredRepos.length === 0 ? <p className="text-[12px] text-[#6A6F88]">No repositories found.</p> : null}
          </div>
        </article>
      </motion.section>

    </motion.div>
  )
}
