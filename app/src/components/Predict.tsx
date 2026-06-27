import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import type { Model, Schema, Prediction } from "../lib/types";
import {
  buildFeatureVector,
  completeness,
  emptyForm,
  totalHistoryItems,
  type FormState,
  type HistoryItem,
} from "../lib/formState";
import { predict } from "../lib/inference";
import { Card, Chip, HelpTooltip, Reveal, Select, SectionTitle } from "./ui";
import { CountUp } from "./CountUp";
import { Results } from "./Results";

const winLabel = (w: number) => `within ~${w} days`;

/** Adds (code, window) history items with valid-combo constraints. */
function HistoryAdder({
  options,
  combos,
  items,
  onAdd,
  onRemove,
  codeLabel,
  tone = "brand",
}: {
  options: { code: string; label: string }[];
  combos: [string, number][];
  items: HistoryItem[];
  onAdd: (it: HistoryItem) => void;
  onRemove: (idx: number) => void;
  codeLabel: string;
  tone?: "brand" | "amber" | "rose" | "slate";
}) {
  const [code, setCode] = useState("");
  const [win, setWin] = useState("");
  const validWindows = useMemo(
    () =>
      combos
        .filter(([c]) => c === code)
        .map(([, w]) => w)
        .sort((a, b) => a - b),
    [code, combos],
  );
  const labelFor = (c: string) => options.find((o) => o.code === c)?.label ?? c;
  const exists = (c: string, w: number) =>
    items.some((it) => it.code === c && it.window === w);

  const add = () => {
    const w = Number(win);
    if (code && w && !exists(code, w)) onAdd({ code, window: w });
    setWin("");
  };

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[180px] flex-1">
          <Select
            label={codeLabel}
            value={code}
            onChange={(v) => {
              setCode(v);
              setWin("");
            }}
            options={options.map((o) => ({ value: o.code, label: o.label }))}
          />
        </div>
        <div className="min-w-[150px] flex-1">
          <Select
            label="Time window"
            value={win}
            onChange={setWin}
            disabled={!code}
            placeholder={code ? "When?" : "Pick first"}
            options={validWindows.map((w) => ({ value: String(w), label: winLabel(w) }))}
          />
        </div>
        <button
          type="button"
          onClick={add}
          disabled={!code || !win}
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-40"
        >
          Add
        </button>
      </div>
      {items.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          <AnimatePresence>
            {items.map((it, i) => (
              <Chip key={`${it.code}-${it.window}`} tone={tone} onRemove={() => onRemove(i)}>
                {labelFor(it.code)} · {winLabel(it.window)}
              </Chip>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

export function Predict({ schema, model }: { schema: Schema; model: Model }) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [result, setResult] = useState<Prediction | null>(null);
  const [running, setRunning] = useState(false);

  const g = schema.groups;
  const comp = completeness(form);
  const update = (patch: Partial<FormState>) => {
    setForm((f) => ({ ...f, ...patch }));
    setResult(null);
  };
  const addTo = (key: keyof FormState) => (it: HistoryItem) =>
    update({ [key]: [...(form[key] as HistoryItem[]), it] } as Partial<FormState>);
  const removeFrom = (key: keyof FormState) => (idx: number) =>
    update({
      [key]: (form[key] as HistoryItem[]).filter((_, i) => i !== idx),
    } as Partial<FormState>);

  const run = () => {
    setRunning(true);
    // brief async so the spinner paints; compute is instant
    setTimeout(() => {
      const x = buildFeatureVector(schema, form);
      setResult(predict(model, x));
      setRunning(false);
      requestAnimationFrame(() =>
        document.getElementById("results")?.scrollIntoView({ behavior: "smooth" }),
      );
    }, 180);
  };

  const loadExample = () => {
    setForm({
      ageGroup: "Age_Adult(20-49)",
      isWhite: true,
      resistances: [
        { code: "CIP", window: 90 },
        { code: "SXT", window: 180 },
      ],
      organisms: [{ code: "Escherichia", window: 90 }],
      prescriptions: [{ code: "fluoroquinolone", window: 90 }],
      comorbidities: [{ code: "DM", window: 180 }],
    });
    setResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <Reveal immediate>
        <div className="pb-2 text-center">
          <h1 className="bg-gradient-to-r from-brand-700 to-teal-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
            Personalised UTI antibiotic guidance
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-ink-600 sm:text-base">
            Enter a patient’s prior infection history. The model estimates resistance to
            each first-line antibiotic and suggests the narrowest effective option — to
            support antimicrobial stewardship.
          </p>
        </div>
      </Reveal>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Form */}
        <div className="space-y-6 lg:col-span-3">
          <Reveal>
            <Card className="p-6">
              <SectionTitle step={1} title="Patient" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  label="Age group"
                  value={form.ageGroup ?? ""}
                  onChange={(v) => update({ ageGroup: v || null })}
                  options={g.age_groups.map((a) => ({ value: a.key, label: a.label }))}
                />
                <div>
                  <span className="mb-1 block text-xs font-medium text-ink-700">Race</span>
                  <div className="flex gap-2">
                    {[
                      { v: "white", label: "White" },
                      { v: "nonwhite", label: "Non-white" },
                      { v: "unknown", label: "Unspecified" },
                    ].map((o) => {
                      const active =
                        (o.v === "white" && form.isWhite === true) ||
                        (o.v === "nonwhite" && form.isWhite === false) ||
                        (o.v === "unknown" && form.isWhite === null);
                      return (
                        <button
                          key={o.v}
                          type="button"
                          onClick={() =>
                            update({
                              isWhite:
                                o.v === "white" ? true : o.v === "nonwhite" ? false : null,
                            })
                          }
                          className={`flex-1 rounded-xl border px-2 py-2 text-xs font-medium transition ${
                            active
                              ? "border-brand-400 bg-brand-50 text-brand-800"
                              : "border-slate-200 bg-white/70 text-ink-600 hover:border-brand-200"
                          }`}
                        >
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Card>
          </Reveal>

          <Reveal delay={0.05}>
            <Card className="p-6">
              <SectionTitle
                step={2}
                title="Prior infection history"
                subtitle="Add any past resistance results, infecting organisms and antibiotics taken. Everything is optional."
              />
              <div className="space-y-5">
                <div>
                  <div className="mb-2 flex items-center text-sm font-semibold text-ink-800">
                    Prior antibiotic resistance
                    <HelpTooltip text="Antibiotics a previous culture showed the patient's bacteria resisted, and roughly how recently." />
                  </div>
                  <HistoryAdder
                    options={g.resistance.antibiotics}
                    combos={g.resistance.combos}
                    items={form.resistances}
                    onAdd={addTo("resistances")}
                    onRemove={removeFrom("resistances")}
                    codeLabel="Resistant to"
                    tone="rose"
                  />
                </div>
                <div className="h-px bg-slate-100" />
                <div>
                  <div className="mb-2 flex items-center text-sm font-semibold text-ink-800">
                    Prior infecting organisms
                    <HelpTooltip text="Bacteria identified in previous urine cultures (E. coli causes most UTIs)." />
                  </div>
                  <HistoryAdder
                    options={g.organism.organisms}
                    combos={g.organism.combos}
                    items={form.organisms}
                    onAdd={addTo("organisms")}
                    onRemove={removeFrom("organisms")}
                    codeLabel="Organism"
                    tone="slate"
                  />
                </div>
                <div className="h-px bg-slate-100" />
                <div>
                  <div className="mb-2 flex items-center text-sm font-semibold text-ink-800">
                    Antibiotics previously taken
                    <HelpTooltip text="Classes of antibiotics the patient was prescribed recently — recent exposure can select for resistance." />
                  </div>
                  <HistoryAdder
                    options={g.prescription.classes}
                    combos={g.prescription.combos}
                    items={form.prescriptions}
                    onAdd={addTo("prescriptions")}
                    onRemove={removeFrom("prescriptions")}
                    codeLabel="Antibiotic class"
                    tone="amber"
                  />
                </div>
              </div>
            </Card>
          </Reveal>

          <Reveal delay={0.1}>
            <Card className="p-6">
              <SectionTitle step={3} title="Comorbidities" subtitle="Optional." />
              <HistoryAdder
                options={g.comorbidity.conditions}
                combos={g.comorbidity.combos}
                items={form.comorbidities}
                onAdd={addTo("comorbidities")}
                onRemove={removeFrom("comorbidities")}
                codeLabel="Condition"
                tone="slate"
              />
            </Card>
          </Reveal>
        </div>

        {/* Sticky run panel */}
        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-24">
            <Reveal delay={0.15}>
              <Card strong className="p-6">
                <CompletenessMeter value={comp} items={totalHistoryItems(form)} />
                <button
                  onClick={run}
                  disabled={running}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-600 to-teal-600 px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:brightness-105 active:scale-[0.99] disabled:opacity-60"
                >
                  {running ? "Analysing…" : "Get recommendation"}
                </button>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={loadExample}
                    className="flex-1 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-xs font-medium text-ink-600 hover:border-brand-300"
                  >
                    Load example case
                  </button>
                  <button
                    onClick={() => {
                      setForm(emptyForm);
                      setResult(null);
                    }}
                    className="flex-1 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-xs font-medium text-ink-600 hover:border-brand-300"
                  >
                    Reset
                  </button>
                </div>
                <p className="mt-4 text-[11px] leading-relaxed text-ink-500">
                  Empty or sparse input still returns a prediction, shown with lower
                  confidence. This tool informs — it does not replace — culture &amp;
                  sensitivity testing.
                </p>
              </Card>
            </Reveal>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            id="results"
            style={{ scrollMarginTop: "5rem" }}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <Results schema={schema} form={form} prediction={result} completeness={comp} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CompletenessMeter({ value, items }: { value: number; items: number }) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-ink-700">Data completeness</span>
        <span className="font-semibold text-brand-700">
          <CountUp value={pct} suffix="%" duration={0.8} />
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-brand-400 to-teal-500"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-ink-500">
        {items} history item{items === 1 ? "" : "s"} entered — more detail sharpens the
        estimate.
      </p>
    </div>
  );
}
