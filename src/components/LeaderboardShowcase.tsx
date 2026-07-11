
import type { LeaderboardEntry } from "../types"
import "./LeaderboardShowcase.css"

type LeaderboardShowcaseProps = {
  entries: LeaderboardEntry[]
  error: string
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
      <div className="podium__surface" aria-hidden="true" />
      <div className="podium__image">
        {entry ? <img src={entry.avatarUrl} alt={entry.username} /> : <div className="podium__avatar-fallback">{initials}</div>}
      </div>
      {rank === 1 ? <div className="podium__crown" aria-hidden="true">♛</div> : null}
      <div className="rank-num">{rank}</div>
      <div className="info">
        <div className="name">{title}</div>
        <div className="meta">{program} · {year}</div>
        <div className="xp">{xp} XP</div>
      </div>
    </div>
  )
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

export default function LeaderboardShowcase({ entries, error }: LeaderboardShowcaseProps) {
  const podiumEntries = entries.slice(0, 3)

  return (
    <section className="podium-page">
      <div className="podium-panel">
        <div className="podium-header">
          <div className="podium-header__eyebrow">Season leaderboard</div>
          <h1 className="podium-page__title">
            Top <span>Leaderboards</span>
          </h1>
          <div className="podium-header__sub">// ranked by total_xp</div>
        </div>

        <div className="podium-container">
          <div className="sparks" aria-hidden="true">
            <span className="spark" style={{ top: "8%", left: "18%", animationDelay: "0s" }} />
            <span className="spark" style={{ top: "28%", left: "78%", animationDelay: "0.6s" }} />
            <span className="spark" style={{ top: "55%", left: "8%", animationDelay: "1.2s" }} />
            <span className="spark" style={{ top: "65%", left: "88%", animationDelay: "1.8s" }} />
            <span className="spark" style={{ top: "12%", left: "48%", animationDelay: "2.4s" }} />
          </div>

          <div className="podium">
            <PodiumItem entry={podiumEntries[1]} className="podium__left podium__silver" rank={2} />
            <PodiumItem entry={podiumEntries[0]} className="podium__center podium__gold" rank={1} />
            <PodiumItem entry={podiumEntries[2]} className="podium__right podium__bronze" rank={3} />
          </div>
        </div>

        {entries.length === 0 ? <div className="podium-empty-state">{error || "No leaderboard data yet."}</div> : null}
      </div>
    </section>
  )
}
