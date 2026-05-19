"use client";

import { useEffect, useState, useTransition } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, formatCompact, formatDate, cn } from "@/lib/utils";
import { getTargetBreakdown, getTargetTransactions } from "@/actions/expenses";
import type { TargetScope, TargetTrendPoint, TargetTransactionRow } from "@/lib/types";

const DEFAULT_COLORS = [
  "#6366f1", "#f43f5e", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#3b82f6", "#84cc16",
];

interface BucketDetailProps {
  targetId: number;
  scope: TargetScope;
  scopeRef: string;
  onClose: () => void;
}

export function BucketDetail({ targetId, scope, scopeRef, onClose }: BucketDetailProps) {
  const [breakdown, setBreakdown] = useState<{
    points: TargetTrendPoint[];
    accountSplit: { id: number; name: string; amount: number; color: string | null }[];
    totalAmount: number;
    totalDenominator: number;
  } | null>(null);
  const [txns, setTxns] = useState<TargetTransactionRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [, startTransition] = useTransition();
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    startTransition(async () => {
      const b = await getTargetBreakdown(targetId, scope, scopeRef);
      setBreakdown(b);
    });
  }, [targetId, scope, scopeRef]);

  useEffect(() => {
    startTransition(async () => {
      const t = await getTargetTransactions(targetId, scope, scopeRef, { limit: PAGE_SIZE, offset: page * PAGE_SIZE });
      setTxns(t.rows);
      setTotal(t.total);
    });
  }, [targetId, scope, scopeRef, page]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bucket details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Stat label="In-scope total" value={breakdown ? formatCurrency(breakdown.totalAmount) : "—"} />
            <Stat label="Share of outflow" value={breakdown && breakdown.totalDenominator > 0 ? `${(breakdown.totalAmount / breakdown.totalDenominator * 100).toFixed(1)}%` : "—"} />
            <Stat label="Transactions" value={String(total)} />
          </div>

          {/* Monthly line chart */}
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Monthly trend</p>
            {!breakdown && <div className="h-56 animate-pulse bg-muted/40 rounded" />}
            {breakdown && breakdown.points.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">No data in this window.</p>
            )}
            {breakdown && breakdown.points.length > 0 && (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={breakdown.points} margin={{ top: 20, right: 25, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => formatCompact(v)} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={50} />
                  <Tooltip
                    formatter={(value, name) => {
                      const num = typeof value === "number" ? value : 0;
                      if (name === "amount") return [formatCurrency(num), "Amount"];
                      if (name === "percentage") return [`${num}%`, "Share"];
                      return [String(value), String(name)];
                    }}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#6366f1", strokeWidth: 0 }}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </section>

          {/* Account split */}
          {breakdown && breakdown.accountSplit.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Account split</p>
              <div className="space-y-1.5">
                {breakdown.accountSplit.map((acc, idx) => {
                  const pct = breakdown.totalAmount > 0 ? Math.round((acc.amount / breakdown.totalAmount) * 100) : 0;
                  const color = acc.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
                  return (
                    <div key={acc.id} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="flex-1 text-xs truncate">{acc.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">{pct}%</span>
                      <span className="text-xs font-medium tabular-nums w-24 text-right">{formatCurrency(acc.amount)}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Transactions */}
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Transactions ({total})</p>
            {!txns && <div className="h-32 animate-pulse bg-muted/40 rounded" />}
            {txns && txns.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">No transactions.</p>}
            {txns && txns.length > 0 && (
              <>
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs text-muted-foreground">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium w-24">Date</th>
                        <th className="text-left px-3 py-2 font-medium">Category / Account</th>
                        <th className="text-left px-3 py-2 font-medium">Note</th>
                        <th className="text-right px-3 py-2 font-medium w-28">Amount</th>
                        <th className="text-left px-3 py-2 font-medium w-20">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {txns.map((t) => (
                        <tr key={t.id} className="border-t">
                          <td className="px-3 py-2 tabular-nums text-xs">{formatDate(t.date)}</td>
                          <td className="px-3 py-2 text-xs">
                            <span className="font-medium">{t.categoryName ?? t.accountName ?? "—"}</span>
                            {t.accountName && t.categoryName && (
                              <span className="text-muted-foreground"> · {t.accountName}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground line-clamp-1">{t.note ?? ""}</td>
                          <td className="px-3 py-2 text-xs tabular-nums text-right font-medium">{formatCurrency(t.amount)}</td>
                          <td className="px-3 py-2 text-[10px]">
                            <span className={cn(
                              "px-1.5 py-0.5 rounded",
                              t.type === "expense" && "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
                              t.type === "transfer" && "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
                              t.type === "income" && "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
                            )}>{t.type}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {total > PAGE_SIZE && (
                  <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
                    <span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="px-2 py-1 rounded border disabled:opacity-40"
                      >Prev</button>
                      <button
                        onClick={() => setPage((p) => p + 1)}
                        disabled={(page + 1) * PAGE_SIZE >= total}
                        className="px-2 py-1 rounded border disabled:opacity-40"
                      >Next</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className="text-base font-bold tabular-nums">{value}</p>
    </div>
  );
}
