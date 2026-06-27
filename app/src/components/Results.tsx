import { motion } from "framer-motion";
import type { Drug, Prediction, Schema } from "../lib/types";
import type { FormState } from "../lib/formState";
import { buildReasoning, confidenceTier } from "../lib/reasoning";
import { riskColor } from "../lib/colors";
import { Card } from "./ui";
import { CountUp } from "./CountUp";
import { ClassSankey } from "./Sankey";
import { ResistanceTimeline } from "./Timeline";

export function Results({
  schema,
  form,
  prediction,
  completeness,
}: {
  schema: Schema;
  form: FormState;
  prediction: Prediction;
  completeness: number;
}) {
  const rec = prediction.recommendation;
  const reasoning = buildReasoning(schema, form, prediction);
  const recSusceptProb = rec ? 1 - prediction.perDrug[rec].pResistant : 0;
  const conf = confidenceTier(recSusceptProb, completeness);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-ink-900">Recommendation</h2>
        <button
          onClick={() => window.print()}
          className="no-print rounded-full border border-slate-200 bg-white/70 px-4 py-1.5 text-sm font-medium text-ink-600 hover:border-brand-300"
        >
          Print / Save PDF
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Recommendation hero */}
        <Card strong className="overflow-hidden lg:col-span-3">
          <div className="bg-gradient-to-br from-brand-600 to-teal-700 p-6 text-white">
            <p className="text-xs font-medium uppercase tracking-wider text-white/70">
              Suggested narrowest effective agent
            </p>
            {rec ? (
              <div className="mt-1 flex items-end gap-3">
                <span className="text-4xl font-bold tracking-tight">
                  {schema.drug_info[rec].name}
                </span>
                <span className="mb-1 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold">
                  {schema.drug_info[rec].line}
                </span>
              </div>
            ) : (
              <span className="text-3xl font-bold">No clear option</span>
            )}
            <p className="mt-2 max-w-md text-sm text-white/85">{reasoning.points[0]}</p>
          </div>
          <div className="grid gap-4 p-6 sm:grid-cols-3">
            <ConfidenceGauge tone={conf.tone} score={conf.score} label={conf.label} />
            <div className="sm:col-span-2">
              <p className="text-sm font-semibold text-ink-800">Why this suggestion</p>
              <p className="mt-1 text-sm text-ink-600">{reasoning.basis}</p>
              <ul className="mt-2 space-y-1 text-xs text-ink-600">
                {reasoning.points.slice(1).map((p, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="text-brand-500">•</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>

        {/* Per-drug susceptibility */}
        <Card className="p-6 lg:col-span-2">
          <p className="text-sm font-semibold text-ink-800">
            Predicted resistance by antibiotic
          </p>
          <p className="mb-4 text-xs text-ink-500">
            Lower is better. Bars show the model’s estimated chance of resistance.
          </p>
          <div className="space-y-3">
            {schema.drugs.map((d, i) => (
              <DrugBar
                key={d}
                drug={d}
                name={schema.drug_info[d].name}
                p={prediction.perDrug[d].pResistant}
                susceptible={prediction.perDrug[d].susceptible}
                recommended={d === rec}
                delay={i * 0.08}
              />
            ))}
          </div>
        </Card>
      </div>

      {/* Risk flags */}
      {reasoning.risks.length > 0 && (
        <Card className="p-5">
          <p className="mb-2 text-sm font-semibold text-ink-800">Clinical flags</p>
          <div className="flex flex-wrap gap-2">
            {reasoning.risks.map((r, i) => (
              <span
                key={i}
                className={`rounded-xl border px-3 py-1.5 text-xs font-medium ${
                  r.level === "danger"
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : r.level === "warn"
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-slate-200 bg-slate-50 text-slate-600"
                }`}
              >
                {r.text}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Visualizations */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <p className="mb-1 text-sm font-semibold text-ink-800">Resistance history timeline</p>
          <p className="mb-3 text-xs text-ink-500">Entered events, by how recent.</p>
          <ResistanceTimeline schema={schema} form={form} />
        </Card>
        <Card className="p-6">
          <p className="mb-1 text-sm font-semibold text-ink-800">Susceptibility flow</p>
          <p className="mb-3 text-xs text-ink-500">
            Relative predicted susceptibility flowing to the recommendation.
          </p>
          <ClassSankey schema={schema} prediction={prediction} />
        </Card>
      </div>

      <p className="rounded-2xl bg-ink-900/90 p-4 text-center text-xs text-slate-200">
        This is a research prototype and may be wrong. Confirm with urine culture &amp;
        sensitivity and follow local antimicrobial guidelines and clinical judgement.
      </p>
    </div>
  );
}

function DrugBar({
  name,
  p,
  susceptible,
  recommended,
  delay,
}: {
  drug: Drug;
  name: string;
  p: number;
  susceptible: boolean;
  recommended: boolean;
  delay: number;
}) {
  const pct = Math.round(p * 100);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 font-medium text-ink-800">
          {name}
          {recommended && (
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-700">
              SUGGESTED
            </span>
          )}
        </span>
        <span className="tabular-nums text-xs font-semibold" style={{ color: riskColor(p) }}>
          <CountUp value={pct} suffix="%" duration={0.9} /> ·{" "}
          {susceptible ? "susceptible" : "resistant likely"}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
        <motion.div
          className="h-full rounded-full"
          style={{ background: riskColor(p) }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 22, delay }}
        />
      </div>
    </div>
  );
}

function ConfidenceGauge({
  score,
  label,
  tone,
}: {
  score: number;
  label: string;
  tone: "low" | "moderate" | "good";
}) {
  const pct = Math.round(score * 100);
  const color = tone === "good" ? "#15803d" : tone === "moderate" ? "#d97706" : "#be123c";
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width="120" height="72" viewBox="0 0 120 72" aria-hidden>
          <path
            d="M12 66 A48 48 0 0 1 108 66"
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <motion.path
            d="M12 66 A48 48 0 0 1 108 66"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={Math.PI * 48}
            initial={{ strokeDashoffset: Math.PI * 48 }}
            animate={{ strokeDashoffset: Math.PI * 48 * (1 - score) }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-x-0 bottom-1 text-center text-xl font-bold text-ink-900">
          <CountUp value={pct} />
        </div>
      </div>
      <span className="text-center text-xs font-medium" style={{ color }}>
        {label}
      </span>
    </div>
  );
}
