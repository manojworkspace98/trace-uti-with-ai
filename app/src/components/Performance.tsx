import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Metrics } from "../lib/metrics";
import type { Drug } from "../lib/types";
import { DRUG_COLOR } from "../lib/colors";
import { Card, Reveal } from "./ui";
import { CountUp, withCommas } from "./CountUp";
import type { ReactNode } from "react";

const DRUGS: Drug[] = ["NIT", "SXT", "CIP", "LVX"];

function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white/60 p-4 text-center ring-1 ring-black/5">
      <div className="text-2xl font-bold text-brand-700">{value}</div>
      <div className="mt-0.5 text-xs font-medium text-ink-700">{label}</div>
      {sub && <div className="text-[10px] text-ink-400">{sub}</div>}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <p className="text-sm font-semibold text-ink-800">{title}</p>
      {subtitle && <p className="mb-3 text-xs text-ink-500">{subtitle}</p>}
      <div className="mt-2">{children}</div>
    </Card>
  );
}

export function Performance({ metrics: m }: { metrics: Metrics }) {
  const [rocDrugs, setRocDrugs] = useState<Record<Drug, boolean>>({
    NIT: true,
    SXT: true,
    CIP: true,
    LVX: true,
  });

  const meanAuc =
    DRUGS.reduce((s, d) => s + m.per_drug[d].auc, 0) / DRUGS.length;

  // Build merged ROC data: each drug contributes points; recharts wants one series per drug.
  const rocSeries = DRUGS.map((d) => ({
    drug: d,
    data: m.per_drug[d].roc.fpr.map((f, i) => ({
      fpr: f,
      tpr: m.per_drug[d].roc.tpr[i],
    })),
  }));

  const calSeries = DRUGS.map((d) => ({
    drug: d,
    data: m.per_drug[d].calibration.pred.map((p, i) => ({
      pred: p,
      obs: m.per_drug[d].calibration.obs[i],
    })),
  }));

  const augData = Object.entries(m.augmentation.arms).map(([arm, v]) => ({
    arm,
    mean_auc: v.mean_auc,
    shipped: arm === m.augmentation.shipped_arm,
  }));

  const aucData = DRUGS.map((d) => ({
    drug: d,
    auc: m.per_drug[d].auc,
    prevalence: m.per_drug[d].prevalence,
  }));

  const groupLoo = Object.entries(m.feature_selection.group_loo).map(([g, drops]) => ({
    group: g.replace(/_/g, " "),
    impact:
      Object.values(drops).reduce((a, b) => a + b, 0) / Object.values(drops).length,
  }));

  const trials = m.tuning.per_drug_trials;
  let best = -Infinity;
  const trialData = trials.map((t) => {
    best = Math.max(best, t.v);
    return { n: t.n, v: t.v, best };
  });

  return (
    <div className="space-y-6">
      <Reveal immediate>
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-ink-900">
            How good is the model?
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-ink-600">
            All numbers below come from a {m.cohort.test.toLocaleString()}-patient{" "}
            <strong>locked temporal test set</strong> ({m.cohort.split}) that was never
            used for training, tuning, or feature selection — an honest estimate of
            real-world generalisation.
          </p>
        </div>
      </Reveal>

      <Reveal immediate>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="Mean per-drug AUROC"
            value={<CountUp value={meanAuc} decimals={3} />}
            sub="0.5 = random"
          />
          <Stat
            label="3-class macro-F1"
            value={<CountUp value={m.three_class.macro_f1} decimals={3} />}
            sub={`baseline ${(0.199).toFixed(3)}`}
          />
          <Stat
            label="Features used"
            value={<CountUp value={m.feature_selection.n_selected} />}
            sub={`of ${m.feature_selection.n_total} (pruned)`}
          />
          <Stat
            label="Patients"
            value={<CountUp value={m.cohort.train + m.cohort.test} format={withCommas} />}
            sub={`${m.cohort.train.toLocaleString()} train / ${m.cohort.test.toLocaleString()} test`}
          />
        </div>
      </Reveal>

      {/* Before / after + per-drug AUROC */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Reveal>
          <ChartCard
            title="Headline results (locked test)"
            subtitle={`Evaluated once on ${m.cohort.test.toLocaleString()} held-out patients. For reference: a random model scores 0.50 AUROC, and always predicting the most common drug gives ${(m.baseline_3class * 100).toFixed(0)}% accuracy.`}
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={[
                  { k: "Mean per-drug AUROC", v: meanAuc },
                  { k: "3-class accuracy", v: m.three_class.test_acc },
                  { k: "3-class macro-F1", v: m.three_class.macro_f1 },
                ]}
                margin={{ top: 8, right: 8, bottom: 28, left: -10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
                <XAxis dataKey="k" tick={{ fontSize: 10 }} angle={-10} textAnchor="end" height={52} />
                <YAxis domain={[0, 1]} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => v.toFixed(3)} />
                <Bar dataKey="v" radius={[5, 5, 0, 0]}>
                  {["#0d9488", "#0e7490", "#0891b2"].map((c, i) => (
                    <Cell key={i} fill={c} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Reveal>

        <Reveal delay={0.05}>
          <ChartCard
            title="Per-drug discrimination (AUROC)"
            subtitle="Resistance is rarer for fluoroquinolones, where the model discriminates best — consistent with the source research."
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={aucData} margin={{ top: 8, right: 8, bottom: 4, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
                <XAxis dataKey="drug" tick={{ fontSize: 11 }} />
                <YAxis domain={[0.4, 0.75]} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => v.toFixed(3)} />
                <ReferenceLine y={0.5} stroke="#cbd5e1" strokeDasharray="4 4" />
                <Bar dataKey="auc" radius={[5, 5, 0, 0]}>
                  {aucData.map((d) => (
                    <Cell key={d.drug} fill={DRUG_COLOR[d.drug]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Reveal>
      </div>

      {/* ROC + calibration */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Reveal>
          <ChartCard title="ROC curves" subtitle="Toggle drugs. Up-and-left is better.">
            <div className="mb-2 flex flex-wrap gap-2">
              {DRUGS.map((d) => (
                <button
                  key={d}
                  onClick={() => setRocDrugs((s) => ({ ...s, [d]: !s[d] }))}
                  className="rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition"
                  style={{
                    color: rocDrugs[d] ? "#fff" : DRUG_COLOR[d],
                    background: rocDrugs[d] ? DRUG_COLOR[d] : "transparent",
                    boxShadow: `inset 0 0 0 1px ${DRUG_COLOR[d]}`,
                  }}
                >
                  {d} · {m.per_drug[d].auc.toFixed(2)}
                </button>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
                <XAxis type="number" dataKey="fpr" domain={[0, 1]} tick={{ fontSize: 10 }} />
                <YAxis type="number" dataKey="tpr" domain={[0, 1]} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => v.toFixed(3)} />
                <ReferenceLine
                  segment={[
                    { x: 0, y: 0 },
                    { x: 1, y: 1 },
                  ]}
                  stroke="#cbd5e1"
                  strokeDasharray="4 4"
                />
                {rocSeries
                  .filter((s) => rocDrugs[s.drug])
                  .map((s) => (
                    <Line
                      key={s.drug}
                      data={s.data}
                      dataKey="tpr"
                      stroke={DRUG_COLOR[s.drug]}
                      dot={false}
                      strokeWidth={2}
                      isAnimationActive
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </Reveal>

        <Reveal delay={0.05}>
          <ChartCard
            title="Calibration"
            subtitle="Predicted vs observed resistance. Closer to the diagonal = better calibrated."
          >
            <ResponsiveContainer width="100%" height={240}>
              <LineChart margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
                <XAxis type="number" dataKey="pred" domain={[0, 1]} tick={{ fontSize: 10 }} />
                <YAxis type="number" dataKey="obs" domain={[0, 1]} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => v.toFixed(3)} />
                <ReferenceLine
                  segment={[
                    { x: 0, y: 0 },
                    { x: 1, y: 1 },
                  ]}
                  stroke="#cbd5e1"
                  strokeDasharray="4 4"
                />
                {calSeries.map((s) => (
                  <Line
                    key={s.drug}
                    data={s.data}
                    dataKey="obs"
                    stroke={DRUG_COLOR[s.drug]}
                    dot={{ r: 2 }}
                    strokeWidth={1.5}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </Reveal>
      </div>

      {/* Augmentation + confusion */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Reveal>
          <ChartCard
            title="Data augmentation comparison"
            subtitle={m.augmentation.verdict}
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={augData} margin={{ top: 8, right: 8, bottom: 4, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
                <XAxis dataKey="arm" tick={{ fontSize: 10 }} />
                <YAxis domain={[0.55, 0.7]} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => v.toFixed(4)} />
                <Bar dataKey="mean_auc" radius={[5, 5, 0, 0]}>
                  {augData.map((d) => (
                    <Cell key={d.arm} fill={d.shipped ? "#0d9488" : "#cbd5e1"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Reveal>

        <Reveal delay={0.05}>
          <ChartCard
            title="3-class confusion matrix"
            subtitle="Rows = actual prescription, columns = predicted (locked test)."
          >
            <ConfusionMatrix cm={m.three_class.confusion_matrix} />
          </ChartCard>
        </Reveal>
      </div>

      {/* Learning curve + tuning */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Reveal>
          <ChartCard
            title="Learning curve"
            subtitle="Train vs test macro-F1 as training data grows. A small, stable gap = no overfitting."
          >
            <ResponsiveContainer width="100%" height={220}>
              <LineChart
                data={m.learning_curve.map((d) => ({ ...d, frac: Math.round(d.frac * 100) }))}
                margin={{ top: 8, right: 8, bottom: 4, left: -16 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
                <XAxis dataKey="frac" unit="%" tick={{ fontSize: 10 }} />
                <YAxis domain={[0.2, 0.6]} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => v.toFixed(3)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line dataKey="train_f1" name="Train" stroke="#94a3b8" strokeWidth={2} dot={{ r: 2 }} />
                <Line dataKey="test_f1" name="Test" stroke="#0e7490" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </Reveal>

        <Reveal delay={0.05}>
          <ChartCard
            title="Hyperparameter search (Optuna)"
            subtitle="Per-drug CV AUROC across Bayesian-optimisation trials; the line tracks the best so far."
          >
            <ResponsiveContainer width="100%" height={220}>
              <ScatterChart margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
                <XAxis type="number" dataKey="n" name="trial" tick={{ fontSize: 10 }} />
                <YAxis type="number" dataKey="v" domain={["auto", "auto"]} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => v.toFixed(4)} />
                <Scatter data={trialData} dataKey="v" fill="#cbd5e1" />
                <Line data={trialData} dataKey="best" stroke="#0d9488" dot={false} strokeWidth={2} />
              </ScatterChart>
            </ResponsiveContainer>
          </ChartCard>
        </Reveal>
      </div>

      {/* Feature selection */}
      <Reveal>
        <ChartCard
          title="Feature importance by clinical group"
          subtitle={`Validation-AUROC drop when each group is removed (leave-one-group-out). ${m.feature_selection.n_selected} of ${m.feature_selection.n_total} features were kept after permutation-importance pruning.`}
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              layout="vertical"
              data={groupLoo.sort((a, b) => b.impact - a.impact)}
              margin={{ top: 8, right: 16, bottom: 4, left: 90 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="group" tick={{ fontSize: 10 }} width={90} />
              <Tooltip formatter={(v: number) => v.toFixed(4)} />
              <Bar dataKey="impact" fill="#0891b2" radius={[0, 5, 5, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </Reveal>
    </div>
  );
}

function ConfusionMatrix({ cm }: { cm: number[][] }) {
  const labels = ["NIT", "SXT", "FQ"];
  const max = Math.max(...cm.flat());
  return (
    <div className="overflow-x-auto">
      <table className="mx-auto text-center text-xs">
        <thead>
          <tr>
            <th className="p-1"></th>
            {labels.map((l) => (
              <th key={l} className="p-1 font-semibold text-ink-600">
                {l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cm.map((row, i) => (
            <tr key={i}>
              <th className="p-1 font-semibold text-ink-600">{labels[i]}</th>
              {row.map((v, j) => {
                const t = v / max;
                return (
                  <td key={j} className="p-1">
                    <div
                      className="grid h-12 w-16 place-items-center rounded-lg font-semibold"
                      style={{
                        background: `rgba(13,148,136,${0.12 + t * 0.7})`,
                        color: t > 0.5 ? "#fff" : "#0f172a",
                      }}
                    >
                      {v}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-center text-[10px] text-ink-400">diagonal = correct</p>
    </div>
  );
}
