import { sankey, sankeyLinkHorizontal, type SankeyGraph } from "d3-sankey";
import { motion } from "framer-motion";
import { useMemo } from "react";
import type { Prediction, Schema } from "../lib/types";
import { DRUG_COLOR } from "../lib/colors";

interface N {
  name: string;
  color: string;
}
interface L {
  source: number;
  target: number;
  value: number;
}

/**
 * Honest flow diagram: an "Assessment" source flows to each candidate drug with
 * width proportional to its predicted SUSCEPTIBILITY, and the recommended drug
 * flows on to a "Recommended" sink. Wider = more likely effective.
 */
export function ClassSankey({
  schema,
  prediction,
}: {
  schema: Schema;
  prediction: Prediction;
}) {
  const W = 460,
    H = 200;

  const graph = useMemo(() => {
    const nodes: N[] = [{ name: "Assessment", color: "#0e7490" }];
    const drugIndex: Record<string, number> = {};
    schema.drugs.forEach((d) => {
      drugIndex[d] = nodes.length;
      nodes.push({ name: schema.drug_info[d].name, color: DRUG_COLOR[d] });
    });
    const recIdx = nodes.length;
    nodes.push({ name: "Recommended", color: "#15803d" });

    const links: L[] = [];
    for (const d of schema.drugs) {
      const suscept = Math.max(1 - prediction.perDrug[d].pResistant, 0.02);
      links.push({ source: 0, target: drugIndex[d], value: +(suscept * 100).toFixed(1) });
    }
    if (prediction.recommendation) {
      const d = prediction.recommendation;
      links.push({
        source: drugIndex[d],
        target: recIdx,
        value: +(Math.max(1 - prediction.perDrug[d].pResistant, 0.02) * 100).toFixed(1),
      });
    }
    const sk = sankey<N, L>()
      .nodeWidth(14)
      .nodePadding(12)
      .extent([
        [4, 6],
        [W - 4, H - 6],
      ]);
    return sk({
      nodes: nodes.map((d) => ({ ...d })),
      links: links.map((d) => ({ ...d })),
    } as SankeyGraph<N, L>);
  }, [schema, prediction]);

  const linkPath = sankeyLinkHorizontal();

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 360 }}>
        {graph.links.map((l, i) => (
          <motion.path
            key={i}
            d={linkPath(l) ?? undefined}
            fill="none"
            stroke={(l.target as unknown as N).color}
            strokeOpacity={0.32}
            strokeWidth={Math.max(1, l.width ?? 1)}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.8, delay: i * 0.06 }}
          />
        ))}
        {graph.nodes.map((n, i) => (
          <g key={i}>
            <rect
              x={n.x0}
              y={n.y0}
              width={(n.x1 ?? 0) - (n.x0 ?? 0)}
              height={Math.max(2, (n.y1 ?? 0) - (n.y0 ?? 0))}
              rx={3}
              fill={(n as unknown as N).color}
            />
            <text
              x={(n.x0 ?? 0) < W / 2 ? (n.x1 ?? 0) + 5 : (n.x0 ?? 0) - 5}
              y={((n.y0 ?? 0) + (n.y1 ?? 0)) / 2}
              dy="0.35em"
              textAnchor={(n.x0 ?? 0) < W / 2 ? "start" : "end"}
              className="fill-ink-700 text-[9px] font-medium"
            >
              {(n as unknown as N).name}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
