"use client";

import { useState, useMemo } from "react";
import { ChevronLeft } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

const DEFAULT_COLORS = [
  "#6366f1", "#f43f5e", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#3b82f6", "#84cc16",
];

interface SubCategory {
  id: number;
  name: string;
  amount: number;
  percentage: number;
  color: string | null;
}

interface PieDataItem {
  id: number;
  name: string;
  value: number;
  color: string | null;
  subCategories?: SubCategory[];
}

interface CategoryPieChartProps {
  data: PieDataItem[];
  title: string;
  onCategoryClick?: (id: number) => void;
}

const RADIAN = Math.PI / 180;
const LABEL_LINE_HEIGHT = 18;

interface SliceInfo {
  startAngle: number;
  endAngle: number;
  midAngle: number;
  color: string;
  name: string;
  pct: string;
  index: number;
}

function computeSlices(data: PieDataItem[], total: number): SliceInfo[] {
  const slices: SliceInfo[] = [];
  let currentAngle = 90; // start from top
  for (let i = 0; i < data.length; i++) {
    const pctNum = total > 0 ? (data[i].value / total) * 100 : 0;
    const sweep = (data[i].value / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sweep;
    const midAngle = startAngle + sweep / 2;
    slices.push({
      startAngle,
      endAngle,
      midAngle,
      color: data[i].color || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
      name: data[i].name,
      pct: pctNum < 1 ? pctNum.toFixed(1) : Math.round(pctNum).toString(),
      index: i,
    });
    currentAngle = endAngle;
  }
  return slices;
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = {
    x: cx + r * Math.cos(-startAngle * RADIAN),
    y: cy + r * Math.sin(-startAngle * RADIAN),
  };
  const end = {
    x: cx + r * Math.cos(-endAngle * RADIAN),
    y: cy + r * Math.sin(-endAngle * RADIAN),
  };
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function describeSlice(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = {
    x: cx + r * Math.cos(-startAngle * RADIAN),
    y: cy + r * Math.sin(-startAngle * RADIAN),
  };
  const end = {
    x: cx + r * Math.cos(-endAngle * RADIAN),
    y: cy + r * Math.sin(-endAngle * RADIAN),
  };
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

/** Distribute labels evenly on each side to prevent overlap */
function distributeLabels(
  slices: SliceInfo[],
  cx: number,
  cy: number,
  outerR: number,
  chartHeight: number,
): { slice: SliceInfo; labelX: number; labelY: number; edgeX: number; edgeY: number; anchor: "start" | "end" }[] {
  const labelR = outerR + 14;
  const textR = outerR + 40;

  // Compute natural positions
  const items = slices.map((s) => {
    const cos = Math.cos(-s.midAngle * RADIAN);
    const sin = Math.sin(-s.midAngle * RADIAN);
    const side: "left" | "right" = cos >= 0 ? "right" : "left";
    return {
      slice: s,
      edgeX: cx + labelR * cos,
      edgeY: cy + labelR * sin,
      naturalY: cy + labelR * sin,
      side,
    };
  });

  // Separate by side and sort by naturalY
  const right = items.filter((i) => i.side === "right").sort((a, b) => a.naturalY - b.naturalY);
  const left = items.filter((i) => i.side === "left").sort((a, b) => a.naturalY - b.naturalY);

  // Spread labels to avoid overlap on each side
  function spread(group: typeof right) {
    if (group.length === 0) return;
    // First pass: push down
    for (let i = 1; i < group.length; i++) {
      const prev = group[i - 1];
      const curr = group[i];
      if (curr.naturalY - prev.naturalY < LABEL_LINE_HEIGHT) {
        curr.naturalY = prev.naturalY + LABEL_LINE_HEIGHT;
      }
    }
    // Second pass: pull up if exceeding bounds
    const maxY = cy + chartHeight / 2 - 10;
    if (group[group.length - 1].naturalY > maxY) {
      group[group.length - 1].naturalY = maxY;
      for (let i = group.length - 2; i >= 0; i--) {
        if (group[i].naturalY > group[i + 1].naturalY - LABEL_LINE_HEIGHT) {
          group[i].naturalY = group[i + 1].naturalY - LABEL_LINE_HEIGHT;
        }
      }
    }
  }

  spread(right);
  spread(left);

  return [...right, ...left].map((item) => ({
    slice: item.slice,
    labelX: item.side === "right" ? cx + textR : cx - textR,
    labelY: item.naturalY,
    edgeX: item.edgeX,
    edgeY: item.edgeY,
    anchor: item.side === "right" ? "start" as const : "end" as const,
  }));
}

function CustomPieChart({
  data,
  hoveredIdx,
  onHover,
  onClick,
}: {
  data: PieDataItem[];
  hoveredIdx: number | null;
  onHover: (idx: number | null) => void;
  onClick: (idx: number) => void;
}) {
  const width = 500;
  const height = 400;
  const cx = width / 2;
  const cy = height / 2;
  const outerR = 120;
  const total = data.reduce((s, d) => s + d.value, 0);

  const slices = useMemo(() => computeSlices(data, total), [data, total]);
  const labels = useMemo(() => distributeLabels(slices, cx, cy, outerR, height), [slices, cx, cy, height]);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: 400 }}>
      {/* Pie slices */}
      {slices.map((s, i) => {
        const isHovered = hoveredIdx === i;
        const isDimmed = hoveredIdx !== null && hoveredIdx !== i;
        // Slightly explode hovered slice
        const offset = isHovered ? 6 : 0;
        const ox = offset * Math.cos(-s.midAngle * RADIAN);
        const oy = offset * Math.sin(-s.midAngle * RADIAN);
        return (
          <path
            key={`slice-${i}`}
            d={describeSlice(cx + ox, cy + oy, outerR, s.startAngle, s.endAngle)}
            fill={s.color}
            opacity={isDimmed ? 0.4 : 1}
            stroke="rgba(255,255,255,0.7)"
            strokeWidth={1.5}
            style={{ cursor: "pointer", transition: "opacity 0.15s" }}
            onMouseEnter={() => onHover(i)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onClick(i)}
          />
        );
      })}

      {/* Labels with connector lines */}
      {labels.map((l) => {
        const isDimmed = hoveredIdx !== null && hoveredIdx !== l.slice.index;
        const truncated = l.slice.name.length > 12 ? l.slice.name.slice(0, 11) + "…" : l.slice.name;
        return (
          <g key={`label-${l.slice.index}`} opacity={isDimmed ? 0.3 : 1} style={{ transition: "opacity 0.15s" }}>
            {/* Connector line */}
            <line
              x1={l.edgeX}
              y1={l.edgeY}
              x2={l.labelX}
              y2={l.labelY}
              stroke={l.slice.color}
              strokeWidth={0.8}
              strokeOpacity={0.6}
            />
            <circle cx={l.edgeX} cy={l.edgeY} r={2} fill={l.slice.color} />
            {/* Label text */}
            <text
              x={l.labelX}
              y={l.labelY}
              textAnchor={l.anchor}
              dominantBaseline="central"
              className="fill-foreground"
              fontSize={11}
              fontWeight={600}
              style={{ cursor: "pointer" }}
              onMouseEnter={() => onHover(l.slice.index)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onClick(l.slice.index)}
            >
              {truncated}
            </text>
            <text
              x={l.labelX}
              y={l.labelY + 13}
              textAnchor={l.anchor}
              dominantBaseline="central"
              className="fill-muted-foreground"
              fontSize={10}
              fontWeight={400}
            >
              {l.slice.pct} %
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function CategoryPieChart({ data, title, onCategoryClick }: CategoryPieChartProps) {
  const [drillDown, setDrillDown] = useState<{ parent: PieDataItem; subData: PieDataItem[] } | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
        <CardContent>
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            No data yet
          </div>
        </CardContent>
      </Card>
    );
  }

  const activeData = drillDown ? drillDown.subData : data;
  const activeTitle = drillDown ? `${drillDown.parent.name} breakdown` : title;
  const total = activeData.reduce((s, d) => s + d.value, 0);

  function handlePieClick(idx: number) {
    if (drillDown) {
      onCategoryClick?.(activeData[idx].id);
      return;
    }
    const item = data[idx];
    if (item.subCategories && item.subCategories.length > 0) {
      setDrillDown({
        parent: item,
        subData: item.subCategories.map(sc => ({
          id: sc.id, name: sc.name, value: sc.amount, color: sc.color,
        })),
      });
      setHoveredIdx(null);
    } else {
      onCategoryClick?.(item.id);
    }
  }

  function handleListItemClick(item: PieDataItem) {
    if (!drillDown && item.subCategories && item.subCategories.length > 0) {
      setDrillDown({
        parent: item,
        subData: item.subCategories.map(sc => ({
          id: sc.id, name: sc.name, value: sc.amount, color: sc.color,
        })),
      });
      setHoveredIdx(null);
    } else {
      onCategoryClick?.(item.id);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          {drillDown && (
            <button
              type="button"
              onClick={() => { setDrillDown(null); setHoveredIdx(null); }}
              className="rounded-md p-1 hover:bg-muted transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <CardTitle className="text-base">{activeTitle}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <CustomPieChart
          data={activeData}
          hoveredIdx={hoveredIdx}
          onHover={setHoveredIdx}
          onClick={handlePieClick}
        />

        {/* Category list */}
        <div className="space-y-1 mt-2">
          {activeData.map((item, idx) => {
            const pct = total > 0 ? (item.value / total * 100) : 0;
            const pctStr = pct < 1 ? pct.toFixed(1) : Math.round(pct).toString();
            const color = item.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
            const hasSubCats = !drillDown && item.subCategories && item.subCategories.length > 0;
            const isHovered = hoveredIdx === idx;
            return (
              <div
                key={`${item.name}-${idx}`}
                className={`flex items-center gap-3 cursor-pointer rounded-lg px-2 py-1.5 transition-colors ${isHovered ? "bg-muted" : "hover:bg-muted/50"}`}
                onClick={() => handleListItemClick(item)}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <span
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white shrink-0"
                  style={{ backgroundColor: color }}
                >
                  {pctStr}%
                </span>
                <span className="flex-1 text-sm font-medium truncate">{item.name}</span>
                {hasSubCats && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDrillDown({
                        parent: item,
                        subData: item.subCategories!.map(sc => ({
                          id: sc.id, name: sc.name, value: sc.amount, color: sc.color,
                        })),
                      });
                      setHoveredIdx(null);
                    }}
                    className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded border border-border/50 hover:border-border transition-colors"
                  >
                    split
                  </button>
                )}
                <span className="text-sm font-semibold tabular-nums">{formatCurrency(item.value)}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
