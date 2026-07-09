import { useEffect, useMemo, useState } from "react"
import { createMyGoal, deleteMyGoal, fetchMyGoals, getStoredAuth, updateMyGoal } from "../lib/api"
import type { StudentGoal } from "../types"

function statusStyle(status: string) {
  const key = (status || "").toLowerCase()
  if (key === "completed") return "bg-[#E8F4F0] text-[#0F6E56]"
  if (key === "paused") return "bg-[#EEF1F7] text-[#5B657E]"
  return "bg-[#FFF4E8] text-[#BA7517]"
}

function pct(goal: StudentGoal) {
  const target = Number(goal.target_value || 0)
  const current = Number(goal.current_value || 0)
  if (target <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((current / target) * 100)))
}

export default function GoalsPage() {
  const auth = getStoredAuth()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rows, setRows] = useState<StudentGoal[]>([])
  const [toast, setToast] = useState("")

  const [title, setTitle] = useState("")
  const [targetValue, setTargetValue] = useState("")
  const [unit, setUnit] = useState("")
  const [targetDate, setTargetDate] = useState("")
  const [notes, setNotes] = useState("")

  const load = async () => {
    if (!auth.token) return
    setLoading(true)
    try {
      const data = await fetchMyGoals(auth.token)
      setRows(Array.isArray(data) ? (data as StudentGoal[]) : [])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!auth.token) return
    void load()
  }, [auth.token])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(""), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  const counts = useMemo(() => {
    const total = rows.length
    const completed = rows.filter((item) => item.status === "completed").length
    const paused = rows.filter((item) => item.status === "paused").length
    return { total, completed, active: Math.max(0, total - completed - paused), paused }
  }, [rows])

  if (!auth.token) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-[#DDE1EB] bg-white p-4 text-[13px] text-[#4B5368]">
          Sign in with GitHub first to manage goals.
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8">
      {toast ? (
        <div className="fixed right-5 top-5 z-50 rounded-[12px] border border-[#DDE1EB] bg-white px-4 py-2 text-[12px] text-[#2A3145]">
          {toast}
        </div>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.08em] text-[#6D7489]">Goals</p>
          <h1 className="text-[24px] font-medium text-[#1E2538]">My Goals</h1>
        </div>
        <button
          type="button"
          className="rounded-[8px] border border-[#D1D6E3] px-3 py-1.5 text-[11px] text-[#2E3550]"
          onClick={() => void load()}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <section className="mt-4 rounded-[12px] border border-[#DDE1EB] bg-white p-4">
        <h3 className="text-[15px] font-medium text-[#1E2538]">Add Goal</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="rounded-[8px] border border-[#D1D6E3] px-3 py-2 text-[12px] outline-none"
            placeholder="Goal title"
          />
          <input
            type="number"
            min={0}
            value={targetValue}
            onChange={(event) => setTargetValue(event.target.value)}
            className="rounded-[8px] border border-[#D1D6E3] px-3 py-2 text-[12px] outline-none"
            placeholder="Target value (optional)"
          />
          <input
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            className="rounded-[8px] border border-[#D1D6E3] px-3 py-2 text-[12px] outline-none"
            placeholder="Unit (e.g. certificates, projects, %)"
          />
          <input
            type="date"
            value={targetDate}
            onChange={(event) => setTargetDate(event.target.value)}
            className="rounded-[8px] border border-[#D1D6E3] px-3 py-2 text-[12px] outline-none"
          />
        </div>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="mt-2 w-full rounded-[8px] border border-[#D1D6E3] px-3 py-2 text-[12px] outline-none"
          rows={2}
          placeholder="Notes (optional)"
        />
        <button
          type="button"
          disabled={saving}
          className="mt-3 rounded-[8px] bg-[#534AB7] px-3 py-1.5 text-[11px] text-white disabled:opacity-60"
          onClick={async () => {
            if (!title.trim()) {
              setToast("Goal title is required.")
              return
            }
            setSaving(true)
            try {
              const payload = {
                title: title.trim(),
                target_value: targetValue.trim() ? Number(targetValue) : null,
                current_value: 0,
                unit: unit.trim() || null,
                target_date: targetDate || null,
                notes: notes.trim() || null,
              }
              const created = (await createMyGoal(auth.token, payload)) as StudentGoal
              setRows((prev) => [created, ...prev])
              setTitle("")
              setTargetValue("")
              setUnit("")
              setTargetDate("")
              setNotes("")
              setToast("Goal added.")
            } catch {
              setToast("Failed to add goal.")
            } finally {
              setSaving(false)
            }
          }}
        >
          {saving ? "Saving..." : "Add goal"}
        </button>
      </section>

      <section className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-[8px] bg-[#EFF2F8] p-3">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#6D7489]">Total</p>
          <p className="mt-1 text-[22px] font-medium text-[#1E2538]">{counts.total}</p>
        </div>
        <div className="rounded-[8px] bg-[#EFF2F8] p-3">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#6D7489]">Active</p>
          <p className="mt-1 text-[22px] font-medium text-[#1E2538]">{counts.active}</p>
        </div>
        <div className="rounded-[8px] bg-[#EFF2F8] p-3">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#6D7489]">Completed</p>
          <p className="mt-1 text-[22px] font-medium text-[#1E2538]">{counts.completed}</p>
        </div>
        <div className="rounded-[8px] bg-[#EFF2F8] p-3">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#6D7489]">Paused</p>
          <p className="mt-1 text-[22px] font-medium text-[#1E2538]">{counts.paused}</p>
        </div>
      </section>

      <section className="mt-4 rounded-[12px] border border-[#DDE1EB] bg-white p-4">
        <h3 className="text-[15px] font-medium text-[#1E2538]">Goal List</h3>
        <div className="mt-3 space-y-2">
          {rows.map((row) => {
            const progress = pct(row)
            return (
              <div key={row.id} className="rounded-[10px] border border-[#E4E8F2] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[13px] font-medium text-[#1E2538]">{row.title}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${statusStyle(row.status)}`}>
                    {row.status}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded bg-[#EEF1F7]">
                  <div className="h-full rounded bg-[#534AB7]" style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-[#6A7288]">
                  {Number(row.current_value || 0)}
                  {row.target_value ? ` / ${row.target_value}` : ""} {row.unit || ""} {row.target_date ? ` | Target: ${row.target_date}` : ""}
                </p>
                {row.notes ? <p className="mt-1 text-[11px] text-[#6A7288]">{row.notes}</p> : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-[8px] border border-[#D1D6E3] px-2 py-1 text-[11px] text-[#2E3550]"
                    onClick={async () => {
                      const next = Number(row.current_value || 0) + 1
                      try {
                        const updated = (await updateMyGoal(auth.token, row.id, {
                          current_value: next,
                          status: row.target_value && next >= row.target_value ? "completed" : row.status,
                        })) as StudentGoal
                        setRows((prev) => prev.map((item) => (item.id === row.id ? updated : item)))
                      } catch {
                        setToast("Failed to update progress.")
                      }
                    }}
                  >
                    +1 progress
                  </button>
                  <button
                    type="button"
                    className="rounded-[8px] border border-[#D1D6E3] px-2 py-1 text-[11px] text-[#2E3550]"
                    onClick={async () => {
                      try {
                        const updated = (await updateMyGoal(auth.token, row.id, {
                          status: row.status === "paused" ? "active" : "paused",
                        })) as StudentGoal
                        setRows((prev) => prev.map((item) => (item.id === row.id ? updated : item)))
                      } catch {
                        setToast("Failed to update status.")
                      }
                    }}
                  >
                    {row.status === "paused" ? "Resume" : "Pause"}
                  </button>
                  <button
                    type="button"
                    className="rounded-[8px] border border-[#D1D6E3] px-2 py-1 text-[11px] text-[#2E3550]"
                    onClick={async () => {
                      try {
                        const updated = (await updateMyGoal(auth.token, row.id, {
                          status: "completed",
                        })) as StudentGoal
                        setRows((prev) => prev.map((item) => (item.id === row.id ? updated : item)))
                      } catch {
                        setToast("Failed to mark completed.")
                      }
                    }}
                  >
                    Complete
                  </button>
                  <button
                    type="button"
                    className="rounded-[8px] border border-[#E4B6B6] px-2 py-1 text-[11px] text-[#A32D2D]"
                    onClick={async () => {
                      try {
                        await deleteMyGoal(auth.token, row.id)
                        setRows((prev) => prev.filter((item) => item.id !== row.id))
                      } catch {
                        setToast("Failed to delete goal.")
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        {!loading && rows.length === 0 ? (
          <p className="py-4 text-[12px] text-[#6A7288]">No goals yet. Add your first goal above.</p>
        ) : null}
      </section>
    </div>
  )
}

