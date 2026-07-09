import { motion } from "framer-motion"
import type { LeaderboardEntry } from "../types"
import LeaderboardRow from "./LeaderboardRow"

type LeaderboardShowcaseProps = {
  entries: LeaderboardEntry[]
  error: string
  scopeLabel: string
}

function PodiumCard({
  entry,
  rank,
  accent,
  className = "",
}: {
  entry: LeaderboardEntry
  rank: number
  accent: "gold" | "silver" | "bronze"
  className?: string
}) {
  const theme =
    accent === "gold"
      ? {
          block: "bg-[linear-gradient(180deg,#f5d96a_0%,#c89a1b_100%)]",
          face: "bg-[linear-gradient(180deg,#fff2b4_0%,#e4b93c_100%)]",
          edge: "bg-[linear-gradient(180deg,rgba(255,255,255,0.28),rgba(0,0,0,0.16))]",
          glow: "shadow-[0_26px_60px_rgba(245,217,106,0.25)]",
        }
      : accent === "silver"
        ? {
            block: "bg-[linear-gradient(180deg,#dce3ee_0%,#93a0b5_100%)]",
            face: "bg-[linear-gradient(180deg,#f7f9fc_0%,#c7d0de_100%)]",
            edge: "bg-[linear-gradient(180deg,rgba(255,255,255,0.3),rgba(0,0,0,0.12))]",
            glow: "shadow-[0_24px_50px_rgba(148,163,184,0.2)]",
          }
        : {
            block: "bg-[linear-gradient(180deg,#efc08f_0%,#b56b2c_100%)]",
            face: "bg-[linear-gradient(180deg,#ffe6cc_0%,#db8f47_100%)]",
            edge: "bg-[linear-gradient(180deg,rgba(255,255,255,0.28),rgba(0,0,0,0.14))]",
            glow: "shadow-[0_24px_50px_rgba(181,107,44,0.22)]",
          }

  return (
    <motion.div
      whileHover={{ y: -8, rotateX: 2 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className={`group relative flex flex-col items-center gap-3 text-center ${className}`}
    >
      <div className="relative flex h-24 w-24 items-center justify-center">
        <div className={`absolute inset-0 rounded-full bg-white/10 blur-2xl ${theme.glow}`} />
        <img
          src={entry.avatarUrl}
          alt={entry.username}
          className="relative z-10 h-24 w-24 rounded-full border border-white/30 object-cover shadow-[0_16px_30px_rgba(0,0,0,0.28)]"
        />
      </div>

      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-white/55">Rank #{rank}</p>
        <h3 className="text-lg font-semibold text-white">{entry.username}</h3>
        <p className="text-xs text-white/60">Level {entry.level}</p>
      </div>

      <div className="relative mt-3 flex w-full items-end justify-center" style={{ perspective: "800px" }}>
        <div
          className={`relative flex w-full flex-col items-center rounded-t-[26px] border border-white/10 px-4 pb-5 pt-4 backdrop-blur-sm ${theme.block} ${theme.glow}`}
          style={{
            minHeight: rank === 1 ? "210px" : rank === 2 ? "178px" : "156px",
            transformStyle: "preserve-3d",
            transform: "rotateX(-38deg)",
            transformOrigin: "top center",
          }}
        >
          <div
            className={`absolute inset-x-0 bottom-0 rounded-t-[26px] ${theme.face}`}
            style={{
              height: "72%",
              transform: "translateZ(-1px)",
            }}
          />
          <div
            className={`absolute inset-x-0 top-0 h-5 rounded-t-[26px] ${theme.edge}`}
            style={{ transform: "translateZ(1px)" }}
          />
          <div className="relative z-10 flex flex-col items-center gap-2 pt-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/35 bg-white/15 text-3xl font-black text-white shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
              {rank}
            </div>
            <p className="max-w-[12rem] text-sm font-semibold leading-tight text-white/92">
              {entry.program || "Program not set"}
            </p>
            <p className="text-xs text-white/72">{entry.yearLevel || "Year level not set"}</p>
            <div className="mt-2 rounded-full border border-white/18 bg-black/14 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/85">
              {Number(entry.xp || 0)} XP
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default function LeaderboardShowcase({ entries, error, scopeLabel }: LeaderboardShowcaseProps) {
  const podiumEntries = entries.slice(0, 3)
  const restEntries = entries.slice(3)
  const topThree = {
    second: podiumEntries[1],
    first: podiumEntries[0],
    third: podiumEntries[2],
  }

  return (
    <section className="overflow-hidden rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(80,100,180,0.35),transparent_28%),linear-gradient(180deg,#10131a_0%,#151a25_45%,#0c0f15_100%)] p-4 shadow-[0_30px_90px_rgba(10,14,20,0.38)] sm:p-6 lg:p-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-cyan-200/80">{scopeLabel}</p>
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
            Podium leaderboard
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
            Top builders are shown on a 3D podium, with the full ranked list below. The live order updates as XP changes.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-slate-300">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Live XP ranking</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Refreshes every 10s</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Student + admin views</span>
        </div>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_1.28fr_1fr] lg:items-end">
        {topThree.second ? (
          <PodiumCard entry={topThree.second} rank={2} accent="silver" className="lg:translate-y-6" />
        ) : (
          <div className="hidden lg:block" />
        )}
        {topThree.first ? (
          <PodiumCard entry={topThree.first} rank={1} accent="gold" className="lg:scale-[1.04]" />
        ) : (
          <div className="hidden lg:block" />
        )}
        {topThree.third ? (
          <PodiumCard entry={topThree.third} rank={3} accent="bronze" className="lg:translate-y-10" />
        ) : (
          <div className="hidden lg:block" />
        )}
      </div>

      <div className="mt-8 flex items-center justify-between gap-3 border-t border-white/10 pt-5">
        <div>
          <p className="text-sm font-semibold text-white">Full ranking</p>
          <p className="text-xs text-slate-400">
            The podium shows the top 3. The list below keeps everyone visible.
          </p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-300">
          {entries.length} builders
        </div>
      </div>

      <div className="mt-5">
        {entries.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-6 text-sm text-slate-300">
            {error || "No leaderboard data yet."}
          </div>
        ) : (
          <div className="space-y-3">
            {restEntries.length === 0 ? null : restEntries.map((entry, index) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.04 }}
              >
                <LeaderboardRow entry={entry} rank={index + 4} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
