import type { CSSProperties } from "react"
import { motion } from "framer-motion"
import type { LeaderboardEntry } from "../types"
import "./LeaderboardShowcase.css"

type LeaderboardShowcaseProps = {
  entries: LeaderboardEntry[]
  error: string
  scopeLabel: string
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
  const restEntries = entries.slice(3)
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

      {restEntries.length > 0 ? (
        <div className="leaderboard-rest">
          <div className="leaderboard-rest-header">
            <div>
              <p className="leaderboard-rest-title">More rankings</p>
              <p className="leaderboard-rest-subtitle">The podium stays in front while the rest remain visible below.</p>
            </div>
            <div className="leaderboard-rest-count">{restEntries.length} more</div>
          </div>

          <div className="leaderboard-rest-list">
            {restEntries.map((entry, index) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.35, delay: index * 0.03 }}
                className="leaderboard-rest-item"
              >
                <span className="leaderboard-rest-rank">#{index + 4}</span>
                <img src={entry.avatarUrl} alt={entry.username} className="leaderboard-rest-avatar" />
                <div className="leaderboard-rest-copy">
                  <p className="leaderboard-rest-name">{entry.username}</p>
                  <p className="leaderboard-rest-meta">{entry.program || "Program not set"}</p>
                </div>
                <div className="leaderboard-rest-xp">{Number(entry.xp || 0).toLocaleString()} XP</div>
              </motion.div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
