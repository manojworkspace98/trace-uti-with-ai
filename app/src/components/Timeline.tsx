import { motion } from "framer-motion";
import type { Schema } from "../lib/types";
import type { FormState } from "../lib/formState";

const WINDOWS = [180, 90, 30, 14, 7]; // oldest → most recent (left → right)

interface Event {
  window: number;
  label: string;
  color: string;
  row: number;
}

export function ResistanceTimeline({
  schema,
  form,
}: {
  schema: Schema;
  form: FormState;
}) {
  const abLabel = (c: string) =>
    schema.groups.resistance.antibiotics.find((o) => o.code === c)?.label ?? c;
  const orgLabel = (c: string) =>
    schema.groups.organism.organisms.find((o) => o.code === c)?.label ?? c;
  const clsLabel = (c: string) =>
    schema.groups.prescription.classes.find((o) => o.code === c)?.label ?? c;

  const events: Event[] = [
    ...form.resistances.map((r) => ({
      window: r.window,
      label: `Resistant: ${abLabel(r.code)}`,
      color: "#be123c",
      row: 0,
    })),
    ...form.organisms.map((o) => ({
      window: o.window,
      label: `Organism: ${orgLabel(o.code)}`,
      color: "#475569",
      row: 1,
    })),
    ...form.prescriptions.map((p) => ({
      window: p.window,
      label: `Took: ${clsLabel(p.code)}`,
      color: "#d97706",
      row: 2,
    })),
  ];

  if (events.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-ink-400">
        No history entered — add events to see the timeline.
      </p>
    );
  }

  const W = 460,
    H = 150,
    padL = 12,
    padR = 12;
  const xFor = (win: number) => {
    const i = WINDOWS.indexOf(win);
    const t = i < 0 ? 0 : i / (WINDOWS.length - 1);
    return padL + t * (W - padL - padR);
  };

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 360 }}>
        {/* axis */}
        <line x1={padL} y1={H - 26} x2={W - padR} y2={H - 26} stroke="#cbd5e1" strokeWidth="2" />
        {WINDOWS.map((w) => (
          <g key={w}>
            <circle cx={xFor(w)} cy={H - 26} r="3" fill="#94a3b8" />
            <text x={xFor(w)} y={H - 10} textAnchor="middle" className="fill-ink-400 text-[9px]">
              ~{w}d
            </text>
          </g>
        ))}
        <text x={padL} y={12} className="fill-ink-400 text-[9px]">older</text>
        <text x={W - padR} y={12} textAnchor="end" className="fill-ink-400 text-[9px]">recent</text>
        {/* events */}
        {events.map((e, i) => {
          const y = 24 + e.row * 30;
          return (
            <motion.g
              key={i}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
            >
              <line x1={xFor(e.window)} y1={y + 6} x2={xFor(e.window)} y2={H - 26} stroke={e.color} strokeWidth="1" strokeDasharray="2 2" opacity="0.4" />
              <circle cx={xFor(e.window)} cy={y} r="5" fill={e.color} />
              <text x={xFor(e.window) + 9} y={y + 3} className="fill-ink-700 text-[9px]">
                {e.label}
              </text>
            </motion.g>
          );
        })}
      </svg>
    </div>
  );
}
