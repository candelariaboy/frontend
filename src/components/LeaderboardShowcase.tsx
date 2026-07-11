import type { CSSProperties } from "react"
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
  height,
}: {
  entry?: LeaderboardEntry
  className: string
  rank: number
  height: string
}) {
  return (
    <div className={`podium__front ${className}`} style={{ height } as CSSProperties}>
      <div className="podium__surface" aria-hidden="true" />
      <div className="podium__number">{rank}</div>
      {entry ? (
        <>
          <div className="podium__image">
            <img src={entry.avatarUrl} alt={entry.username} />
          </div>
          <div className="podium__name">{entry.username}</div>
          <div className="podium__program">{entry.program || "Program not set"}</div>
          <div className="podium__year">{entry.yearLevel || "Year level not set"}</div>
          <div className="podium__xp">{Number(entry.xp || 0).toLocaleString()} XP</div>
        </>
      ) : null}
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
          <PodiumItem entry={podiumEntries[1]} className="podium__left podium__silver" rank={2} height="180px" />
          <PodiumItem entry={podiumEntries[0]} className="podium__center podium__gold" rank={1} height="230px" />
          <PodiumItem entry={podiumEntries[2]} className="podium__right podium__bronze" rank={3} height="170px" />
        </div>
      </div>

      {entries.length === 0 ? <div className="podium-empty-state">{error || "No leaderboard data yet."}</div> : null}
    </section>
  )
}
