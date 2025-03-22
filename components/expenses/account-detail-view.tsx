"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { formatCurrency, formatDate } from "@/lib/utils";
import { EXPENSE_ACCOUNT_TYPES } from "@/lib/constants";
import type { ExpenseAccount, ExpenseTransaction, ExpenseBudget, ExpenseTarget, ExpenseAccountType } from "@/lib/types";

interface AccountDetailViewProps {
  drillDown: {
    account: ExpenseAccount | null;
    transactions: ExpenseTransaction[];
    monthlyTrend: { month: string; amount: number }[];
    totalAmount: number;
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
        <Button variant="ghost" size="icon" onClick={() => router.push("/expenses?tab=accounts")}>
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

      {monthlyTrend.some(m => m.amount > 0) && (
        <Card>
          <CardHeader><CardTitle className="text-base">Monthly Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: number | undefined) => [formatCurrency(value ?? 0), "Amount"]} contentStyle={{ borderRadius: 12, fontSize: 13 }} />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke={typeConfig?.color || "#f97316"}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: typeConfig?.color || "#f97316", strokeWidth: 0 }}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: "#fff" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
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
