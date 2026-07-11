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
  const title = entry?.username ?? "No entry"
  const program = entry?.program || "Program not set"
  const year = entry?.yearLevel || "Year level not set"
  const xp = Number(entry?.xp || 0).toLocaleString()

  return (
    <div className={`podium__front ${className}`} style={{ height } as CSSProperties}>
      <div className="podium__number">{rank}</div>
      <div className="podium__image">
        {entry ? <img src={entry.avatarUrl} alt={entry.username} /> : <div className="podium__avatar-fallback">?</div>}
      </div>
      <div className="podium__name">{title}</div>
      <div className="podium__program">{program}</div>
      <div className="podium__year">{year}</div>
      <div className="podium__xp">{xp} XP</div>
    </div>
  )
}

export default function LeaderboardShowcase({ entries, error }: LeaderboardShowcaseProps) {
  const podiumEntries = entries.slice(0, 3)

  return (
    <section className="podium-page">
      <div className="podium-panel">
        <div className="podium-header">
          <div className="podium-header__eyebrow">Season leaderboard</div>
          <h1 className="podium-page__title">Top Leaderboards</h1>
          <div className="podium-header__sub">ranked by total XP</div>
        </div>

        <div className="podium-container">
          <div className="podium">
            <PodiumItem entry={podiumEntries[1]} className="podium__left podium__silver" rank={2} height="160px" />
            <PodiumItem entry={podiumEntries[0]} className="podium__center podium__gold" rank={1} height="190px" />
            <PodiumItem entry={podiumEntries[2]} className="podium__right podium__bronze" rank={3} height="140px" />
          </div>
        </div>

        {entries.length === 0 ? <div className="podium-empty-state">{error || "No leaderboard data yet."}</div> : null}
      </div>
    </section>
  )
}
