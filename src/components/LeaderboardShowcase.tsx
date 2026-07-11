import type { CSSProperties } from "react"
import { motion } from "framer-motion"
import type { LeaderboardEntry } from "../types"
import "./LeaderboardShowcase.css"

type LeaderboardShowcaseProps = {
  entries: LeaderboardEntry[]
  error: string
  scopeLabel: string
}

function BadgeStack({ badges, rank }: { badges: LeaderboardEntry["badgeStack"]; rank: number }) {
  const maxVisible = rank === 1 ? 7 : rank === 2 ? 5 : 4
  const visibleBadges = badges.slice(0, maxVisible)
  return (
    <div className="podium-badge-stack" aria-label={`${visibleBadges.length} badges`}>
      {visibleBadges.map((badge, index) => (
        <span key={`${badge.label}-${index}`} className={`podium-badge podium-badge-${rank}`}>
          {badge.medalIcon || badge.label.slice(0, 1).toUpperCase()}
        </span>
      ))}
    </div>
  )
}

function PodiumCard({
  entry,
  rank,
  accent,
  heightClass,
  blockHeight,
  delay,
}: {
  entry: LeaderboardEntry
  rank: number
  accent: "gold" | "silver" | "bronze"
  heightClass: string
  blockHeight: string
  delay: number
}) {
  const accentClass =
    accent === "gold"
      ? "podium-gold"
      : accent === "silver"
        ? "podium-silver"
        : "podium-bronze"

  const blockStyle = {
    "--podium-height": blockHeight,
  } as CSSProperties

  return (
    <div className={`podium-shell ${heightClass}`}>
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay }}
        whileHover={{ y: -10, rotateX: 2 }}
        className="podium-card"
      >
        <div className="podium-orbit" aria-hidden="true" />
        <div className="podium-avatar">
          <img src={entry.avatarUrl} alt={entry.username} className="podium-avatar-image" />
        </div>

        <BadgeStack badges={entry.badgeStack} rank={rank} />

        <div className={`podium-block ${accentClass}`} style={blockStyle}>
          <div className="podium-top" aria-hidden="true" />
          <div className="podium-front" aria-hidden="true" />

          <div className="podium-copy">
            <div className="podium-rank">{rank}</div>
            <h3 className="podium-username">{entry.username}</h3>
            <p className="podium-meta">{entry.program || "Program not set"}</p>
            <p className="podium-meta">{entry.yearLevel || "Year level not set"}</p>
            <p className="podium-xp">{Number(entry.xp || 0).toLocaleString()} XP</p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default function LeaderboardShowcase({ entries, error, scopeLabel }: LeaderboardShowcaseProps) {
  const podiumEntries = entries.slice(0, 3)
  const secondPlace = podiumEntries[1]
  const firstPlace = podiumEntries[0]
  const thirdPlace = podiumEntries[2]

  return (
    <section className="leaderboard-stage">
      <div className="leaderboard-header">
        <div>
          <p className="leaderboard-kicker">{scopeLabel}</p>
          <h1 className="leaderboard-title">Top 3</h1>
          <p className="leaderboard-description">
            Podium view of the highest ranked students, styled after the 3D reference you shared.
          </p>
        </div>

        <div className="leaderboard-chip-list">
          <span className="leaderboard-chip">Live ranking</span>
          <span className="leaderboard-chip">Gold / Silver / Bronze</span>
          <span className="leaderboard-chip">{entries.length} students</span>
        </div>
      </div>

      <div className="podium-scene">
        <div className="podium-grid">
          {secondPlace ? (
            <PodiumCard
              entry={secondPlace}
              rank={2}
              accent="silver"
              heightClass="podium-card-silver"
              blockHeight="178px"
              delay={0.12}
            />
          ) : (
            <div className="podium-empty" />
          )}

          {firstPlace ? (
            <PodiumCard
              entry={firstPlace}
              rank={1}
              accent="gold"
              heightClass="podium-card-gold"
              blockHeight="226px"
              delay={0.06}
            />
          ) : (
            <div className="podium-empty" />
          )}

          {thirdPlace ? (
            <PodiumCard
              entry={thirdPlace}
              rank={3}
              accent="bronze"
              heightClass="podium-card-bronze"
              blockHeight="160px"
              delay={0.18}
            />
          ) : (
            <div className="podium-empty" />
          )}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="leaderboard-empty">{error || "No leaderboard data yet."}</div>
      ) : null}
    </section>
  )
}
