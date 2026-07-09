import { useEffect, useState } from "react"
import AdminFrame from "../components/AdminFrame"
import { fetchAdminEvaluationMetrics, getStoredAdminAuth, signOutAdmin } from "../lib/api"
import type { AdminEvaluationMetrics } from "../types"

function Metric({
  label,
  value,
  note,
}: {
  label: string
  value: string
  note?: string
}) {
  return (
    <article className="rounded-2xl border border-ink/10 bg-white p-4">
      <p className="text-xs text-ink/50">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {note ? <p className="mt-1 text-[11px] leading-5 text-ink/50">{note}</p> : null}
    </article>
  )
}

function formatScore(value?: number | null, digits = 3) {
  return typeof value === "number" ? value.toFixed(digits) : "N/A"
}

function scoreBand(value: number | null | undefined, bands: Array<[number, string]>) {
  if (typeof value !== "number") return "N/A"
  const matched = bands.find(([threshold]) => value >= threshold)
  return matched ? matched[1] : "low"
}

function buildQualitySummary(evaluation: AdminEvaluationMetrics | null) {
  if (!evaluation) return "Quality snapshot unavailable."

  const rougeBand = (value?: number | null) =>
    scoreBand(value, [
      [0.8, "excellent"],
      [0.65, "strong"],
      [0.5, "good"],
      [0.35, "fair"],
    ])
  const bertBand = rougeBand
  const bleuBand = (value?: number | null) =>
    scoreBand(value, [
      [40, "excellent"],
      [30, "strong"],
      [20, "good"],
      [10, "fair"],
    ])

  const rouge1 = evaluation.rouge1
  const rouge2 = evaluation.rouge2
  const rougeL = evaluation.rougeL
  const bleu = evaluation.bleu
  const bertF1 = evaluation.bertscore_f1

  const summary = [
    `ROUGE-1 ${formatScore(rouge1)} (${rougeBand(rouge1)}): unigram overlap`,
    `ROUGE-2 ${formatScore(rouge2)} (${rougeBand(rouge2)}): bigram overlap`,
    `ROUGE-L ${formatScore(rougeL)} (${rougeBand(rougeL)}): sequence order match`,
    `BLEU ${formatScore(bleu, 2)} (${bleuBand(bleu)}): n-gram precision`,
    `BERTScore F1 ${formatScore(bertF1)} (${bertBand(bertF1)}): semantic similarity`,
  ]

  const semanticStrength = bertBand(bertF1)
  const lexicalStrength = rougeBand(rouge1)
  const overall =
    semanticStrength === "excellent" || semanticStrength === "strong"
      ? `Overall: strong semantic similarity with ${lexicalStrength} lexical overlap.`
      : `Overall: ${lexicalStrength} lexical overlap with ${semanticStrength} semantic similarity.`

  return `Quality snapshot: ${summary.join("; ")}. ${overall}`
}

function buildSimilarityChartData(evaluation: AdminEvaluationMetrics | null) {
  return [
    {
      metric: "ROUGE-1",
      score: evaluation?.rouge1 ?? 0,
      actual: formatScore(evaluation?.rouge1),
      note: "ROUGE-1",
    },
    {
      metric: "ROUGE-2",
      score: evaluation?.rouge2 ?? 0,
      actual: formatScore(evaluation?.rouge2),
      note: "ROUGE-2",
    },
    {
      metric: "ROUGE-L",
      score: evaluation?.rougeL ?? 0,
      actual: formatScore(evaluation?.rougeL),
      note: "ROUGE-L",
    },
    {
      metric: "BLEU",
      score: (evaluation?.bleu ?? 0) / 100,
      actual: formatScore(evaluation?.bleu, 2),
      note: "BLEU",
    },
    {
      metric: "BERT P",
      score: evaluation?.bertscore_precision ?? 0,
      actual: formatScore(evaluation?.bertscore_precision),
      note: "BERTScore Precision",
    },
    {
      metric: "BERT R",
      score: evaluation?.bertscore_recall ?? 0,
      actual: formatScore(evaluation?.bertscore_recall),
      note: "BERTScore Recall",
    },
    {
      metric: "BERT F1",
      score: evaluation?.bertscore_f1 ?? 0,
      actual: formatScore(evaluation?.bertscore_f1),
      note: "BERTScore F1",
    },
  ]
}

function ComboMetricChart({ evaluation }: { evaluation: AdminEvaluationMetrics | null }) {
  const rows = buildSimilarityChartData(evaluation)
  const [hoveredMetric, setHoveredMetric] = useState<string | null>(null)
  const axisTicks = [0, 0.2, 0.4, 0.6, 0.8, 1]
  const chartHeight = 220
  const chartWidth = 760
  const leftPad = 46
  const rightPad = 18
  const topPad = 14
  const bottomPad = 34
  const innerWidth = chartWidth - leftPad - rightPad
  const innerHeight = chartHeight - topPad - bottomPad
  const slotWidth = innerWidth / rows.length
  const barWidth = Math.min(44, slotWidth * 0.42)

  return (
    <div className="rounded-xl border border-ink/10 bg-white p-4">
      <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 overflow-x-auto">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-[260px] w-full min-w-[760px]">
          {axisTicks.map((tick) => {
            const y = topPad + innerHeight - tick * innerHeight
            return (
              <g key={tick}>
                <line
                  x1={leftPad}
                  y1={y}
                  x2={chartWidth - rightPad}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="4 4"
                />
                <text
                  x={leftPad - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="#64748b"
                >
                  {tick.toFixed(1)}
                </text>
              </g>
            )
          })}

          <line x1={leftPad} y1={topPad} x2={leftPad} y2={topPad + innerHeight} stroke="#cbd5e1" />
          <line x1={leftPad} y1={topPad + innerHeight} x2={chartWidth - rightPad} y2={topPad + innerHeight} stroke="#cbd5e1" />

          {rows.map((item, index) => {
            const x = leftPad + slotWidth * index + (slotWidth - barWidth) / 2
            const barHeight = Math.max(14, item.score * innerHeight)
            const y = topPad + innerHeight - barHeight
            const centerX = x + barWidth / 2
            const isHovered = hoveredMetric === item.metric

            return (
              <g key={item.metric}>
                {isHovered ? (
                  <g>
                    <rect
                      x={centerX - 30}
                      y={y - 34}
                      width="60"
                      height="22"
                      rx="8"
                      ry="8"
                      fill="#0f172a"
                    />
                    <text x={centerX} y={y - 19} textAnchor="middle" fontSize="11" fontWeight="700" fill="#ffffff">
                      {item.actual}
                    </text>
                  </g>
                ) : null}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx="8"
                  ry="8"
                  fill="#243cff"
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHoveredMetric(item.metric)}
                  onMouseLeave={() => setHoveredMetric(null)}
                />
                <text x={centerX} y={chartHeight - 10} textAnchor="middle" fontSize="11" fontWeight="700" fill="#334155">
                  {item.metric}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

export default function AdminAiEvaluationPage() {
  const auth = getStoredAdminAuth()
  const [evaluation, setEvaluation] = useState<AdminEvaluationMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!auth.token) return
    setLoading(true)
    fetchAdminEvaluationMetrics(auth.token)
      .then((payload) => {
        setEvaluation(payload)
        setError("")
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Failed to load AI evaluation metrics."
        setError(message)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [auth.token])

  useEffect(() => {
    if (!error.includes("401") && !error.includes("403")) return
    signOutAdmin("/admin-login")
  }, [error])

  return (
    <AdminFrame>
      <div className="mx-auto max-w-6xl">
        <p className="text-xs uppercase tracking-[0.3em] text-ink/50">Evaluation</p>
        <h2 className="text-3xl font-semibold">AI Model Metrics</h2>

        {loading ? <p className="mt-6 text-sm text-ink/60">Loading AI metrics...</p> : null}
        {!loading && error ? <p className="mt-6 text-sm text-rose-600">{error}</p> : null}

        {!loading && !error ? (
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Metric
                label="AI Model"
                value={evaluation?.ai_model_provider ?? "Fine-tuned FLAN-T5"}
                note={evaluation?.ai_model_name ?? "models/final_flan_t5_github_recommender"}
              />
              <Metric
                label="Base Model"
                value={evaluation?.ai_eval_model ?? "google/flan-t5-base"}
                note="Fine-tuned for GitHub profile recommendation output."
              />
              <Metric
                label="Fallback Strategy"
                value="Rule-based"
                note={evaluation?.ai_fallback_strategy ?? "Used only when model output is invalid."}
              />
              <Metric
                label="Dataset Rows"
                value={`${evaluation?.ai_eval_dataset_rows ?? 0}`}
                note={`Train ${evaluation?.ai_eval_train_rows ?? 0} / Val ${evaluation?.ai_eval_validation_rows ?? 0} / Test ${evaluation?.ai_eval_test_rows ?? 0}`}
              />
              <Metric label="ROUGE-1" value={formatScore(evaluation?.rouge1)} note="Unigram overlap with reference recommendations." />
              <Metric label="ROUGE-2" value={formatScore(evaluation?.rouge2)} note="Bigram overlap with reference recommendations." />
              <Metric label="ROUGE-L" value={formatScore(evaluation?.rougeL)} note="Longest-sequence overlap." />
              <Metric label="BLEU" value={formatScore(evaluation?.bleu, 2)} note="N-gram precision for generated recommendations." />
              <Metric label="BERTScore F1" value={formatScore(evaluation?.bertscore_f1)} note="Semantic similarity against reference outputs." />
              <Metric label="BERTScore Precision" value={formatScore(evaluation?.bertscore_precision)} note="Semantic precision against reference outputs." />
              <Metric label="BERTScore Recall" value={formatScore(evaluation?.bertscore_recall)} note="Semantic recall against reference outputs." />
            </div>

            <div className="mt-4">
              <section className="rounded-2xl border border-ink/10 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">ROUGE, BLEU, and BERTScore</h3>
                  <span className="text-xs text-ink/50">BLEU normalized; actual BLEU {formatScore(evaluation?.bleu, 2)}</span>
                </div>
                <ComboMetricChart evaluation={evaluation} />
              </section>
            </div>

            <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-4">
              <h3 className="text-sm font-semibold">Evaluation Summary</h3>
              <p className="mt-2 text-sm leading-6 text-ink/60">
                The deployed recommender uses a fine-tuned Google FLAN-T5 Base model. ROUGE, BLEU, and BERTScore
                are computed from generated recommendations compared with the held-out test references.
              </p>
              <p className="mt-2 text-sm leading-6 text-ink/60">
                A higher score is better. A strong result shows consistent gains across ROUGE, BLEU, and BERTScore,
                not just a single metric. Treat scores as relative: compare them to a baseline model or earlier run,
                and confirm with a quick human spot check of outputs.
              </p>
              <p className="mt-2 text-sm leading-6 text-ink/60">
                {buildQualitySummary(evaluation)}
              </p>
            </div>
          </>
        ) : null}
      </div>
    </AdminFrame>
  )
}
