import { useEffect, useMemo, useRef, useState } from "react"
import { useLocation, useParams } from "react-router-dom"
import PortfolioPreview from "../components/PortfolioPreview"
import {
  fetchOwnerPortfolio,
  fetchPortfolio,
  generatePortfolioSummary,
  getStoredAuth,
  recomputeInsights,
  updateSettings,
} from "../lib/api"
import type { Badge, PortfolioResponse } from "../types"

type PublicPortfolioPageProps = {
  mode?: "public" | "owner"
}

type EducationItem = { year?: string; title: string }
type JobItem = {
  year?: string
  title: string
  company?: string
  location?: string
  start?: string
  end?: string
  description?: string
}
type VantaEffect = { destroy?: () => void }
type VantaNetFactory = (options: Record<string, unknown>) => VantaEffect

let vantaAssetsPromise: Promise<{ NET: VantaNetFactory; THREE: unknown }> | null = null

function loadVantaAssets() {
  vantaAssetsPromise ??= Promise.all([
    import("three"),
    import("vanta/dist/vanta.net.min"),
  ]).then(([threeModule, netModule]) => ({
    THREE: threeModule,
    NET: netModule.default as VantaNetFactory,
  }))
  return vantaAssetsPromise
}

function PortfolioNetBackground() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const effectRef = useRef<VantaEffect | null>(null)

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const container = containerRef.current
    if (!container || prefersReducedMotion.matches) return

    let cancelled = false
    let buildToken = 0

    const buildEffect = async () => {
      const currentToken = ++buildToken
      const { NET, THREE } = await loadVantaAssets()
      if (cancelled || currentToken !== buildToken || !containerRef.current) return

      effectRef.current?.destroy?.()
      effectRef.current = NET({
        el: containerRef.current,
        THREE,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200,
        minWidth: 200,
        scale: 1,
        scaleMobile: 1,
        color: 0x9cc7ff,
        backgroundColor: 0x2d364b,
        points: window.innerWidth < 768 ? 9 : window.innerWidth < 1200 ? 12 : 15,
        maxDistance: window.innerWidth < 768 ? 19 : 22,
        spacing: window.innerWidth < 768 ? 17 : 20,
        showDots: true,
      })
    }

    void buildEffect()
    const handleResize = () => {
      void buildEffect()
    }
    window.addEventListener("resize", handleResize)

    return () => {
      cancelled = true
      window.removeEventListener("resize", handleResize)
      effectRef.current?.destroy?.()
      effectRef.current = null
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-0 -z-10 opacity-[0.9]"
      aria-hidden
    />
  )
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item || "").trim()).filter(Boolean)
}

function toEducationArray(value: unknown): EducationItem[] {
  if (!Array.isArray(value)) return []
  const rows: EducationItem[] = []
  value.forEach((item) => {
    const row = item as Record<string, unknown>
    const title = String(row?.title || "").trim()
    const year = String(row?.year || "").trim()
    if (!title) return
    rows.push({ title, year: year || undefined })
  })
  return rows
}

function toJobArray(value: unknown): JobItem[] {
  if (!Array.isArray(value)) return []
  const rows: JobItem[] = []
  value.forEach((item) => {
    const row = item as Record<string, unknown>
    const title = String(row?.title || "").trim()
    const year = String(row?.year || "").trim()
    const company = String(row?.company || "").trim()
    const location = String(row?.location || "").trim()
    const start = String(row?.start || "").trim()
    const end = String(row?.end || "").trim()
    const description = String(row?.description || "").trim()
    if (!title) return
    rows.push({
      title,
      year: year || undefined,
      company: company || undefined,
      location: location || undefined,
      start: start || undefined,
      end: end || undefined,
      description: description || undefined,
    })
  })
  return rows
}

function parseCsv(input: string) {
  return input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function inferAutoTechStack(data: PortfolioResponse) {
  const detected = new Set<string>()
  const add = (value?: string | null) => {
    const clean = String(value || "").trim()
    if (!clean || clean.toLowerCase() === "unknown") return
    detected.add(clean)
  }

  data.repos.forEach((repo) => {
    add(repo.language)
    ;(repo.languages || []).forEach((language) => add(language))

    const repoText = [repo.name, repo.description, repo.language, ...(repo.languages || [])]
      .join(" ")
      .toLowerCase()

    if (/\breact\b/.test(repoText)) detected.add("React")
    if (/\btypescript\b/.test(repoText)) detected.add("TypeScript")
    if (/\bjavascript\b/.test(repoText)) detected.add("JavaScript")
    if (/\bhtml\b/.test(repoText)) detected.add("HTML")
    if (/\bcss\b/.test(repoText)) detected.add("CSS")
    if (/\btailwind\b/.test(repoText)) detected.add("Tailwind CSS")
    if (/\bbootstrap\b/.test(repoText)) detected.add("Bootstrap")
    if (/\bfastapi\b/.test(repoText)) detected.add("FastAPI")
    if (/\bnode\b|\bexpress\b/.test(repoText)) detected.add("Node.js")
    if (/\bmysql\b/.test(repoText)) detected.add("MySQL")
    if (/\bpostgres\b|\bpostgresql\b/.test(repoText)) detected.add("PostgreSQL")
    if (/\bmongodb\b/.test(repoText)) detected.add("MongoDB")
    if (/\bsupabase\b/.test(repoText)) detected.add("Supabase")
    if (/\bdocker\b/.test(repoText)) detected.add("Docker")
    if (/\bfirebase\b/.test(repoText)) detected.add("Firebase")
    if (/\blaravel\b/.test(repoText)) detected.add("Laravel")
    if (/\bdjango\b/.test(repoText)) detected.add("Django")
    if (/\bflask\b/.test(repoText)) detected.add("Flask")
  })

  return Array.from(detected).slice(0, 12)
}

function togglePick<T extends string>(list: T[], value: T) {
  if (list.includes(value)) return list.filter((item) => item !== value)
  return [...list, value]
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = () => reject(new Error("Failed to read image"))
    reader.readAsDataURL(file)
  })
}

export default function PublicPortfolioPage({ mode = "public" }: PublicPortfolioPageProps) {
  const { username } = useParams()
  const location = useLocation()
  const auth = getStoredAuth()
  const [data, setData] = useState<PortfolioResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [generatingAbout, setGeneratingAbout] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [reviewerCopied, setReviewerCopied] = useState(false)
  const [darkPreview, setDarkPreview] = useState(false)
  const [themeLight, setThemeLight] = useState("aurora")
  const [themeDark, setThemeDark] = useState("aurora")
  const [showBadges, setShowBadges] = useState(true)
  const [showFeaturedRepos, setShowFeaturedRepos] = useState(true)
  const [techStackText, setTechStackText] = useState("")
  const [aboutMeText, setAboutMeText] = useState("")
  const [profileImage, setProfileImage] = useState("")
  const [educationHistory, setEducationHistory] = useState<EducationItem[]>([])
  const [jobExperience, setJobExperience] = useState<JobItem[]>([])
  const [studentIdValue, setStudentIdValue] = useState("")
  const [programValue, setProgramValue] = useState("")
  const [yearLevelValue, setYearLevelValue] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactLinkedin, setContactLinkedin] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [featuredRepos, setFeaturedRepos] = useState<string[]>([])
  const [featuredBadges, setFeaturedBadges] = useState<string[]>([])
  const [fileBusy, setFileBusy] = useState(false)
  const socialLinksRef = useRef<Record<string, unknown>>({})
  const generatingAboutRef = useRef(false)

  const resolvedUsername = mode === "owner" ? auth.username || username : username
  const canEdit = mode === "owner" && Boolean(auth.token && auth.username)

  useEffect(() => {
    if (!resolvedUsername) {
      setData(null)
      return
    }
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const payload =
          mode === "owner" && auth.token ? await fetchOwnerPortfolio(auth.token) : await fetchPortfolio(resolvedUsername)
        if (cancelled) return
        setData(payload)
      } catch {
        if (cancelled) return
        setData(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [mode, resolvedUsername, auth.token])

  useEffect(() => {
    if (!data) return
    const socialLinks = (data.settings?.social_links || {}) as Record<string, unknown>
    socialLinksRef.current = socialLinks
    const sectionSettings = data.settings?.show_sections || {}

    setDarkPreview(Boolean(sectionSettings.preview_dark))
    setThemeLight(data.settings?.theme_light || data.settings?.theme || "aurora")
    setThemeDark(data.settings?.theme_dark || data.settings?.theme || "aurora")
    setShowBadges(sectionSettings.badges !== false)
    setShowFeaturedRepos(sectionSettings.repos !== false)
    const storedTechStack = toStringArray(socialLinks.tech_stack)
    const autoTechStack = inferAutoTechStack(data)
    setTechStackText((storedTechStack.length ? storedTechStack : autoTechStack).join(", "))
    setAboutMeText(data.settings?.bio || data.profile.bio || "")
    setProfileImage(typeof socialLinks.profile_image === "string" ? socialLinks.profile_image : "")
    setEducationHistory(toEducationArray(socialLinks.education_history))
    setJobExperience(toJobArray(socialLinks.job_experience))
    setStudentIdValue(typeof socialLinks.student_id === "string" ? socialLinks.student_id : data.profile.studentId || "")
    setProgramValue(typeof socialLinks.program === "string" ? socialLinks.program : data.profile.program || "")
    setYearLevelValue(typeof socialLinks.year_level === "string" ? socialLinks.year_level : data.profile.yearLevel || "")
    setContactEmail(typeof socialLinks.email === "string" ? socialLinks.email : "")
    setContactLinkedin(typeof socialLinks.linkedin === "string" ? socialLinks.linkedin : "")
    setContactPhone(typeof socialLinks.phone === "string" ? socialLinks.phone : "")
    setFeaturedRepos(toStringArray(data.settings?.featured_repos))
    setFeaturedBadges(toStringArray(data.settings?.featured_badges))
  }, [data])

  useEffect(() => {
    if (!shareCopied) return
    const timer = window.setTimeout(() => setShareCopied(false), 1500)
    return () => window.clearTimeout(timer)
  }, [shareCopied])

  useEffect(() => {
    if (!reviewerCopied) return
    const timer = window.setTimeout(() => setReviewerCopied(false), 1500)
    return () => window.clearTimeout(timer)
  }, [reviewerCopied])

  const techStack = parseCsv(techStackText)
  const visibleRepos = useMemo(() => {
    if (!data) return []
    if (featuredRepos.length === 0) return data.repos
    return data.repos.filter((repo) => featuredRepos.includes(repo.name))
  }, [data, featuredRepos])
  const achievedBadges = (data?.badges || []).filter((badge) => badge.achieved)
  const visibleBadges: Badge[] = useMemo(() => {
    if (!data) return []
    if (featuredBadges.length === 0) return data.badges
    return data.badges.filter((badge) => featuredBadges.includes(badge.label))
  }, [data, featuredBadges])

  const previewBackground = useMemo(() => {
    const active = darkPreview ? themeDark : themeLight
    if (darkPreview) {
      if (active === "sunset") return "bg-gradient-to-br from-[#4a3b34] via-[#5f4a3d] to-[#6e5a45]"
      if (active === "ocean") return "bg-gradient-to-br from-[#25374d] via-[#2b4562] to-[#345877]"
      return "bg-gradient-to-br from-[#3b4458] via-[#465066] to-[#52607b]"
    }
    if (active === "sunset") return "bg-gradient-to-br from-[#f4e7d5] via-[#f0dfc7] to-[#ebd8b8]"
    if (active === "ocean") return "bg-gradient-to-br from-[#e2ebf4] via-[#dce8f3] to-[#d3e2ee]"
    return "bg-gradient-to-br from-[#e8ecf3] via-[#e4e9f2] to-[#dae2ee]"
  }, [darkPreview, themeDark, themeLight])

  const editorAvatarFallback = useMemo(() => {
    const source = data?.profile.displayName || resolvedUsername || "Portfolio"
    const initials = source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("")
    return initials || "P"
  }, [data, resolvedUsername])

  const editorSectionClass = "portfolio-editor-card animate-[lspuFadeUp_0.55s_ease-out_both]"
  const editorInputClass = "portfolio-editor-input"
  const editorTextareaClass = "portfolio-editor-input min-h-[120px] resize-y"
  const editorSelectClass = "portfolio-editor-input appearance-none"
  const editorActionButtonClass =
    "inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.06] px-3 py-1.5 text-[12px] font-semibold tracking-[0.01em] text-[#f4f7ff] transition duration-200 hover:-translate-y-[1px] hover:bg-white/[0.1]"
  const heroActionButtonClass =
    "inline-flex min-h-[48px] items-center justify-center rounded-full px-5 py-2.5 text-[14px] font-semibold tracking-[0.01em] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
  const heroPrimaryButtonClass = `${heroActionButtonClass} border border-[#f2d188] bg-[linear-gradient(135deg,#f0cb76,#cfab5d_58%,#b9852d)] text-[#fffdf6] shadow-[0_14px_36px_rgba(207,176,108,0.34)] hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(207,176,108,0.44)] active:translate-y-0`
  const heroSecondaryButtonClass = `${heroActionButtonClass} border border-[#5f6a85] bg-[linear-gradient(180deg,rgba(79,92,119,0.96),rgba(53,64,88,0.98))] text-[#edf3ff] shadow-[0_12px_30px_rgba(7,12,25,0.22)] hover:-translate-y-0.5 hover:border-[#8393b9] hover:bg-[linear-gradient(180deg,rgba(94,108,138,0.98),rgba(63,75,102,1))] hover:shadow-[0_16px_34px_rgba(9,15,32,0.3)] active:translate-y-0`
  const heroSaveButtonClass = `${heroActionButtonClass} border border-[#8db8ff] bg-[linear-gradient(135deg,#7db3ff,#4a7ee8_55%,#315fc4)] text-white shadow-[0_16px_36px_rgba(65,110,215,0.34)] hover:-translate-y-0.5 hover:border-[#b6d2ff] hover:shadow-[0_20px_46px_rgba(65,110,215,0.42)] active:translate-y-0 disabled:translate-y-0 disabled:border-[#5d6d91] disabled:bg-[linear-gradient(180deg,rgba(80,92,119,0.8),rgba(57,67,92,0.84))] disabled:text-[#c7d3eb] disabled:shadow-none disabled:opacity-70`

  if (!resolvedUsername) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-[#DDE1EB] bg-white p-4 text-[13px] text-[#4B5368]">
          Portfolio username not found.
        </div>
      </div>
    )
  }

  if (!data && !loading) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-[#DDE1EB] bg-white p-4 text-[13px] text-[#4B5368]">
          Unable to load portfolio.
        </div>
      </div>
    )
  }

  const shareUrl = `${window.location.origin}/p/${resolvedUsername}`
  const reviewerUrl = `${window.location.origin}/p/${resolvedUsername}?review=1`
  const isFromAdmin = location.pathname.startsWith("/admin")

  const saveChanges = async () => {
    if (!auth.token || !canEdit) return
    setSaving(true)
    try {
      const updated = await updateSettings(auth.token, {
        theme_light: themeLight,
        theme_dark: themeDark,
        theme: themeLight,
        bio: aboutMeText.trim(),
        show_sections: {
          badges: showBadges,
          repos: showFeaturedRepos,
          preview_dark: darkPreview,
        },
        featured_repos: featuredRepos,
        featured_badges: featuredBadges,
        social_links: {
          ...socialLinksRef.current,
          tech_stack: techStack,
          profile_image: profileImage || undefined,
          education_history: educationHistory,
          job_experience: jobExperience,
          student_id: studentIdValue || undefined,
          program: programValue || undefined,
          year_level: yearLevelValue || undefined,
          email: contactEmail || undefined,
          linkedin: contactLinkedin || undefined,
          phone: contactPhone || undefined,
        },
      })
      setData(updated)
    } finally {
      setSaving(false)
    }
  }

  const syncPortfolio = async () => {
    if (!auth.token || !canEdit) return
    setSyncing(true)
    try {
      await recomputeInsights(auth.token)
      const refreshed = await fetchOwnerPortfolio(auth.token)
      setData(refreshed)
    } finally {
      setSyncing(false)
    }
  }

  const handleGenerateAbout = async () => {
    if (!auth.token || !canEdit || generatingAboutRef.current || generatingAbout) return
    generatingAboutRef.current = true
    setGeneratingAbout(true)
    try {
      const summary = await generatePortfolioSummary(auth.token)
      if (summary) {
        setAboutMeText(summary)
      }
    } finally {
      generatingAboutRef.current = false
      setGeneratingAbout(false)
    }
  }

  return (
    <div
      className="relative min-h-screen"
      style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
    >
      {mode === "owner" ? (
        <>
          <div
            className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.2),transparent_28%),linear-gradient(180deg,#2d364b_0%,#2f384e_42%,#2a3244_100%)]"
            aria-hidden
          />
          <PortfolioNetBackground />
          <div
            className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(180deg,rgba(9,13,24,0.08),rgba(18,26,46,0.22)_54%,rgba(8,12,24,0.36))]"
            aria-hidden
          />
        </>
      ) : null}
      <div className="mx-auto max-w-[1680px] px-4 py-6 sm:px-6 lg:px-8">
        <div className={`relative ${mode === "owner" ? "px-5 py-5 sm:px-6 sm:py-6" : ""}`}>
        {mode === "owner" ? (
          <section className="mb-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-[#b8c2d8]">Public Portfolio</p>
                <h1 className="text-[48px] leading-none text-[#edf2fc]">Customize your live profile</h1>
                {isFromAdmin ? (
                  <a href="/admin" className="mt-1 inline-block text-[14px] text-[#d4dced] hover:underline">
                    Back to Admin
                  </a>
                ) : null}
              </div>
              <div className="grid w-full gap-2 sm:grid-cols-2 xl:flex xl:w-auto xl:flex-wrap xl:items-center">
                <button
                  type="button"
                  className={`${heroPrimaryButtonClass} w-full xl:w-auto`}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(shareUrl)
                      setShareCopied(true)
                    } catch {}
                  }}
                >
                  {shareCopied ? "Copied!" : "Share portfolio URL"}
                </button>
                <button
                  type="button"
                  className={`${heroSecondaryButtonClass} w-full xl:w-auto`}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(reviewerUrl)
                      setReviewerCopied(true)
                    } catch {}
                  }}
                >
                  {reviewerCopied ? "Reviewer link copied" : "Copy reviewer link"}
                </button>
                <button
                  type="button"
                  disabled={syncing || saving || !canEdit}
                  className={`${heroSecondaryButtonClass} w-full xl:w-auto`}
                  onClick={syncPortfolio}
                >
                  {syncing ? "Syncing..." : "Sync"}
                </button>
                <button
                  type="button"
                  disabled={saving || !canEdit}
                  className={`${heroSaveButtonClass} w-full xl:w-auto`}
                  onClick={saveChanges}
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
          </section>
        ) : null}

        <section className={mode === "owner" ? "grid gap-5 xl:grid-cols-[460px_minmax(0,1fr)]" : ""}>
          {mode === "owner" ? (
            <aside className="portfolio-editor-shell self-start overflow-hidden rounded-[32px] p-4 text-[#d6deef] sm:p-5 xl:sticky xl:top-6">
              <div className="xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto xl:pr-1">
                <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(17,23,43,0.9),rgba(22,31,60,0.86)_58%,rgba(12,17,35,0.96))] p-5 shadow-[0_24px_60px_rgba(4,8,20,0.45)]">
                <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-[#8fa6ff]">Portfolio Studio</p>
                <h2
                  className="mt-3 text-[34px] leading-[0.95] text-white sm:text-[40px]"
                  style={{ fontFamily: "Oxanium, Plus Jakarta Sans, sans-serif", fontWeight: 700 }}
                >
                  Customization
                </h2>
                <p className="mt-3 max-w-[30ch] text-[13px] leading-6 text-[#aebad6]">
                  Shape your portfolio editor into something sharper, more personal, and presentation-ready before you share it.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-[#6f7cff]/35 bg-[#7c88ff]/14 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#dce2ff]">
                    Live editor
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#bac7e8]">
                    Premium layout
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                <article className={editorSectionClass} style={{ animationDelay: "60ms" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="portfolio-editor-kicker">Sections</p>
                      <h3 className="mt-2 text-[20px] font-semibold text-white">Control what people see first</h3>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-[#c9d7ff]">
                      Live
                    </span>
                  </div>
                  <div className="mt-4 max-h-[260px] space-y-3 overflow-y-auto pr-1">
                    <label className="portfolio-editor-toggle-row">
                      <div>
                        <p className="text-[14px] font-semibold text-[#f5f7ff]">Show badges</p>
                        <p className="mt-1 text-[12px] text-[#95a3c7]">Highlight earned milestones in the public profile.</p>
                      </div>
                      <span className={`portfolio-editor-toggle ${showBadges ? "bg-[#7c88ff]" : "bg-white/10"}`}>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={showBadges}
                          onChange={(event) => setShowBadges(event.target.checked)}
                        />
                        <span
                          className={`portfolio-editor-toggle-knob ${showBadges ? "translate-x-[20px]" : "translate-x-0"}`}
                        />
                      </span>
                    </label>
                    <label className="portfolio-editor-toggle-row">
                      <div>
                        <p className="text-[14px] font-semibold text-[#f5f7ff]">Show featured repos</p>
                        <p className="mt-1 text-[12px] text-[#95a3c7]">Keep your strongest work visible in the hero flow.</p>
                      </div>
                      <span className={`portfolio-editor-toggle ${showFeaturedRepos ? "bg-[#7c88ff]" : "bg-white/10"}`}>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={showFeaturedRepos}
                          onChange={(event) => setShowFeaturedRepos(event.target.checked)}
                        />
                        <span
                          className={`portfolio-editor-toggle-knob ${
                            showFeaturedRepos ? "translate-x-[20px]" : "translate-x-0"
                          }`}
                        />
                      </span>
                    </label>
                  </div>
                </article>

                <article className={editorSectionClass} style={{ animationDelay: "100ms" }}>
                  <p className="portfolio-editor-kicker">Tech stack</p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <h3 className="text-[20px] font-semibold text-white">Signature tools and languages</h3>
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-[#c9d7ff]">
                      {techStack.length} items
                    </span>
                  </div>
                  <input
                    value={techStackText}
                    onChange={(event) => setTechStackText(event.target.value)}
                    className={`mt-4 ${editorInputClass}`}
                    placeholder="Manual add: React, FastAPI, PostgreSQL"
                  />
                </article>

                <article className={editorSectionClass} style={{ animationDelay: "140ms" }}>
                  <p className="portfolio-editor-kicker">About</p>
                  <h3 className="mt-2 text-[20px] font-semibold text-white">Tell the story behind the code</h3>
                  <textarea
                    value={aboutMeText}
                    onChange={(event) => setAboutMeText(event.target.value)}
                    className={`mt-4 ${editorTextareaClass}`}
                    placeholder="Write a polished summary that sounds like you."
                  />
                  <p className="mt-3 text-[12px] leading-6 text-[#95a3c7]">
                    Use AI to draft this from your repositories, strengths, and target role, then keep the version that feels personal.
                  </p>
                </article>

                <article className={editorSectionClass} style={{ animationDelay: "180ms" }}>
                  <p className="portfolio-editor-kicker">Identity</p>
                  <h3 className="mt-2 text-[20px] font-semibold text-white">Profile picture</h3>
                  <div className="mt-4 flex items-center gap-4 rounded-[22px] border border-white/10 bg-white/[0.04] p-3">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[22px] border border-white/12 bg-[radial-gradient(circle_at_30%_30%,rgba(139,152,255,0.35),rgba(46,58,96,0.18)_58%,rgba(11,16,32,0.9))] text-[24px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]">
                      {profileImage ? (
                        <img src={profileImage} alt="Profile preview" className="h-full w-full object-cover" />
                      ) : (
                        editorAvatarFallback
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-[#f5f7ff]">Square image recommended</p>
                      <p className="mt-1 text-[12px] leading-5 text-[#95a3c7]">
                        Use a clean portrait or a sharp brand mark for a stronger first impression.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <label className={`${editorActionButtonClass} cursor-pointer`}>
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={async (event) => {
                          const file = event.target.files?.[0]
                          if (!file) return
                          setFileBusy(true)
                          try {
                            const asDataUrl = await fileToDataUrl(file)
                            setProfileImage(asDataUrl)
                          } finally {
                            setFileBusy(false)
                          }
                        }}
                      />
                      {fileBusy ? "Uploading..." : "Choose image"}
                    </label>
                    <button
                      type="button"
                      disabled={fileBusy || !profileImage}
                      className={`${editorActionButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
                      onClick={() => setProfileImage("")}
                    >
                      Remove image
                    </button>
                  </div>
                </article>

                <article className={editorSectionClass} style={{ animationDelay: "220ms" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="portfolio-editor-kicker">Education</p>
                      <h3 className="mt-2 text-[20px] font-semibold text-white">Academic timeline</h3>
                    </div>
                    <button
                      type="button"
                      className={editorActionButtonClass}
                      onClick={() => setEducationHistory((prev) => [...prev, { title: "", year: "" }])}
                    >
                      Add education
                    </button>
                  </div>
                  <div className="mt-4 max-h-[320px] space-y-3 overflow-y-auto pr-1">
                    {educationHistory.length === 0 ? (
                      <div className="rounded-[18px] border border-dashed border-white/10 bg-white/[0.03] px-4 py-3 text-[12px] text-[#95a3c7]">
                        Add your degree, school, or training milestones here.
                      </div>
                    ) : null}
                    {educationHistory.map((item, index) => (
                      <div key={`education-${index}`} className="rounded-[20px] border border-white/10 bg-[#0b1326]/82 p-3">
                        <input
                          value={item.title}
                          onChange={(event) =>
                            setEducationHistory((prev) =>
                              prev.map((row, i) => (i === index ? { ...row, title: event.target.value } : row))
                            )
                          }
                          className={editorInputClass}
                          placeholder="Degree / School / Program"
                        />
                        <div className="mt-3 flex items-center gap-2">
                          <input
                            value={item.year || ""}
                            onChange={(event) =>
                              setEducationHistory((prev) =>
                                prev.map((row, i) => (i === index ? { ...row, year: event.target.value } : row))
                              )
                            }
                            className={editorInputClass}
                            placeholder="Year or date range"
                          />
                          <button
                            type="button"
                            onClick={() => setEducationHistory((prev) => prev.filter((_, i) => i !== index))}
                            className={`${editorActionButtonClass} shrink-0`}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>

                <article className={editorSectionClass} style={{ animationDelay: "260ms" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="portfolio-editor-kicker">Experience</p>
                      <h3 className="mt-2 text-[20px] font-semibold text-white">Job experience</h3>
                    </div>
                    <button
                      type="button"
                      className={editorActionButtonClass}
                      onClick={() =>
                        setJobExperience((prev) => [
                          ...prev,
                          { title: "", company: "", location: "", start: "", end: "", description: "" },
                        ])
                      }
                    >
                      Add job
                    </button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {jobExperience.length === 0 ? (
                      <div className="rounded-[18px] border border-dashed border-white/10 bg-white/[0.03] px-4 py-3 text-[12px] text-[#95a3c7]">
                        Add internships, freelance work, organizations, or leadership roles.
                      </div>
                    ) : null}
                    {jobExperience.map((item, index) => (
                      <div key={`job-${index}`} className="rounded-[20px] border border-white/10 bg-[#0b1326]/82 p-3">
                        <input
                          value={item.title}
                          onChange={(event) =>
                            setJobExperience((prev) =>
                              prev.map((row, i) => (i === index ? { ...row, title: event.target.value } : row))
                            )
                          }
                          className={editorInputClass}
                          placeholder="Job title"
                        />
                        <input
                          value={item.company || ""}
                          onChange={(event) =>
                            setJobExperience((prev) =>
                              prev.map((row, i) => (i === index ? { ...row, company: event.target.value } : row))
                            )
                          }
                          className={`mt-3 ${editorInputClass}`}
                          placeholder="Company / organization"
                        />
                        <input
                          value={item.location || ""}
                          onChange={(event) =>
                            setJobExperience((prev) =>
                              prev.map((row, i) => (i === index ? { ...row, location: event.target.value } : row))
                            )
                          }
                          className={`mt-3 ${editorInputClass}`}
                          placeholder="Location or remote"
                        />
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <input
                            value={item.start || ""}
                            onChange={(event) =>
                              setJobExperience((prev) =>
                                prev.map((row, i) => (i === index ? { ...row, start: event.target.value } : row))
                              )
                            }
                            className={editorInputClass}
                            placeholder="Start"
                          />
                          <input
                            value={item.end || ""}
                            onChange={(event) =>
                              setJobExperience((prev) =>
                                prev.map((row, i) => (i === index ? { ...row, end: event.target.value } : row))
                              )
                            }
                            className={editorInputClass}
                            placeholder="End"
                          />
                        </div>
                        <textarea
                          value={item.description || ""}
                          onChange={(event) =>
                            setJobExperience((prev) =>
                              prev.map((row, i) => (i === index ? { ...row, description: event.target.value } : row))
                            )
                          }
                          className={`mt-3 ${editorTextareaClass}`}
                          placeholder="Describe wins, responsibilities, impact, and tools used."
                        />
                        <button
                          type="button"
                          onClick={() => setJobExperience((prev) => prev.filter((_, i) => i !== index))}
                          className={`${editorActionButtonClass} mt-3`}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </article>

                <article className={editorSectionClass} style={{ animationDelay: "300ms" }}>
                  <p className="portfolio-editor-kicker">Profile details</p>
                  <h3 className="mt-2 text-[20px] font-semibold text-white">Student information</h3>
                  <div className="mt-4 grid gap-3">
                    <input
                      value={studentIdValue}
                      onChange={(event) => setStudentIdValue(event.target.value)}
                      className={editorInputClass}
                      placeholder="Student ID"
                    />
                    <select value={programValue} onChange={(event) => setProgramValue(event.target.value)} className={editorSelectClass}>
                      <option value="">Select program</option>
                      <option value="BSCS">BSCS</option>
                      <option value="BSIT">BSIT</option>
                    </select>
                    <select
                      value={yearLevelValue}
                      onChange={(event) => setYearLevelValue(event.target.value)}
                      className={editorSelectClass}
                    >
                      <option value="">Select year level</option>
                      <option value="1st Year">1st Year</option>
                      <option value="2nd Year">2nd Year</option>
                      <option value="3rd Year">3rd Year</option>
                      <option value="4th Year">4th Year</option>
                    </select>
                  </div>
                </article>

                <article className={editorSectionClass} style={{ animationDelay: "340ms" }}>
                  <p className="portfolio-editor-kicker">Reachability</p>
                  <h3 className="mt-2 text-[20px] font-semibold text-white">Contact</h3>
                  <div className="mt-4 grid gap-3">
                    <input value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} className={editorInputClass} placeholder="Email" />
                    <input
                      value={contactLinkedin}
                      onChange={(event) => setContactLinkedin(event.target.value)}
                      className={editorInputClass}
                      placeholder="LinkedIn URL"
                    />
                    <input
                      value={contactPhone}
                      onChange={(event) => setContactPhone(event.target.value)}
                      className={editorInputClass}
                      placeholder="Contact number"
                    />
                  </div>
                </article>

                <article className={editorSectionClass} style={{ animationDelay: "380ms" }}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="portfolio-editor-kicker">Portfolio picks</p>
                      <h3 className="mt-2 text-[20px] font-semibold text-white">Featured repositories</h3>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-[#c9d7ff]">
                      {featuredRepos.length || data?.repos.length || 0}
                    </span>
                  </div>
                  <div className="portfolio-editor-scroll mt-4 grid max-h-56 gap-2 overflow-y-auto pr-1">
                    {(data?.repos || []).map((repo) => {
                      const checked = featuredRepos.includes(repo.name)
                      return (
                        <label
                          key={`repo-pick-${repo.name}`}
                          className={`portfolio-editor-check-row ${checked ? "border-[#7b88ff]/45 bg-[#7b88ff]/14 text-white" : ""}`}
                        >
                          <input
                            type="checkbox"
                            className="accent-[#7c88ff]"
                            checked={checked}
                            onChange={() => setFeaturedRepos((prev) => togglePick(prev, repo.name))}
                          />
                          <span className="truncate">{repo.name}</span>
                        </label>
                      )
                    })}
                  </div>
                </article>

                <article className={editorSectionClass} style={{ animationDelay: "420ms" }}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="portfolio-editor-kicker">Milestones</p>
                      <h3 className="mt-2 text-[20px] font-semibold text-white">Badges to display</h3>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-[#c9d7ff]">
                      {featuredBadges.length || achievedBadges.length || 0}
                    </span>
                  </div>
                  <div className="portfolio-editor-scroll mt-4 grid max-h-56 gap-2 overflow-y-auto pr-1">
                    {achievedBadges.map((badge) => {
                      const checked = featuredBadges.includes(badge.label)
                      return (
                        <label
                          key={`badge-pick-${badge.label}`}
                          className={`portfolio-editor-check-row ${checked ? "border-[#7b88ff]/45 bg-[#7b88ff]/14 text-white" : ""}`}
                        >
                          <input
                            type="checkbox"
                            className="accent-[#7c88ff]"
                            checked={checked}
                            onChange={() => setFeaturedBadges((prev) => togglePick(prev, badge.label))}
                          />
                          <span className="truncate">{badge.label}</span>
                        </label>
                      )
                    })}
                  </div>
                </article>
                </div>
              </div>
            </aside>
          ) : null}

          <div className={`${previewBackground} rounded-[24px] p-3`}>
            {loading || !data ? (
              <div className="rounded-xl border border-[#DDE1EB] bg-white p-4 text-[13px] text-[#4B5368]">Loading...</div>
            ) : (
              <PortfolioPreview
                profile={data.profile}
                badges={visibleBadges}
                repos={visibleRepos}
                techStack={techStack}
                aboutMe={aboutMeText}
                practiceDimensions={data.practice_dimensions}
                educationHistory={educationHistory}
                jobExperience={jobExperience}
                contact={{
                  email: contactEmail || undefined,
                  linkedin: contactLinkedin || undefined,
                  phone: contactPhone || undefined,
                }}
                academic={{
                  studentId: studentIdValue || undefined,
                  program: programValue || undefined,
                  yearLevel: yearLevelValue || undefined,
                }}
                profileImage={profileImage || undefined}
                enableRepoLinks
                showBadgeStatus={mode !== "public"}
                showBadges={showBadges}
                showFeaturedRepos={showFeaturedRepos}
                canGenerateAbout={canEdit}
                isGeneratingAbout={generatingAbout}
                onGenerateAbout={handleGenerateAbout}
              />
            )}
          </div>
        </section>
        </div>
      </div>
    </div>
  )
}
