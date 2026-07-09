import type { LeaderboardEntry } from "../types"

type LeaderboardRowProps = {
  entry: LeaderboardEntry
  rank: number
}

function MedalIcon({ className = "", rank }: { className?: string; rank: number }) {
  const palette =
    rank === 1
      ? {
          outerTop: "#FFF7CC",
          outerBottom: "#F2C94C",
          innerTop: "#FFFDF3",
          innerBottom: "#E7B416",
          ribbonLeft: "#F59E0B",
          ribbonRight: "#B45309",
          stroke: "#D4A017",
        }
      : rank === 2
        ? {
            outerTop: "#F8FAFC",
            outerBottom: "#D0D5DD",
            innerTop: "#FFFFFF",
            innerBottom: "#98A2B3",
            ribbonLeft: "#94A3B8",
            ribbonRight: "#64748B",
            stroke: "#98A2B3",
          }
        : {
            outerTop: "#FDE7D3",
            outerBottom: "#D6A26E",
            innerTop: "#FFF7ED",
            innerBottom: "#C97316",
            ribbonLeft: "#C2410C",
            ribbonRight: "#7C2D12",
            stroke: "#C97316",
          }

  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className} fill="none">
      <defs>
        <linearGradient id={`medal-ribbon-left-${rank}`} x1="18" y1="5" x2="30" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={palette.ribbonLeft} />
          <stop offset="1" stopColor={palette.ribbonRight} />
        </linearGradient>
        <linearGradient id={`medal-ribbon-right-${rank}`} x1="34" y1="5" x2="46" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={palette.ribbonLeft} />
          <stop offset="1" stopColor={palette.ribbonRight} />
        </linearGradient>
        <linearGradient id={`medal-outer-${rank}`} x1="14" y1="12" x2="50" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={palette.outerTop} />
          <stop offset="1" stopColor={palette.outerBottom} />
        </linearGradient>
        <linearGradient id={`medal-inner-${rank}`} x1="22" y1="20" x2="42" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={palette.innerTop} />
          <stop offset="1" stopColor={palette.innerBottom} />
        </linearGradient>
      </defs>

      <path d="M19 6h10l-3 17h-7L19 6Z" fill={`url(#medal-ribbon-left-${rank})`} />
      <path d="M35 6h10l-1 17h-7L35 6Z" fill={`url(#medal-ribbon-right-${rank})`} />
      <circle cx="32" cy="39" r="20" fill={`url(#medal-outer-${rank})`} stroke={palette.stroke} strokeWidth="2.2" />
      <circle cx="32" cy="39" r="14" fill={`url(#medal-inner-${rank})`} />
      <ellipse cx="26" cy="29" rx="8" ry="4.5" fill="#FFFFFF" opacity="0.28" transform="rotate(-24 26 29)" />
      <circle cx="32" cy="39" r="10.5" stroke="rgba(255,255,255,0.42)" strokeWidth="1.2" />
    </svg>
  )
}

export default function LeaderboardRow({ entry, rank }: LeaderboardRowProps) {
  const academicMeta = [entry.program, entry.yearLevel].filter(Boolean).join(" - ")
  const totalRunwayXp = Number.isFinite(entry.runwayXp) ? entry.runwayXp : entry.xp
  const remainingXp = Number.isFinite(entry.runwayRemainingXp) ? entry.runwayRemainingXp : 0
  const podiumTheme =
    rank === 1
      ? {
          ring: "border-[#F2C94C]/70 bg-[linear-gradient(135deg,rgba(255,245,200,0.96),rgba(244,200,76,0.36))] text-[#6B4F00]",
          card: "border-[#F2C94C]/60 bg-[linear-gradient(135deg,rgba(255,250,220,0.95),rgba(255,255,255,0.82))] shadow-[0_18px_40px_rgba(242,201,76,0.18)]",
        }
      : rank === 2
        ? {
            ring: "border-[#D0D5DD] bg-[linear-gradient(135deg,rgba(249,250,251,0.96),rgba(208,213,221,0.46))] text-[#344054]",
            card: "border-[#D0D5DD] bg-[linear-gradient(135deg,rgba(249,250,251,0.98),rgba(255,255,255,0.82))] shadow-[0_18px_36px_rgba(152,162,179,0.16)]",
          }
        : rank === 3
          ? {
              ring: "border-[#D6A26E]/80 bg-[linear-gradient(135deg,rgba(255,243,232,0.98),rgba(214,162,110,0.34))] text-[#7C2D12]",
              card: "border-[#D6A26E]/70 bg-[linear-gradient(135deg,rgba(255,247,237,0.98),rgba(255,255,255,0.82))] shadow-[0_18px_36px_rgba(180,83,9,0.14)]",
            }
          : null

  const cardClassName = podiumTheme
    ? `flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${podiumTheme.card}`
    : "flex flex-col gap-4 rounded-2xl border border-ink/10 bg-white/70 p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between"
  const rankBadgeClassName = podiumTheme
    ? `relative flex h-12 w-12 items-center justify-center rounded-full border ${podiumTheme.ring}`
    : "flex h-10 w-10 items-center justify-center rounded-full bg-ink text-paper"

  return (
    <div className={cardClassName}>
      <div className="flex items-center gap-4">
        <div className={rankBadgeClassName}>
          {podiumTheme ? <MedalIcon rank={rank} className="absolute -right-2 -top-4 h-9 w-9" /> : null}
          <span className="text-sm font-semibold">#{rank}</span>
        </div>
        <img src={entry.avatarUrl} alt={entry.username} className="h-12 w-12 rounded-2xl" />
        <div>
          <p className="font-semibold">{entry.username}</p>
          <p className="text-xs text-ink/60">
            {academicMeta || "Program and year level not set"}
          </p>
          <p className="text-xs text-ink/50">Level {entry.level}</p>
        </div>
      </div>
      <div className="text-left sm:text-right">
        <p className="text-[11px] uppercase tracking-[0.16em] text-ink/50">XP Runway</p>
        <p className="text-[22px] font-semibold leading-none text-ink">{totalRunwayXp} XP</p>
        <p className="text-xs text-ink/60">{remainingXp} XP to level up</p>
      </div>
    </div>
  )
}
