"use client";

import { useState, useCallback } from "react";
import { ChevronLeft } from "lucide-react";
import { PieChart, Pie as RechartsPie, Cell, Sector, ResponsiveContainer } from "recharts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Pie = RechartsPie as any;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderActiveShape(props: any) {
  const {
    cx, cy, midAngle, innerRadius, outerRadius,
    startAngle, endAngle, fill, payload, percent,
  } = props;
  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);

  // Exploded slice
  const ex = cx + 5 * cos;
  const ey = cy + 5 * sin;

  // Label line
  const mx = cx + (outerRadius + 18) * cos;
  const my = cy + (outerRadius + 18) * sin;
  const lx = cx + (outerRadius + 38) * cos;
  const ly = cy + (outerRadius + 38) * sin;
  const textAnchor = cos >= 0 ? "start" : "end";
  const pct = ((percent ?? 0) * 100);
  const pctStr = pct < 1 ? pct.toFixed(1) : Math.round(pct).toString();

  return (
    <g>
      {/* Exploded main slice */}
      <Sector cx={ex} cy={ey} innerRadius={innerRadius} outerRadius={outerRadius + 4} startAngle={startAngle} endAngle={endAngle} fill={fill} />
      {/* Outer ring highlight */}
      <Sector cx={ex} cy={ey} innerRadius={outerRadius + 6} outerRadius={outerRadius + 9} startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={0.25} />
      {/* Connector line */}
      <path d={`M${cx + outerRadius * cos},${cy + outerRadius * sin}L${mx},${my}L${lx},${ly}`} stroke={fill} strokeWidth={1} fill="none" />
      <circle cx={mx} cy={my} r={2} fill={fill} />
      {/* Label */}
      <text x={lx + (cos >= 0 ? 4 : -4)} y={ly - 2} textAnchor={textAnchor} className="fill-foreground" fontSize={11} fontWeight={700}>
        {payload.name}
      </text>
      <text x={lx + (cos >= 0 ? 4 : -4)} y={ly + 12} textAnchor={textAnchor} className="fill-muted-foreground" fontSize={10}>
        {formatCurrency(payload.value)} ({pctStr}%)
      </text>
    </g>
  );
}

export function CategoryPieChart({ data, title, onCategoryClick }: CategoryPieChartProps) {
  const [drillDown, setDrillDown] = useState<{ parent: PieDataItem; subData: PieDataItem[] } | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | undefined>(undefined);

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
      setHoveredIdx(undefined);
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
      setHoveredIdx(undefined);
    } else {
      onCategoryClick?.(item.id);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onPieEnter = useCallback((_: any, index: number) => {
    setHoveredIdx(index);
  }, []);

  const onPieLeave = useCallback(() => {
    setHoveredIdx(undefined);
  }, []);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          {drillDown && (
            <button
              type="button"
              onClick={() => { setDrillDown(null); setHoveredIdx(undefined); }}
              className="rounded-md p-1 hover:bg-muted transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <CardTitle className="text-base">{activeTitle}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <ResponsiveContainer width="100%" height={360}>
          <PieChart>
            <Pie
              data={activeData}
              cx="50%"
              cy="50%"
              outerRadius={120}
              dataKey="value"
              nameKey="name"
              paddingAngle={1}
              strokeWidth={1.5}
              stroke="rgba(255,255,255,0.7)"
              onClick={(_: any, idx: number) => handlePieClick(idx)}
              onMouseEnter={onPieEnter}
              onMouseLeave={onPieLeave}
              activeIndex={hoveredIdx}
              activeShape={renderActiveShape}
              style={{ cursor: "pointer", outline: "none" }}
              isAnimationActive={false}
            >
              {activeData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                  opacity={hoveredIdx !== undefined && hoveredIdx !== index ? 0.45 : 1}
                  style={{ transition: "opacity 0.15s", outline: "none" }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

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
                onMouseLeave={() => setHoveredIdx(undefined)}
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
                      setHoveredIdx(undefined);
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
