"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, ChevronLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatCompact } from "@/lib/utils";
import { getTargetSummary } from "@/actions/expenses";
import type { ExpenseAccount, TargetScope, TargetSummaryRow } from "@/lib/types";
import { BucketDetail } from "./bucket-detail";

interface TargetsViewProps {
  accounts: ExpenseAccount[];
  financialYear: string;
}

const SCOPE_LABEL: Record<TargetScope, string> = {
  all: "All-time",
  fy: "Financial Year",
  month: "This Month",
};

function defaultRef(scope: TargetScope, fy: string): string {
  if (scope === "fy") return fy;
  if (scope === "month") {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  return "all";
}

function fyShift(fy: string, delta: number): string {
  const [a, b] = fy.split("-").map(Number);
  return `${a + delta}-${String((b + delta) % 100).padStart(2, "0")}`;
}

function monthShift(ref: string, delta: number): string {
  const [y, m] = ref.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(ref: string): string {
  const [y, m] = ref.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function TargetsView({ financialYear }: TargetsViewProps) {
  const [scope, setScope] = useState<TargetScope>("month");
  const [ref, setRef] = useState<string>(defaultRef("month", financialYear));
  const [rows, setRows] = useState<TargetSummaryRow[] | null>(null);
  const [loading, startTransition] = useTransition();
  const [expandedExpenses, setExpandedExpenses] = useState(true);
  const [openTargetId, setOpenTargetId] = useState<number | null>(null);

  useEffect(() => {
    startTransition(async () => {
      const r = await getTargetSummary(scope, ref);
      setRows(r);
    });
  }, [scope, ref]);

  function changeScope(next: TargetScope) {
    setScope(next);
    setRef(defaultRef(next, financialYear));
    setOpenTargetId(null);
  }

  const tree = useMemo(() => {
    if (!rows) return null;
    const byParent = new Map<number | null, TargetSummaryRow[]>();
    for (const r of rows) {
      const key = r.parentTargetId ?? null;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(r);
    }
    return byParent;
  }, [rows]);

  const ORDER = ["Savings", "Investments", "Expenses"];
  const topLevel = tree?.get(null)?.sort((a, b) => {
    const ia = ORDER.indexOf(a.name);
    const ib = ORDER.indexOf(b.name);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  }) ?? [];

  const totalDenom = topLevel.reduce((s, t) => s + t.actualAmount, 0);

  return (
    <div className="space-y-4">
      {/* Header + scope toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Targets</h2>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border bg-muted/30 p-0.5">
            {(["all", "fy", "month"] as TargetScope[]).map((s) => (
              <button
                key={s}
                onClick={() => changeScope(s)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded transition-colors",
                  scope === s ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {SCOPE_LABEL[s]}
              </button>
            ))}
          </div>

          {scope === "fy" && (
            <div className="inline-flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7" aria-label="Previous financial year" disabled={loading} onClick={() => setRef(fyShift(ref, -1))}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs font-medium tabular-nums px-1.5 w-20 text-center">FY {ref}</span>
              <Button variant="outline" size="icon" className="h-7 w-7" aria-label="Next financial year" disabled={loading} onClick={() => setRef(fyShift(ref, 1))}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          {scope === "month" && (
            <div className="inline-flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7" aria-label="Previous month" disabled={loading} onClick={() => setRef(monthShift(ref, -1))}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs font-medium tabular-nums px-1.5 w-32 text-center">{monthLabel(ref)}</span>
              <Button variant="outline" size="icon" className="h-7 w-7" aria-label="Next month" disabled={loading} onClick={() => setRef(monthShift(ref, 1))}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Percentages are share of total outflow ({formatCurrency(totalDenom)} in scope) — Tax excluded.
        {loading && " · refreshing…"}
      </p>

      {!rows && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i}><CardContent className="p-4 h-32 animate-pulse bg-muted/40" /></Card>
          ))}
        </div>
      )}

      {rows && topLevel.length === 0 && (
        <p className="text-sm text-muted-foreground py-12 text-center">No targets configured.</p>
      )}

      {rows && (
        <div className="grid gap-3 sm:grid-cols-3">
          {topLevel.map((t) => (
            <TopLevelCard
              key={t.id}
              row={t}
              onOpen={() => setOpenTargetId(t.id)}
              onToggleChildren={t.name === "Expenses" ? () => setExpandedExpenses((v) => !v) : undefined}
              childrenExpanded={t.name === "Expenses" ? expandedExpenses : undefined}
            />
          ))}
        </div>
      )}

      {/* Children of Expenses */}
      {rows && expandedExpenses && (() => {
        const expenses = topLevel.find((t) => t.name === "Expenses");
        if (!expenses) return null;
        const subOrder = ["Essential", "Discretionary", "Guilt-Free Splurge"];
        const children = (tree?.get(expenses.id) ?? []).sort((a, b) => {
          const ia = subOrder.indexOf(a.name);
          const ib = subOrder.indexOf(b.name);
          return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        });
        if (!children.length) return null;
        return (
          <div className="ml-0 sm:ml-4 grid gap-3 sm:grid-cols-3">
            {children.map((c) => (
              <SubLevelCard key={c.id} row={c} onOpen={() => setOpenTargetId(c.id)} />
            ))}
          </div>
        );
      })()}

      {openTargetId != null && (
        <BucketDetail
          targetId={openTargetId}
          scope={scope}
          scopeRef={ref}
          onClose={() => setOpenTargetId(null)}
        />
      )}
    </div>
  );
}

function progressColor(actual: number, target: number | null): string {
  if (target == null) return "bg-sky-500";
  if (target === 0) return "bg-sky-500";
  const ratio = actual / target;
  if (ratio >= 0.9 && ratio <= 1.1) return "bg-emerald-500";
  if (ratio >= 0.7 && ratio <= 1.3) return "bg-amber-400";
  return "bg-rose-400";
}

function TopLevelCard({
  row,
  onOpen,
  onToggleChildren,
  childrenExpanded,
}: {
  row: TargetSummaryRow;
  onOpen: () => void;
  onToggleChildren?: () => void;
  childrenExpanded?: boolean;
}) {
  const pctActual = row.actualPercentage;
  const pctTarget = row.percentageTarget;
  const color = progressColor(pctActual, pctTarget);
  return (
    <Card className="transition-shadow hover:shadow-md cursor-pointer" onClick={onOpen}>
      <CardContent className="p-4 space-y-2.5">
        <div className="flex items-baseline justify-between">
          <div className="flex items-center gap-1.5">
            <h3 className="font-semibold text-sm">{row.name}</h3>
            {onToggleChildren && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleChildren(); }}
                className="text-muted-foreground hover:text-foreground"
                aria-label={childrenExpanded ? "Collapse sub-buckets" : "Expand sub-buckets"}
              >
                {childrenExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            )}
          </div>
          <div className="text-right">
            <div className="text-xl font-bold tabular-nums leading-none">{pctActual.toFixed(1)}%</div>
            {pctTarget != null && (
              <div className="text-[10px] text-muted-foreground tabular-nums mt-0.5">target {pctTarget.toFixed(0)}%</div>
            )}
          </div>
        </div>

        <div className="h-2.5 rounded-full bg-muted overflow-hidden relative">
          <div className={cn("h-full transition-all", color)} style={{ width: `${Math.min(pctActual, 100)}%` }} />
          {pctTarget != null && pctTarget > 0 && (
            <div className="absolute top-0 bottom-0 w-0.5 bg-foreground/40" style={{ left: `${Math.min(pctTarget, 100)}%` }} title={`target ${pctTarget}%`} />
          )}
        </div>

        <div className="flex items-baseline justify-between text-xs">
          <span className="tabular-nums font-medium">{formatCurrency(row.actualAmount)}</span>
          <span className="text-muted-foreground">of {formatCompact(row.denominatorAmount)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function SubLevelCard({ row, onOpen }: { row: TargetSummaryRow; onOpen: () => void }) {
  const pctActual = row.actualPercentage;
  const pctTarget = row.percentageTarget;
  const color = progressColor(pctActual, pctTarget);
  return (
    <Card className="transition-shadow hover:shadow-md cursor-pointer bg-muted/20" onClick={onOpen}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-baseline justify-between">
          <h4 className="text-xs font-medium">{row.name}</h4>
          <div className="text-right">
            <div className="text-base font-bold tabular-nums leading-none">{pctActual.toFixed(1)}%</div>
            {pctTarget != null && (
              <div className="text-[9px] text-muted-foreground tabular-nums mt-0.5">target {pctTarget.toFixed(0)}% of Expenses</div>
            )}
          </div>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden relative">
          <div className={cn("h-full transition-all", color)} style={{ width: `${Math.min(pctActual, 100)}%` }} />
          {pctTarget != null && pctTarget > 0 && (
            <div className="absolute top-0 bottom-0 w-0.5 bg-foreground/40" style={{ left: `${Math.min(pctTarget, 100)}%` }} />
          )}
        </div>
        <div className="text-[11px] tabular-nums text-muted-foreground">{formatCurrency(row.actualAmount)} of {formatCompact(row.denominatorAmount)}</div>
      </CardContent>
    </Card>
  );
}
