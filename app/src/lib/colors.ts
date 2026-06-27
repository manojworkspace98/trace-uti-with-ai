import type { Drug } from "./types";

// Colour-blind-safe, WCAG-AA drug tokens reused across every chart.
export const DRUG_COLOR: Record<Drug, string> = {
  NIT: "#0d9488", // teal-green
  SXT: "#4f46e5", // indigo
  CIP: "#d97706", // amber
  LVX: "#b45309", // dark amber
};

export const CLASS_COLOR = ["#0d9488", "#4f46e5", "#d97706"]; // NIT / SXT / FQ

/** Risk colour ramp green→amber→red for a resistance probability. */
export function riskColor(p: number): string {
  if (p < 0.2) return "#15803d";
  if (p < 0.4) return "#65a30d";
  if (p < 0.6) return "#d97706";
  return "#be123c";
}
