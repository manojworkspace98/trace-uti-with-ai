import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import { useId, useState, type ReactNode } from "react";

/* ── Reveal: fade/slide content in on scroll, motion-safe ──────────────────── */
export function Reveal({
  children,
  delay = 0,
  className,
  immediate = false,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  immediate?: boolean;
}) {
  const reduce = useReducedMotion();
  const initial = reduce ? { opacity: 0 } : { opacity: 0, y: 18 };
  const shown = { opacity: 1, y: 0 };
  // `immediate` animates on mount (for above-the-fold content that must never
  // flash invisible); otherwise reveal on scroll-into-view.
  return (
    <motion.div
      className={className}
      initial={initial}
      {...(immediate
        ? { animate: shown }
        : { whileInView: shown, viewport: { once: true, amount: 0.1 } })}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export const springCard: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 26 } },
};

/* ── Card ───────────────────────────────────────────────────────────────────── */
export function Card({
  children,
  className = "",
  strong = false,
}: {
  children: ReactNode;
  className?: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`${strong ? "glass-strong" : "glass"} rounded-3xl ${className}`}
    >
      {children}
    </div>
  );
}

/* ── HelpTooltip: keyboard-focusable, ARIA-described ───────────────────────── */
export function HelpTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label="More information"
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="ml-1 grid h-4 w-4 place-items-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-800 hover:bg-brand-200"
      >
        i
      </button>
      <AnimatePresence>
        {open && (
          <motion.span
            id={id}
            role="tooltip"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute bottom-full left-1/2 z-30 mb-2 w-56 -translate-x-1/2 rounded-xl bg-ink-900 px-3 py-2 text-xs leading-snug text-white shadow-xl"
          >
            {text}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

/* ── Select ─────────────────────────────────────────────────────────────────── */
export function Select({
  label,
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled = false,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1 block text-xs font-medium text-ink-700">{label}</span>
      )}
      <select
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-ink-900 shadow-sm transition focus:border-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ── Chip ───────────────────────────────────────────────────────────────────── */
export function Chip({
  children,
  onRemove,
  tone = "brand",
}: {
  children: ReactNode;
  onRemove?: () => void;
  tone?: "brand" | "amber" | "rose" | "slate";
}) {
  const tones: Record<string, string> = {
    brand: "bg-brand-50 text-brand-800 border-brand-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    slate: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return (
    <motion.span
      layout
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${tones[tone]}`}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove"
          className="grid h-4 w-4 place-items-center rounded-full text-current/70 hover:bg-black/10"
        >
          ×
        </button>
      )}
    </motion.span>
  );
}

/* ── SectionTitle ──────────────────────────────────────────────────────────── */
export function SectionTitle({
  step,
  title,
  subtitle,
}: {
  step?: number;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      {step !== undefined && (
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">
          {step}
        </span>
      )}
      <div>
        <h3 className="text-lg font-semibold text-ink-900">{title}</h3>
        {subtitle && <p className="text-sm text-ink-500">{subtitle}</p>}
      </div>
    </div>
  );
}
