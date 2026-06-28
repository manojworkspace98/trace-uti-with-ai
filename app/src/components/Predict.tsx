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
import { Card, Chip, Reveal, Select, SectionTitle } from "./ui";
import { CountUp } from "./CountUp";
import { Results } from "./Results";

const winLabel = (w: number) => `within ~${w} days`;

/** Add one-or-more (code, window) history items, with valid-combo constraints. */
function HistoryAdder({
  options,
  combos,
  items,
  onAdd,
  onRemove,
  codeLabel,
  itemNoun,
  tone = "brand",
}: {
  options: { code: string; label: string }[];
  combos: [string, number][];
  items: HistoryItem[];
  onAdd: (it: HistoryItem) => void;
  onRemove: (idx: number) => void;
  codeLabel: string;
  itemNoun: string; // e.g. "resistance result"
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
    setCode("");
    setWin("");
  };

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2 rounded-2xl bg-slate-50/70 p-3">
        <div className="min-w-[170px] flex-1">
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
            label="When? (most recent)"
            value={win}
            onChange={setWin}
            disabled={!code}
            placeholder={code ? "Choose…" : "Pick one first"}
            options={validWindows.map((w) => ({ value: String(w), label: winLabel(w) }))}
          />
        </div>
        <button
          type="button"
          onClick={add}
          disabled={!code || !win}
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          + Add
        </button>
      </div>

      {items.length > 0 ? (
        <div className="mt-2.5">
          <p className="mb-1.5 text-[11px] font-medium text-ink-500">
            {items.length} added — tap × to remove:
          </p>
          <div className="flex flex-wrap gap-2">
            <AnimatePresence>
              {items.map((it, i) => (
                <Chip
                  key={`${it.code}-${it.window}`}
                  tone={tone}
                  onRemove={() => onRemove(i)}
                >
                  {labelFor(it.code)} · {winLabel(it.window)}
                </Chip>
              ))}
            </AnimatePresence>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-ink-400">
          None added yet — optional. You can add more than one {itemNoun}.
        </p>
      )}
    </div>
  );
}

/** Multi-select comorbidity picker — tap any that apply; each reveals a "when". */
function ComorbiditySelector({
  schema,
  items,
  onChange,
}: {
  schema: Schema;
  items: HistoryItem[];
  onChange: (items: HistoryItem[]) => void;
}) {
  const conds = schema.groups.comorbidity.conditions;
  const combos = schema.groups.comorbidity.combos;
  const windowsFor = (code: string) =>
    combos
      .filter(([c]) => c === code)
      .map(([, w]) => w)
      .sort((a, b) => a - b);
  const active = (code: string) => items.find((it) => it.code === code);

  const toggle = (code: string) => {
    if (active(code)) {
      onChange(items.filter((it) => it.code !== code));
    } else {
      const ws = windowsFor(code);
      const w = ws.includes(180) ? 180 : ws[ws.length - 1];
      onChange([...items, { code, window: w }]);
    }
  };
  const setWindow = (code: string, w: number) =>
    onChange(items.map((it) => (it.code === code ? { ...it, window: w } : it)));

  return (
    <div className="space-y-2">
      {conds.map((c) => {
        const a = active(c.code);
        return (
          <div
            key={c.code}
            className={`flex flex-wrap items-center gap-3 rounded-xl border p-2.5 transition ${
              a ? "border-brand-300 bg-brand-50/60" : "border-slate-200 bg-white/60"
            }`}
          >
            <button
              type="button"
              onClick={() => toggle(c.code)}
              aria-pressed={!!a}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                a
                  ? "bg-brand-600 text-white"
                  : "bg-white text-ink-700 ring-1 ring-slate-200 hover:ring-brand-300"
              }`}
            >
              <span className="grid h-4 w-4 place-items-center rounded border border-current text-[10px]">
                {a ? "✓" : ""}
              </span>
              {c.label}
            </button>
            {a && (
              <div className="min-w-[150px] flex-1">
                <Select
                  label="Recorded when?"
                  value={String(a.window)}
                  onChange={(v) => setWindow(c.code, Number(v))}
                  options={windowsFor(c.code).map((w) => ({
                    value: String(w),
                    label: winLabel(w),
                  }))}
                />
              </div>
            )}
          </div>
        );
      })}
      <p className="text-[11px] text-ink-400">
        Tap any that apply — you can select more than one. All optional.
      </p>
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
        <div className="pb-1 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-brand-800 sm:text-4xl">
            Resistance-aware antibiotic recommendations
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-ink-600 sm:text-base">
            Tell us what’s known about the patient’s past UTIs. The model estimates the
            chance of resistance to each first-line antibiotic and recommends the narrowest
            effective option — to support antimicrobial stewardship.
          </p>
        </div>
      </Reveal>

      {/* How-to tip */}
      <Reveal immediate>
        <div className="flex items-start gap-3 rounded-2xl border border-brand-100 bg-brand-50/70 p-4 text-sm text-ink-700">
          <span className="text-lg leading-none">💡</span>
          <p>
            <strong className="font-semibold text-brand-800">How to use:</strong> fill in
            what you know below — <strong>every field is optional</strong> and you can add{" "}
            <strong>several entries</strong> in each section. First infection or no records?
            You’ll still get a baseline estimate. New here? Tap{" "}
            <span className="rounded bg-white px-1.5 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-brand-200">
              Load example case
            </span>{" "}
            to see it in action.
          </p>
        </div>
      </Reveal>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Form */}
        <div className="space-y-6 lg:col-span-3">
          <Reveal>
            <Card className="p-6">
              <SectionTitle
                step={1}
                title="Patient"
                subtitle="A couple of basics — both optional."
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  label="Age group"
                  value={form.ageGroup ?? ""}
                  onChange={(v) => update({ ageGroup: v || null })}
                  options={g.age_groups.map((a) => ({ value: a.key, label: a.label }))}
                />
                <div>
                  <span className="mb-1 block text-xs font-medium text-ink-700">
                    Race <span className="text-ink-400">(from the source dataset)</span>
                  </span>
                  <div className="flex gap-2">
                    {[
                      { v: "white", label: "White" },
                      { v: "nonwhite", label: "Non-white" },
                      { v: "unknown", label: "Skip" },
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
                title="Past UTI history"
                subtitle="Add the patient’s previous results and antibiotic use — add as many as you like, or skip if this is their first infection."
              />
              <div className="space-y-6">
                <FieldGroup
                  title="Antibiotics they were resistant to"
                  help="Antibiotics a previous urine culture showed the patient’s bacteria could resist. Add each one and roughly how recently it was found."
                >
                  <HistoryAdder
                    options={g.resistance.antibiotics}
                    combos={g.resistance.combos}
                    items={form.resistances}
                    onAdd={addTo("resistances")}
                    onRemove={removeFrom("resistances")}
                    codeLabel="Resistant to"
                    itemNoun="resistance result"
                    tone="rose"
                  />
                </FieldGroup>

                <FieldGroup
                  title="Bacteria found in past infections"
                  help="Organisms identified in previous urine cultures. E. coli causes most UTIs."
                >
                  <HistoryAdder
                    options={g.organism.organisms}
                    combos={g.organism.combos}
                    items={form.organisms}
                    onAdd={addTo("organisms")}
                    onRemove={removeFrom("organisms")}
                    codeLabel="Organism"
                    itemNoun="organism"
                    tone="slate"
                  />
                </FieldGroup>

                <FieldGroup
                  title="Antibiotics they’ve recently taken"
                  help="Classes of antibiotics prescribed recently — recent exposure can select for resistance."
                >
                  <HistoryAdder
                    options={g.prescription.classes}
                    combos={g.prescription.combos}
                    items={form.prescriptions}
                    onAdd={addTo("prescriptions")}
                    onRemove={removeFrom("prescriptions")}
                    codeLabel="Antibiotic class"
                    itemNoun="antibiotic"
                    tone="amber"
                  />
                </FieldGroup>
              </div>
            </Card>
          </Reveal>

          <Reveal delay={0.1}>
            <Card className="p-6">
              <SectionTitle
                step={3}
                title="Ongoing conditions"
                subtitle="Does the patient have any of these? Select all that apply."
              />
              <ComorbiditySelector
                schema={schema}
                items={form.comorbidities}
                onChange={(items) => update({ comorbidities: items })}
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
                  {running ? "Analysing…" : "Get recommendation →"}
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
                  Even an empty or sparse form returns a prediction (shown with lower
                  confidence). This tool informs — it does not replace — culture &amp;
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

function FieldGroup({
  title,
  help,
  children,
}: {
  title: string;
  help: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 text-sm font-semibold text-ink-800">{title}</div>
      <p className="mb-2 text-xs text-ink-500">{help}</p>
      {children}
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
        {items} item{items === 1 ? "" : "s"} entered — more detail sharpens the estimate.
      </p>
    </div>
  );
}
