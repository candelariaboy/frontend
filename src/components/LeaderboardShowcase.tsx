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
  return (
    <div className={`podium__front ${className}`}>
      <div className="podium__number">{rank}</div>
      {entry && (
        <div className="podium__image">
          <img src={entry.avatarUrl} alt={entry.username} />
          <div className="podium__name">{entry.username}</div>
        </div>
      )}
    </div>
  )
}

export default function LeaderboardShowcase({ entries, error }: LeaderboardShowcaseProps) {
  const podiumEntries = entries.slice(0, 3)

  return (
    <section className="podium-page">
      <h1 className="podium-page__title">Top 3</h1>

      <div className="podium-container">
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
