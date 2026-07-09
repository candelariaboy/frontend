import { useEffect, useState } from "react"
import LeaderboardShowcase from "../components/LeaderboardShowcase"
import { fetchLeaderboard, getStoredAuth } from "../lib/api"
import type { LeaderboardEntry } from "../types"
import NotFoundPage from "./NotFoundPage"

export default function StudentLeaderboardPage() {
  const auth = getStoredAuth()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    if (!auth.token) return

    let cancelled = false

    const loadLeaderboard = () => {
      fetchLeaderboard()
        .then((data) => {
          if (cancelled) return
          setEntries(data)
          setError("")
        })
        .catch(() => {
          if (cancelled) return
          setEntries([])
          setError("No leaderboard data yet.")
        })
    }

    loadLeaderboard()
    const intervalId = window.setInterval(loadLeaderboard, 10000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [auth.token])

  if (!auth.token) {
    return <NotFoundPage message="Sign in first to view the leaderboard." />
  }

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <LeaderboardShowcase entries={entries} error={error} scopeLabel="Student side view" />
      </div>
    </main>
  )
}
