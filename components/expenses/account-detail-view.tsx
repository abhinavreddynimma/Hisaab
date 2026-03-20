"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, XAxis, ResponsiveContainer, Tooltip, ReferenceLine, Label } from "recharts";
import { formatCurrency, formatDate } from "@/lib/utils";
import { EXPENSE_ACCOUNT_TYPES } from "@/lib/constants";
import { CategoryPieChart } from "./category-pie-chart";
import type { ExpenseAccount, ExpenseTransaction, ExpenseBudget, ExpenseTarget, ExpenseAccountType } from "@/lib/types";

function fmtCompact(v: number): string {
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}k`;
  return `₹${v.toFixed(0)}`;
}

interface AccountDetailViewProps {
  drillDown: {
    account: ExpenseAccount | null;
    transactions: ExpenseTransaction[];
    monthlyTrend: { month: string; amount: number }[];
    totalAmount: number;
    subCategoryBreakdown: { id: number; name: string; amount: number; color: string | null }[];
  };
  budgets: (ExpenseBudget & { categoryIds: number[]; categoryNames: string[]; spent: number })[];
  targets: (ExpenseTarget & { accountIds?: number[]; accountNames?: string[] })[];
  financialYear: string;
}

export function AccountDetailView({ drillDown, budgets, targets }: AccountDetailViewProps) {
  const router = useRouter();
  const { account, transactions, monthlyTrend, totalAmount } = drillDown;

  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-muted-foreground">Account not found</p>
        <Button variant="link" onClick={() => router.push("/expenses")}>Back to Expenses</Button>
      </div>
    );
  }

  const typeConfig = EXPENSE_ACCOUNT_TYPES[account.type as ExpenseAccountType];
  const linkedBudget = budgets.find(b => b.categoryIds.includes(account.id));
  const linkedTarget = targets.find(t => t.accountIds?.includes(account.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{account.name}</h1>
          <Badge variant="outline" style={{ borderColor: typeConfig?.color, color: typeConfig?.color }}>
            {typeConfig?.label}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">FY Total</p>
            <p className="text-lg font-bold tabular-nums">{formatCurrency(totalAmount)}</p>
          </CardContent>
        </Card>
        {linkedBudget && (
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Budget</p>
              <p className="text-lg font-bold tabular-nums">{formatCurrency(linkedBudget.spent)} / {formatCurrency(linkedBudget.monthlyAmount)}</p>
              <p className={`text-xs ${linkedBudget.spent > linkedBudget.monthlyAmount ? "text-red-600" : "text-emerald-600"}`}>
                {formatCurrency(Math.abs(linkedBudget.monthlyAmount - linkedBudget.spent))} {linkedBudget.spent > linkedBudget.monthlyAmount ? "over" : "remaining"}
              </p>
            </CardContent>
          </Card>
        )}
        {linkedTarget && (
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Target</p>
              <p className="text-lg font-bold tabular-nums">{formatCurrency(linkedTarget.thisMonthActual ?? 0)} / {formatCurrency(linkedTarget.monthlyAmount)}</p>
              <p className="text-xs text-muted-foreground">FY avg: {formatCurrency(linkedTarget.fyAverage ?? 0)}/mo</p>
            </CardContent>
          </Card>
        )}
      </div>

      {monthlyTrend.some(m => m.amount > 0) && (() => {
        const nonZeroMonths = monthlyTrend.filter(m => m.amount > 0);
        const monthlyAvg = nonZeroMonths.length > 0 ? nonZeroMonths.reduce((s, m) => s + m.amount, 0) / nonZeroMonths.length : 0;
        const budgetAmount = linkedBudget?.monthlyAmount;
        const targetAmount = linkedTarget?.monthlyAmount;
        const lineColor = typeConfig?.color || "#f97316";

        // Custom label on dots
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const renderDotLabel = (props: any) => {
          const { x, y, value } = props;
          if (!value || value === 0) return null;
          const label = value >= 100000 ? `${(value / 100000).toFixed(1)}L` : value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toString();
          return (
            <text x={x} y={y - 12} textAnchor="middle" className="fill-foreground" fontSize={10} fontWeight={600}>
              {label}
            </text>
          );
        };

        return (
        <Card>
          <CardHeader><CardTitle className="text-base">Monthly Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthlyTrend} margin={{ top: 20, right: 10, left: 10, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value: number | undefined) => [formatCurrency(value ?? 0), "Amount"]} contentStyle={{ borderRadius: 12, fontSize: 13 }} />

                {/* Monthly average line */}
                {monthlyAvg > 0 && (
                  <ReferenceLine y={monthlyAvg} stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={1}>
                    <Label value={`avg ${fmtCompact(monthlyAvg)}`} position="insideTopRight" className="fill-muted-foreground" fontSize={9} dy={-2} />
                  </ReferenceLine>
                )}

                {/* Budget line (for expense categories) */}
                {budgetAmount && (
                  <ReferenceLine y={budgetAmount} stroke="#f59e0b" strokeDasharray="6 3" strokeWidth={1.5}>
                    <Label value={`budget ${fmtCompact(budgetAmount)}`} position="insideTopLeft" className="fill-amber-600" fontSize={9} dy={-2} />
                  </ReferenceLine>
                )}

                {/* Target line (for investment/savings) */}
                {targetAmount && (
                  <ReferenceLine y={targetAmount} stroke="#10b981" strokeDasharray="6 3" strokeWidth={1.5}>
                    <Label value={`target ${fmtCompact(targetAmount)}`} position="insideTopLeft" className="fill-emerald-600" fontSize={9} dy={-2} />
                  </ReferenceLine>
                )}

                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke={lineColor}
                  strokeWidth={2}
                  dot={{ r: 4, fill: lineColor, strokeWidth: 0 }}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: "#fff" }}
                  label={renderDotLabel}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        );
      })()}

      {/* Sub-category breakdown pie chart */}
      {drillDown.subCategoryBreakdown.length > 0 && (
        <CategoryPieChart
          data={drillDown.subCategoryBreakdown.map(sc => ({
            id: sc.id,
            name: sc.name,
            value: sc.amount,
            color: sc.color,
          }))}
          title={`${account.name} breakdown`}
          onCategoryClick={(id) => id > 0 && router.push(`/expenses/${id}`)}
        />
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Transactions</CardTitle></CardHeader>
        <CardContent className="p-0">
          {transactions.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No transactions</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.slice(0, 50).map(txn => (
                  <TableRow key={txn.id}>
                    <TableCell className="text-sm tabular-nums">{formatDate(txn.date)}</TableCell>
                    <TableCell className="text-sm capitalize">{txn.type}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {txn.type === "transfer"
                        ? `${txn.fromAccountName} → ${txn.toAccountName}`
                        : txn.note || txn.categoryName || "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatCurrency(txn.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
