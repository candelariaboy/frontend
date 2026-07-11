import type { CSSProperties } from "react"
import { motion } from "framer-motion"
import type { LeaderboardEntry } from "../types"
import "./LeaderboardShowcase.css"

type LeaderboardShowcaseProps = {
  entries: LeaderboardEntry[]
  error: string
}

function PodiumBlock({
  rank,
  className,
  style,
  entry,
}: {
  rank: number
  className: string
  style: CSSProperties
  entry?: LeaderboardEntry
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      whileHover={{ y: -8 }}
      className={`podium__front ${className}`}
      style={style}
    >
      <div className="podium__number">{rank}</div>
      {entry ? (
        <div className="podium__label" title={entry.username}>
          {entry.username}
        </div>
      ) : null}
    </motion.div>
  )
}

export default function LeaderboardShowcase({ entries, error }: LeaderboardShowcaseProps) {
  const podiumEntries = entries.slice(0, 3)
  const secondPlace = podiumEntries[1]
  const firstPlace = podiumEntries[0]
  const thirdPlace = podiumEntries[2]

  return (
    <section className="podium-page">
      <h1 className="podium-page__title">Top 3</h1>

      <div className="podium-container">
        <div className="podium">
          <PodiumBlock
            rank={2}
            className="podium__left"
            style={{ height: "160px" }}
            entry={secondPlace}
          />
          <PodiumBlock
            rank={1}
            className="podium__center"
            style={{ height: "190px" }}
            entry={firstPlace}
          />
          <PodiumBlock
            rank={3}
            className="podium__right"
            style={{ height: "140px" }}
            entry={thirdPlace}
          />
        </div>
      </div>

      {entries.length === 0 ? <div className="podium-empty-state">{error || "No leaderboard data yet."}</div> : null}
    </section>
  )
}
