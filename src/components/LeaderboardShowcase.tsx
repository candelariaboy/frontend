import type { LeaderboardEntry } from "../types"
import LeaderboardRow from "./LeaderboardRow"
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
        <div className="avatar">
          {entry?.avatarUrl ? <img src={entry.avatarUrl} alt={title} /> : initials}
        </div>
      </div>
      <div className="rank-num">{rank}</div>
      <div className="info">
        <div className="name">{title}</div>
        <div className="meta">
          {program} - {year}
        </div>
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
  const extraEntries = entries.slice(3)

  return (
    <section className="podium-page leaderboard-carousel">
      <div className="leaderboard-carousel__slide">
        <div className="header podium-header">
          <div className="eyebrow podium-header__eyebrow">Season leaderboard</div>
          <h1 className="podium-page__title">Top 3</h1>
        </div>

        <div className="podium-container">
          <div className="podium">
            <PodiumItem entry={podiumEntries[1]} className="podium__left" rank={2} />
            <PodiumItem entry={podiumEntries[0]} className="podium__center" rank={1} />
            <PodiumItem entry={podiumEntries[2]} className="podium__right" rank={3} />
          </div>
        </div>

        {extraEntries.length > 0 ? (
          <div className="leaderboard-list-section">
            <div className="leaderboard-list-section__header">
              <div>
                <div className="leaderboard-list-section__eyebrow">More rankings</div>
                <h2 className="leaderboard-list-section__title">Rank 4 and below</h2>
              </div>
              <div className="leaderboard-list-section__note">Scroll for more players</div>
            </div>

            <div className="leaderboard-list">
              {extraEntries.map((entry, index) => (
                <LeaderboardRow key={entry.id} entry={entry} rank={index + 4} />
              ))}
            </div>
          </div>
        ) : entries.length === 0 ? (
          <div className="podium-empty-state">{error || "No leaderboard data yet."}</div>
        ) : null}
      </div>
    </section>
  )
}
