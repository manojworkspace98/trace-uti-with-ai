import { animate, motion, useMotionValue, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * Rolls a number up from 0 to `value` on mount (i.e. every page load / tab
 * switch). Respects prefers-reduced-motion. `format` controls display.
 */
export function CountUp({
  value,
  duration = 1.2,
  decimals = 0,
  prefix = "",
  suffix = "",
  format,
}: {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  format?: (n: number) => string;
}) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(0);
  const [display, setDisplay] = useState(() =>
    fmt(0, decimals, prefix, suffix, format),
  );

  useEffect(() => {
    if (reduce) {
      setDisplay(fmt(value, decimals, prefix, suffix, format));
      return;
    }
    const controls = animate(mv, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(fmt(v, decimals, prefix, suffix, format)),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <motion.span>{display}</motion.span>;
}

function fmt(
  n: number,
  decimals: number,
  prefix: string,
  suffix: string,
  format?: (n: number) => string,
): string {
  if (format) return format(n);
  return `${prefix}${n.toFixed(decimals)}${suffix}`;
}

export const withCommas = (n: number) => Math.round(n).toLocaleString();
