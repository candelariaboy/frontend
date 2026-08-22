import type { Badge, PracticeDimension, RepoSummary, UserProfile } from "../types"

type JobExperienceItem = {
  year?: string
  title: string
  company?: string
  location?: string
  start?: string
  end?: string
  description?: string
}

type EducationHistoryItem = {
  year?: string
  title: string
}

type ContactInfo = {
  email?: string
  linkedin?: string
  phone?: string
}

type AcademicInfo = {
  studentId?: string
  program?: string
  yearLevel?: string
}

type PortfolioPreviewProps = {
  profile: UserProfile
  badges: Badge[]
  repos: RepoSummary[]
  techStack: string[]
  aboutMe: string
  practiceDimensions?: PracticeDimension[]
  educationHistory?: EducationHistoryItem[]
  jobExperience?: JobExperienceItem[]
  contact: ContactInfo
  academic?: AcademicInfo
  profileImage?: string
  enableRepoLinks?: boolean
  showBadgeStatus?: boolean
  showBadges?: boolean
  showFeaturedRepos?: boolean
  canGenerateAbout?: boolean
  isGeneratingAbout?: boolean
  onGenerateAbout?: () => void
}

function normalizeUrl(value: string) {
  if (value.startsWith("http://") || value.startsWith("https://")) return value
  return `https://${value}`
}

function formatRepoDate(value?: string | null) {
  if (!value) return "recently"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(parsed)
}

function totalCommits(repos: RepoSummary[]) {
  return repos.reduce((sum, repo) => sum + Number(repo.commitCount || 0), 0)
}

function totalStars(repos: RepoSummary[]) {
  return repos.reduce((sum, repo) => sum + Number(repo.stars || 0), 0)
}

function topLanguages(repos: RepoSummary[]) {
  const counts = new Map<string, number>()
  repos.forEach((repo) => {
    const mergedLanguages = [
      ...(repo.languages || []),
      ...Object.keys(repo.languageBytes || {}),
      repo.language,
    ]
    mergedLanguages.forEach((language) => {
      const clean = String(language || "").trim()
      if (!clean || clean === "Unknown") return
      counts.set(clean, (counts.get(clean) || 0) + 1)
    })
  })
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([label]) => label)
}

function repoLanguageList(repo: RepoSummary) {
  const values = [
    ...(repo.languages || []),
    ...Object.keys(repo.languageBytes || {}),
    repo.language,
  ]
    .map((language) => String(language || "").trim())
    .filter((language) => Boolean(language) && language !== "Unknown")
  return [...new Set(values)]
}

export default function PortfolioPreview({
  profile,
  badges,
  repos,
  techStack,
  aboutMe,
  practiceDimensions = [],
  educationHistory = [],
  jobExperience = [],
  contact,
  academic,
  profileImage,
  enableRepoLinks = false,
  showBadgeStatus = true,
  showBadges = true,
  showFeaturedRepos = true,
  canGenerateAbout = false,
  isGeneratingAbout = false,
  onGenerateAbout,
}: PortfolioPreviewProps) {
  const visibleBadges = badges.filter((badge) => badge.achieved || badge.claimed)
  const resolvedProfileImage = profileImage?.trim() ? profileImage.trim() : profile.avatarUrl
  const sortedDimensions = [...practiceDimensions].sort((a, b) => b.confidence - a.confidence)
  const strengths = sortedDimensions.slice(0, 3)
  const featuredLanguages = topLanguages(repos)
  const commitTotal = totalCommits(repos)
  const starTotal = totalStars(repos)
  const topProjects = repos.slice(0, 2)
  const remainingProjects = repos.slice(2)
  const hasContact = Boolean(contact.email || contact.phone || contact.linkedin)

  return (
    <div className="overflow-hidden rounded-[18px] border border-[#d9dce6] bg-white shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
      <section className="border-b border-[#e6e8ef] bg-[linear-gradient(135deg,#f8fbff_0%,#eef4ff_52%,#fdfdff_100%)] px-5 py-6 sm:px-6 sm:py-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <img
              src={resolvedProfileImage}
              alt={profile.displayName}
              className="h-20 w-20 shrink-0 rounded-full border border-[#d3d8e7] object-cover shadow-[0_8px_20px_rgba(59,91,155,0.12)]"
            />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7180a0]">Student Portfolio</p>
              <h2 className="mt-2 text-[32px] font-semibold leading-tight text-[#131722] sm:text-[38px]">{profile.displayName}</h2>
              <p className="mt-1 text-[14px] text-[#5a6276]">@{profile.username}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {academic?.program ? (
                  <span className="rounded-full border border-[#d7deef] bg-white px-3 py-1 text-[11px] font-semibold text-[#32415d]">
                    {academic.program}
                  </span>
                ) : null}
                {academic?.yearLevel ? (
                  <span className="rounded-full border border-[#d7deef] bg-white px-3 py-1 text-[11px] font-semibold text-[#32415d]">
                    {academic.yearLevel}
                  </span>
                ) : null}
                {academic?.studentId ? (
                  <span className="rounded-full border border-[#d7deef] bg-white px-3 py-1 text-[11px] font-semibold text-[#32415d]">
                    ID {academic.studentId}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[360px] xl:grid-cols-4">
            <div className="rounded-[14px] border border-[#dde5f5] bg-white px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8a95ad]">Level</p>
              <p className="mt-2 text-2xl font-semibold text-[#101828]">{profile.level}</p>
            </div>
            <div className="rounded-[14px] border border-[#dde5f5] bg-white px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8a95ad]">XP</p>
              <p className="mt-2 text-2xl font-semibold text-[#101828]">{profile.xp}</p>
            </div>
            <div className="rounded-[14px] border border-[#dde5f5] bg-white px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8a95ad]">Projects</p>
              <p className="mt-2 text-2xl font-semibold text-[#101828]">{repos.length}</p>
            </div>
            <div className="rounded-[14px] border border-[#dde5f5] bg-white px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8a95ad]">Streak</p>
              <p className="mt-2 text-2xl font-semibold text-[#101828]">{profile.streakDays}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-0 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="border-b border-[#edf1f7] bg-[#fbfcff] px-5 py-5 xl:border-b-0 xl:border-r xl:px-6">
          <div className="space-y-5 xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto xl:pr-1">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7c88a3]">About</p>
              <p className="mt-3 text-[14px] leading-7 text-[#334155]">
                {aboutMe || "No professional summary yet."}
              </p>
              {canGenerateAbout ? (
                <button
                  type="button"
                  onClick={onGenerateAbout}
                  disabled={isGeneratingAbout}
                  className="mt-4 rounded-full border border-[#d4d9ea] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#334164] disabled:cursor-wait disabled:opacity-60"
                >
                  {isGeneratingAbout ? "Generating..." : aboutMe ? "Refresh AI summary" : "Generate AI summary"}
                </button>
              ) : null}
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7c88a3]">Core Stack</p>
              {techStack.length === 0 ? (
                <p className="mt-3 text-[13px] text-[#6b7390]">No tech stack selected yet.</p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {techStack.map((item, index) => (
                    <span key={`${item}-${index}`} className="rounded-full border border-[#d7deef] bg-white px-3 py-1 text-[11px] font-semibold text-[#34405a]">
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {featuredLanguages.length > 0 ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7c88a3]">Top Languages</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {featuredLanguages.map((language) => (
                    <span key={language} className="rounded-full border border-[#d7deef] bg-white px-3 py-1 text-[11px] font-semibold text-[#34405a]">
                      {language}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {strengths.length > 0 ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7c88a3]">Top Strengths</p>
                <div className="mt-3 space-y-2">
                  {strengths.map((item) => (
                    <div key={item.label} className="rounded-[12px] border border-[#e4e8f2] bg-white px-3 py-3">
                      <div className="flex items-center justify-between gap-3 text-[13px]">
                        <span className="font-semibold text-[#243043]">{item.label}</span>
                        <span className="font-semibold text-[#52607b]">{item.confidence}%</span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-[#edf2f8]">
                        <div className="h-1.5 rounded-full bg-[#4f7cff]" style={{ width: `${item.confidence}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {hasContact ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7c88a3]">Contact</p>
                <div className="mt-3 space-y-2">
                  {contact.email ? (
                    <div className="rounded-[12px] border border-[#e4e8f2] bg-white px-3 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8a95ad]">Email</p>
                      <p className="mt-1 break-all text-[13px] font-medium text-[#2d3447]">{contact.email}</p>
                    </div>
                  ) : null}
                  {contact.phone ? (
                    <div className="rounded-[12px] border border-[#e4e8f2] bg-white px-3 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8a95ad]">Phone</p>
                      <p className="mt-1 text-[13px] font-medium text-[#2d3447]">{contact.phone}</p>
                    </div>
                  ) : null}
                  {contact.linkedin ? (
                    <div className="rounded-[12px] border border-[#e4e8f2] bg-white px-3 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8a95ad]">LinkedIn</p>
                      <a
                        href={normalizeUrl(contact.linkedin)}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex text-[13px] font-medium text-[#2f4bb8] hover:underline"
                      >
                        View LinkedIn Profile
                      </a>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </aside>

        <main className="space-y-0">
          <section className="border-b border-[#edf1f7] px-5 py-5 sm:px-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[14px] border border-[#e7ecf4] bg-[#fcfdff] px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8a95ad]">Commits</p>
                <p className="mt-2 text-2xl font-semibold text-[#101828]">{commitTotal}</p>
              </div>
              <div className="rounded-[14px] border border-[#e7ecf4] bg-[#fcfdff] px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8a95ad]">Stars</p>
                <p className="mt-2 text-2xl font-semibold text-[#101828]">{starTotal}</p>
              </div>
              <div className="rounded-[14px] border border-[#e7ecf4] bg-[#fcfdff] px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8a95ad]">Badges</p>
                <p className="mt-2 text-2xl font-semibold text-[#101828]">{visibleBadges.length}</p>
              </div>
            </div>
          </section>

          {showFeaturedRepos ? (
            <section className="border-b border-[#edf1f7] px-5 py-5 sm:px-6">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7c88a3]">Featured Projects</p>
                  <h3 className="mt-2 text-[24px] font-semibold text-[#171f31]">Project Highlights</h3>
                  <p className="mt-1 text-[13px] text-[#667085]">A clean view of the strongest work first, followed by the full repository catalog.</p>
                </div>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {topProjects.map((repo) => {
                  const repoUrl = repo.htmlUrl || `https://github.com/${profile.username}/${repo.name}`
                  const languages = repoLanguageList(repo)
                  const card = (
                    <article className="h-full rounded-[16px] border border-[#e7ecf4] bg-[#fcfdff] p-4 transition hover:border-[#cfd7e6] hover:shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h4 className="text-[17px] font-semibold text-[#172033]">{repo.name}</h4>
                          <p className="mt-1 text-[13px] leading-6 text-[#475467]">
                            {repo.description || "No description provided."}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(languages.length > 0 ? languages : ["Unknown"]).map((language) => (
                          <span key={`${repo.name}-${language}`} className="rounded-full border border-[#d7deef] bg-white px-3 py-1 text-[11px] font-semibold text-[#34405a]">
                            {language}
                          </span>
                        ))}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-[#667085]">
                        <span className="rounded-full bg-[#eef3fb] px-2.5 py-1">Updated {formatRepoDate(repo.lastUpdated || repo.last_push)}</span>
                        <span className="rounded-full bg-[#eef3fb] px-2.5 py-1">{repo.commitCount || 0} commits</span>
                        <span className="rounded-full bg-[#eef3fb] px-2.5 py-1">{repo.stars} stars</span>
                      </div>
                    </article>
                  )
                  if (!enableRepoLinks) return <div key={repo.name}>{card}</div>
                  return (
                    <a key={repo.name} href={repoUrl} target="_blank" rel="noreferrer" className="block h-full">
                      {card}
                    </a>
                  )
                })}
              </div>
              {remainingProjects.length > 0 ? (
                <div className="mt-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7c88a3]">All Repositories</p>
                      <p className="mt-1 text-[13px] text-[#667085]">Every public project included in this portfolio view.</p>
                    </div>
                    <span className="rounded-full border border-[#d7deef] bg-white px-3 py-1 text-[11px] font-semibold text-[#34405a]">
                      {repos.length} repos
                    </span>
                  </div>
                  <div className="mt-4 max-h-[420px] overflow-y-auto pr-1 grid gap-3 lg:hidden">
                    {remainingProjects.map((repo) => {
                      const repoUrl = repo.htmlUrl || `https://github.com/${profile.username}/${repo.name}`
                      const languages = repoLanguageList(repo)
                      const card = (
                        <article className="rounded-[16px] border border-[#e7ecf4] bg-[#fcfdff] p-4 transition hover:border-[#cfd7e6] hover:shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-[14px] font-semibold text-[#172033]">{repo.name}</p>
                              <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-[#667085]">
                                {repo.description || "No description provided."}
                              </p>
                            </div>
                            <div className="text-right text-[11px] text-[#667085]">
                              <p className="font-semibold text-[#101828]">{repo.commitCount || 0}</p>
                              <p>commits</p>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {(languages.length > 0 ? languages : ["Unknown"]).map((language) => (
                              <span
                                key={`${repo.name}-mobile-${language}`}
                                className="rounded-full border border-[#d7deef] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#475467]"
                              >
                                {language}
                              </span>
                            ))}
                          </div>
                          <div className="mt-3 text-[11px] text-[#667085]">
                            Updated {formatRepoDate(repo.lastUpdated || repo.last_push)}
                          </div>
                        </article>
                      )
                      if (!enableRepoLinks) return <div key={repo.name}>{card}</div>
                      return (
                        <a key={repo.name} href={repoUrl} target="_blank" rel="noreferrer" className="block">
                          {card}
                        </a>
                      )
                    })}
                  </div>
                  <div className="mt-4 hidden max-h-[520px] overflow-y-auto overflow-hidden rounded-[16px] border border-[#e7ecf4] lg:block">
                    <div className="grid grid-cols-[minmax(220px,1.6fr)_minmax(210px,1fr)_110px_130px] gap-0 border-b border-[#e7ecf4] bg-[#f8fbff] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7c88a3]">
                      <div>Repository</div>
                      <div>Languages</div>
                      <div>Commits</div>
                      <div>Updated</div>
                    </div>
                    <div className="divide-y divide-[#edf1f7]">
                      {remainingProjects.map((repo) => {
                        const repoUrl = repo.htmlUrl || `https://github.com/${profile.username}/${repo.name}`
                        const languages = repoLanguageList(repo)
                        const row = (
                          <article className="grid grid-cols-[minmax(220px,1.6fr)_minmax(210px,1fr)_90px_116px] items-center px-4 py-3 transition hover:bg-[#fafcff]">
                            <div className="min-w-0 pr-4">
                              <p className="truncate text-[14px] font-semibold text-[#172033]">{repo.name}</p>
                              <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-[#667085]">
                                {repo.description || "No description provided."}
                              </p>
                            </div>
                            <div className="flex min-w-0 flex-wrap gap-1.5 py-1 pr-4">
                              {(languages.length > 0 ? languages : ["Unknown"]).map((language) => (
                                <span
                                  key={`${repo.name}-row-${language}`}
                                  className="rounded-full border border-[#d7deef] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#475467]"
                                >
                                  {language}
                                </span>
                              ))}
                            </div>
                            <div className="text-[12px] font-medium text-[#475467]">{repo.commitCount || 0}</div>
                            <div className="text-[12px] font-medium text-[#475467]">{formatRepoDate(repo.lastUpdated || repo.last_push)}</div>
                          </article>
                        )
                        if (!enableRepoLinks) return <div key={repo.name}>{row}</div>
                        return (
                          <a key={repo.name} href={repoUrl} target="_blank" rel="noreferrer" className="block">
                            {row}
                          </a>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {jobExperience.length > 0 ? (
            <section className="border-b border-[#edf1f7] px-5 py-5 sm:px-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7c88a3]">Experience</p>
              <div className="mt-4 max-h-[320px] space-y-3 overflow-y-auto pr-1">
                {jobExperience.map((item) => (
                  <article key={`${item.title}-${item.year || ""}`} className="rounded-[14px] border border-[#e7ecf4] bg-[#fcfdff] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[16px] font-semibold text-[#172033]">
                        {item.title}
                        {item.company ? ` - ${item.company}` : ""}
                      </p>
                      <span className="text-[11px] text-[#667085]">
                        {[item.start, item.end].filter(Boolean).join(" - ") || item.year || ""}
                      </span>
                    </div>
                    {item.location ? <p className="mt-1 text-[12px] text-[#667085]">{item.location}</p> : null}
                    {item.description ? <p className="mt-2 text-[13px] leading-6 text-[#475467]">{item.description}</p> : null}
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {educationHistory.length > 0 ? (
            <section className="border-b border-[#edf1f7] px-5 py-5 sm:px-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7c88a3]">Education</p>
              <div className="mt-4 max-h-[280px] grid gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                {educationHistory.map((item) => (
                  <article key={`${item.title}-${item.year || ""}`} className="rounded-[14px] border border-[#e7ecf4] bg-[#fcfdff] p-4">
                    <p className="text-[15px] font-semibold text-[#172033]">{item.title}</p>
                    {item.year ? <p className="mt-1 text-[12px] text-[#667085]">{item.year}</p> : null}
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {showBadges ? (
            <section className="px-5 py-5 sm:px-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7c88a3]">Awards and Recognition</p>
              {visibleBadges.length === 0 ? (
                <p className="mt-3 text-[13px] text-[#6b7390]">No badges yet.</p>
              ) : (
                <div className="mt-4 max-h-[360px] grid gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
                  {visibleBadges.slice(0, 6).map((badge) => (
                    <article key={badge.label} className="rounded-[14px] border border-[#e7ecf4] bg-[#fcfdff] p-4">
                      <p className="text-[14px] font-semibold text-[#1e2637]">{badge.label}</p>
                      <p className="mt-2 text-[12px] leading-5 text-[#667085]">{badge.description}</p>
                      {showBadgeStatus ? (
                        <p className="mt-3 text-[11px] font-semibold text-[#51607d]">
                          {badge.claimed ? "Claimed" : badge.achieved ? "Achieved" : "Locked"}
                        </p>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </section>
          ) : null}
        </main>
      </section>
    </div>
  )
}
