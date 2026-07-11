import type { LeaderboardEntry } from "../types"
import "./LeaderboardShowcase.css"

type LeaderboardShowcaseProps = {
  entries: LeaderboardEntry[]
  error: string
}

function getInitials(name: string) {
  const parts = name
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) {
    return "?"
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function PodiumItem({
  entry,
  className,
  rank,
}: {
  entry?: LeaderboardEntry
  className: string
  rank: number
}) {
  const title = entry?.username ?? "No entry"
  const program = entry?.program || "Program not set"
  const year = entry?.yearLevel || "Year level not set"
  const xp = Number(entry?.xp || 0).toLocaleString()
  const initials = getInitials(title)

  return (
    <div className={`podium__front ${className}`}>
      <div className="podium__image">
        {rank === 1 && (
          <svg className="crown" viewBox="0 0 24 24" fill="#F5B93E">
            <path d="M3 8l4 3 5-6 5 6 4-3-2 11H5L3 8z" />
          </svg>
        )}
        <div className="avatar">
          {entry?.avatarUrl ? <img src={entry.avatarUrl} alt={title} /> : initials}
        </div>
      </div>
      <div className="rank-num">{rank}</div>
      <div className="info" style={{ visibility: entry ? "visible" : "hidden" }}>
        <div className="name">{title}</div>
        <div className="meta">{program} · {year}</div>
        <div className="xp">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
          </svg>
          {xp} XP
        </div>
      </div>
    </div>
  )
}

export default function LeaderboardShowcase({ entries, error }: LeaderboardShowcaseProps) {
  const podiumEntries = entries.slice(0, 3)

  return (
    <section className="podium-page">
      <div className="glow"></div>
      
      <div className="header podium-header">
        <div className="eyebrow podium-header__eyebrow">Season leaderboard</div>
        <h1 className="podium-page__title">Top <span>3</span></h1>
        <div className="sub podium-header__sub">// ranked_by: total_xp</div>
        <div className="divider"></div>
      </div>

      <div className="podium-container">
        <div className="sparks">
          <div className="spark" style={{ top: "8%", left: "18%", animationDelay: "0s" }}></div>
          <div className="spark" style={{ top: "28%", left: "78%", animationDelay: "0.6s" }}></div>
          <div className="spark" style={{ top: "55%", left: "8%", animationDelay: "1.2s" }}></div>
          <div className="spark" style={{ top: "65%", left: "88%", animationDelay: "1.8s" }}></div>
          <div className="spark" style={{ top: "12%", left: "48%", animationDelay: "2.4s" }}></div>
        </div>

        <div className="podium">
          <PodiumItem entry={podiumEntries[1]} className="podium__left" rank={2} />
          <PodiumItem entry={podiumEntries[0]} className="podium__center" rank={1} />
          <PodiumItem entry={podiumEntries[2]} className="podium__right" rank={3} />
        </div>
      </div>

      {entries.length === 0 ? <div className="podium-empty-state">{error || "No leaderboard data yet."}</div> : null}
    </section>
  )
}
