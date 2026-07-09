import { useEffect, useState } from "react"
import AdminFrame from "../components/AdminFrame"
import LeaderboardShowcase from "../components/LeaderboardShowcase"
import { fetchLeaderboard, getStoredAdminAuth } from "../lib/api"
import type { LeaderboardEntry } from "../types"
import NotFoundPage from "./NotFoundPage"

export default function LeaderboardPage() {
  const auth = getStoredAdminAuth()
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
    return <NotFoundPage message="Sign in as admin to view this page." />
  }

  return (
    <AdminFrame>
      <div className="mx-auto max-w-6xl px-4 py-1 sm:px-6 sm:py-2">
        <LeaderboardShowcase entries={entries} error={error} scopeLabel="Admin side view" />
      </div>
    </AdminFrame>
  )
}
