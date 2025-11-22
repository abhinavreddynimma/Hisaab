"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Check, ChevronLeft, ChevronRight,
  FileSpreadsheet, CircleDot,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ClassifyDialog } from "./classify-dialog";
import type { BankStatementEntry, ExpenseAccount } from "@/lib/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface BankStatementsClientProps {
  entries: BankStatementEntry[];
  accounts: ExpenseAccount[];
  stats: {
    total: number;
    classified: number;
    unclassified: number;
    totalDebit: number;
    totalCredit: number;
  };
  currentMonth: number;
  currentYear: number;
}

export function BankStatementsClient({
  entries,
  accounts,
  stats,
  currentMonth,
  currentYear,
}: BankStatementsClientProps) {
  const router = useRouter();
  const [selectedEntry, setSelectedEntry] = useState<BankStatementEntry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  function navigateMonth(delta: number) {
    let m = currentMonth + delta;
    let y = currentYear;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    router.push(`/expenses-2?month=${m}&year=${y}`);
  }

  function openClassify(entry: BankStatementEntry) {
    setSelectedEntry(entry);
    setDialogOpen(true);
  }

  const progressPct = stats.total > 0 ? Math.round((stats.classified / stats.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bank Statements</h1>
          <p className="text-sm text-muted-foreground">Import and classify bank transactions</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium w-24 text-center">
            {MONTHS[currentMonth - 1]} {currentYear}
          </span>
          <Button variant="outline" size="icon" onClick={() => navigateMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Transactions</p>
            <p className="text-lg font-bold tabular-nums">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Credit</p>
            <p className="text-lg font-bold tabular-nums text-emerald-600">{formatCurrency(stats.totalCredit)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Debit</p>
            <p className="text-lg font-bold tabular-nums text-rose-600">{formatCurrency(stats.totalDebit)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Classified</p>
            <p className="text-lg font-bold tabular-nums text-sky-600">{stats.classified}/{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Progress</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-sm font-bold tabular-nums">{progressPct}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction table */}
      <Card>
        <CardContent className="p-0">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground mb-1">No bank statement entries for this month</p>
              <p className="text-xs text-muted-foreground">Import a bank statement to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead className="w-[100px]">Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right w-[120px]">Debit</TableHead>
                  <TableHead className="text-right w-[120px]">Credit</TableHead>
                  <TableHead className="text-right w-[130px]">Balance</TableHead>
                  <TableHead className="w-[180px]">Classification</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow
                    key={entry.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openClassify(entry)}
                  >
                    <TableCell>
                      {entry.isClassified ? (
                        <div className="flex items-center justify-center">
                          <Check className="h-4 w-4 text-emerald-500" />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center">
                          <CircleDot className="h-4 w-4 text-muted-foreground/40" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">{formatDate(entry.date)}</TableCell>
                    <TableCell>
                      <p className="text-sm leading-tight line-clamp-2">
                        {entry.description.replace(/\n/g, " ").trim()}
                      </p>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-rose-600">
                      {entry.debit ? formatCurrency(entry.debit) : ""}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-emerald-600">
                      {entry.credit ? formatCurrency(entry.credit) : ""}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {entry.balance ? formatCurrency(entry.balance) : "—"}
                    </TableCell>
                    <TableCell>
                      {entry.isClassified ? (
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium">{entry.expenseName}</p>
                          <div className="flex items-center gap-1">
                            {entry.expenseType === "income" && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800">
                                <ArrowDownLeft className="h-2.5 w-2.5 mr-0.5" />
                                Income
                              </Badge>
                            )}
                            {entry.expenseType === "expense" && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-400 dark:border-rose-800">
                                <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" />
                                Expense
                              </Badge>
                            )}
                            {entry.expenseType === "transfer" && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800">
                                <ArrowLeftRight className="h-2.5 w-2.5 mr-0.5" />
                                Transfer
                              </Badge>
                            )}
                            {entry.categoryName && (
                              <span className="text-[10px] text-muted-foreground">{entry.categoryName}</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Click to classify</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ClassifyDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setSelectedEntry(null); }}
        entry={selectedEntry}
        accounts={accounts}
      />
    </div>
  );
}
