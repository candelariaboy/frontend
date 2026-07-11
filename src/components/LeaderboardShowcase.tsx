import type { CSSProperties } from "react"
import { motion } from "framer-motion"
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
  delay,
}: {
  entry?: LeaderboardEntry
  className: string
  rank: number
  height: string
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay }}
      whileHover={{ y: -6 }}
      className={`podium__front ${className}`}
      style={{ height } as CSSProperties}
    >
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
    </motion.div>
  )
}

export default function LeaderboardShowcase({ entries, error }: LeaderboardShowcaseProps) {
  const podiumEntries = entries.slice(0, 3)

  return (
    <section className="podium-page">
      <h1 className="podium-page__title">Top 3</h1>

      <div className="podium-container">
        <div className="podium">
          <PodiumItem entry={podiumEntries[1]} className="podium__left" rank={2} height="160px" delay={0.08} />
          <PodiumItem entry={podiumEntries[0]} className="podium__center" rank={1} height="190px" delay={0.02} />
          <PodiumItem entry={podiumEntries[2]} className="podium__right" rank={3} height="140px" delay={0.14} />
        </div>
      </div>

      {entries.length === 0 ? <div className="podium-empty-state">{error || "No leaderboard data yet."}</div> : null}
    </section>
  )
}
