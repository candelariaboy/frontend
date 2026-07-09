import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { getStoredAuth, registerUser, setStoredAuth } from "../lib/api"

export default function RegisterPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const storedAuth = getStoredAuth()
  const token = params.get("token") || storedAuth.token || ""
  const username = params.get("username") || storedAuth.username || ""
  const avatar = params.get("avatar") || storedAuth.avatarUrl || ""
  const defaultName = params.get("display_name") || ""

  const [displayName, setDisplayName] = useState(defaultName)
  const [bio, setBio] = useState("")
  const [studentId, setStudentId] = useState("")
  const [program, setProgram] = useState("")
  const [yearLevel, setYearLevel] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const canSubmit = useMemo(
    () =>
      Boolean(
        token &&
          displayName.trim() &&
          studentId.trim() &&
          program.trim() &&
          yearLevel.trim()
      ),
    [displayName, program, studentId, token, yearLevel]
  )

  useEffect(() => {
    if (token && username) {
      setStoredAuth(token, username, avatar || undefined)
    }
  }, [avatar, token, username])

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="rounded-3xl border border-ink/10 bg-white/70 p-8 shadow-soft backdrop-blur">
        <div className="flex items-center gap-4">
          {avatar ? <img src={avatar} alt={username} className="h-16 w-16 rounded-2xl" /> : null}
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-ink/50">Registration</p>
            <h2 className="text-2xl font-semibold">Welcome, @{username}</h2>
            <p className="text-sm text-ink/60">Complete the required fields to finish setup.</p>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          <label className="flex flex-col gap-2 text-sm font-medium">
            Display name *
            <input
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value)
                if (error) setError("")
              }}
              className="rounded-2xl border border-ink/10 bg-paper/80 px-4 py-3 text-sm"
              placeholder="Your name"
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Bio
            <textarea
              value={bio}
              onChange={(event) => {
                setBio(event.target.value)
                if (error) setError("")
              }}
              className="min-h-[120px] resize-none rounded-2xl border border-ink/10 bg-paper/80 px-4 py-3 text-sm"
              placeholder="Share a short bio"
            />
          </label>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm font-medium">
              Student ID *
              <input
                value={studentId}
                onChange={(event) => {
                  setStudentId(event.target.value)
                  if (error) setError("")
                }}
                className="rounded-2xl border border-ink/10 bg-paper/80 px-4 py-3 text-sm"
                placeholder="e.g. 2024-00123"
                required
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Program *
              <select
                value={program}
                onChange={(event) => {
                  setProgram(event.target.value)
                  if (error) setError("")
                }}
                className="rounded-2xl border border-ink/10 bg-paper/80 px-4 py-3 text-sm"
                required
              >
                <option value="">Select program</option>
                <option value="BSCS">BSCS</option>
                <option value="BSIT">BSIT</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Year Level *
              <select
                value={yearLevel}
                onChange={(event) => {
                  setYearLevel(event.target.value)
                  if (error) setError("")
                }}
                className="rounded-2xl border border-ink/10 bg-paper/80 px-4 py-3 text-sm"
                required
              >
                <option value="">Select year level</option>
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
              </select>
            </label>
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            disabled={!canSubmit || loading}
            onClick={async () => {
              if (!canSubmit) {
                setError("Please complete all required fields before continuing.")
                return
              }
              try {
                setLoading(true)
                setError("")
                await registerUser(token, {
                  display_name: displayName.trim(),
                  bio: bio.trim(),
                  student_id: studentId.trim(),
                  program: program.trim(),
                  year_level: yearLevel.trim(),
                })
                navigate(`/dashboard?token=${token}`)
              } catch (err) {
                const message = err instanceof Error ? err.message : "Failed to complete registration."
                setError(message)
              } finally {
                setLoading(false)
              }
            }}
            className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper shadow-glow transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Finish setup
          </button>
        </div>
      </div>
    </div>
  )
}
