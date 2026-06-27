import type { ReactNode } from "react";
import type { Metrics } from "../lib/metrics";
import { Card, Reveal } from "./ui";
import { Team } from "./Team";
import { CountUp, withCommas } from "./CountUp";

export function About({ metrics: m }: { metrics: Metrics }) {
  const meanAuc =
    (m.per_drug.NIT.auc + m.per_drug.SXT.auc + m.per_drug.CIP.auc + m.per_drug.LVX.auc) /
    4;

  const sections: { icon: string; title: string; body: ReactNode }[] = [
    {
      icon: "🎯",
      title: "What it does",
      body: (
        <>
          Estimates a UTI patient’s likelihood of resistance to each first-line oral
          antibiotic — nitrofurantoin, trimethoprim-sulfamethoxazole and the
          fluoroquinolones — from prior infection history, then suggests the{" "}
          <em>narrowest-spectrum</em> agent likely to remain effective.
        </>
      ),
    },
    {
      icon: "⚙️",
      title: "How it works",
      body: (
        <>
          Four calibrated gradient-boosted models (one per antibiotic) trained on the{" "}
          <strong>MIT / PhysioNet AMR-UTI dataset</strong> of{" "}
          {(m.cohort.train + m.cohort.test).toLocaleString()} specimens. Bayesian-tuned;
          features pruned {m.feature_selection.n_total}→{m.feature_selection.n_selected}.
          Runs <strong>entirely in your browser</strong>.
        </>
      ),
    },
    {
      icon: "📊",
      title: "How good is it — honestly",
      body: (
        <>
          On a {m.cohort.test.toLocaleString()}-patient locked temporal test set, mean
          per-drug AUROC ≈ <strong>{meanAuc.toFixed(2)}</strong>. A hard problem with a
          real signal ceiling — numbers are reported without inflation. See{" "}
          <strong>Model performance</strong> for the full evaluation.
        </>
      ),
    },
    {
      icon: "⚠️",
      title: "Important limitations",
      body: (
        <>
          A <strong>research prototype — not a medical device and not medical advice</strong>.
          It does not replace urine culture &amp; sensitivity, local antibiograms, or
          clinical judgement, and was trained on a US cohort (2007–2016).
        </>
      ),
    },
    {
      icon: "🔒",
      title: "Data & privacy",
      body: (
        <>
          The AMR-UTI data is PhysioNet-Credentialed and <strong>not redistributed</strong>;
          only the derived, de-identified model ships. Nothing you enter leaves your
          device.
        </>
      ),
    },
    {
      icon: "🧪",
      title: "Stewardship goal",
      body: (
        <>
          By favouring the narrowest effective agent, Trace aims to reduce unnecessary
          broad-spectrum use — the core principle of antimicrobial stewardship.
        </>
      ),
    },
  ];

  const stats: { node: ReactNode; l: string }[] = [
    { node: <CountUp value={meanAuc} decimals={2} />, l: "Mean AUROC" },
    {
      node: <CountUp value={m.cohort.train + m.cohort.test} format={withCommas} />,
      l: "Patients",
    },
    { node: <CountUp value={m.feature_selection.n_selected} />, l: "Features" },
    { node: <CountUp value={100} suffix="%" />, l: "In-browser" },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Reveal immediate>
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800">
            💧 Antimicrobial stewardship · research prototype
          </span>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
            About Trace
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-ink-600 sm:text-base">
            A decision-support tool that predicts UTI antibiotic susceptibility to help
            clinicians treat effectively while sparing broad-spectrum drugs.
          </p>
        </div>
      </Reveal>

      <Reveal immediate>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.l}
              className="rounded-2xl bg-white/60 p-4 text-center ring-1 ring-black/5"
            >
              <div className="text-2xl font-bold text-brand-700">{s.node}</div>
              <div className="mt-0.5 text-xs font-medium text-ink-600">{s.l}</div>
            </div>
          ))}
        </div>
      </Reveal>

      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((s, i) => (
          <Reveal key={s.title} delay={i * 0.04}>
            <Card className="h-full p-5">
              <div className="mb-2 flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-lg">
                  {s.icon}
                </span>
                <h3 className="font-semibold text-ink-900">{s.title}</h3>
              </div>
              <p className="text-sm leading-relaxed text-ink-600">{s.body}</p>
            </Card>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <Card strong className="p-6 sm:p-8">
          <Team />
        </Card>
      </Reveal>

      <p className="rounded-2xl bg-ink-900/90 p-4 text-center text-xs text-slate-200">
        ⚠️ Not medical advice. For research and educational use only.
      </p>
    </div>
  );
}
