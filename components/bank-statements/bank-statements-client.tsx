"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Check, ChevronLeft, ChevronRight,
  FileSpreadsheet, CircleDot, Trash2, Landmark, Smartphone, Pencil, HelpCircle,
  ArrowUp, ArrowDown, ArrowUpDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { dismissBankStatementEntry } from "@/actions/bank-statements";
import { ClassifyDialog } from "./classify-dialog";
import { MergeClassifyDialog } from "./merge-classify-dialog";
import type { BankStatementEntry, ExpenseAccount } from "@/lib/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type SourceMeta = { icon: LucideIcon; label: string; className: string };

function getSourceMeta(bankName: string | null): SourceMeta {
  switch (bankName) {
    case "SBI":
    case "State Bank of India":
      return { icon: Landmark, label: "SBI bank statement", className: "text-indigo-600 dark:text-indigo-400" };
    case "PhonePe":
      return { icon: Smartphone, label: "PhonePe statement", className: "text-violet-600 dark:text-violet-400" };
    case "Money Manager":
      return { icon: FileSpreadsheet, label: "Imported from Money Manager (xlsx)", className: "text-amber-600 dark:text-amber-400" };
    case "Manual Entry":
      return { icon: Pencil, label: "Manual entry", className: "text-slate-600 dark:text-slate-400" };
    default:
      return { icon: HelpCircle, label: bankName ?? "Unknown source", className: "text-muted-foreground" };
  }
}

interface BankStatementsClientProps {
  entries: BankStatementEntry[];
  accounts: ExpenseAccount[];
  stats: {
    total: number;
    classified: number;
    unclassified: number;
    totalDebit: number;
    totalCredit: number;
    cumulativeBalance: number;
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
  const [sortBy, setSortBy] = useState<"date" | "debit" | "credit" | "balance">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);

  function toggleSelection(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function clearSelection() { setSelectedIds(new Set()); }

  const selectedEntries = entries.filter((e) => selectedIds.has(e.id));

  function toggleSort(col: "date" | "debit" | "credit" | "balance") {
    if (sortBy === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      // Date defaults to asc (chronological), amounts default to desc (largest first)
      setSortDir(col === "date" ? "asc" : "desc");
    }
  }

  const sortedEntries = [...entries].sort((a, b) => {
    let cmp = 0;
    if (sortBy === "date") {
      cmp = a.date.localeCompare(b.date);
      if (cmp === 0) cmp = (a.time ?? "").localeCompare(b.time ?? "");
    } else if (sortBy === "debit") {
      cmp = (a.debit ?? 0) - (b.debit ?? 0);
    } else if (sortBy === "credit") {
      cmp = (a.credit ?? 0) - (b.credit ?? 0);
    } else if (sortBy === "balance") {
      // Null balances sink to the end of asc / top of desc deliberately
      const aBal = a.balance ?? Number.NEGATIVE_INFINITY;
      const bBal = b.balance ?? Number.NEGATIVE_INFINITY;
      cmp = aBal - bBal;
    }
    if (cmp === 0) cmp = a.id - b.id;
    return sortDir === "asc" ? cmp : -cmp;
  });

  function SortIndicator({ col }: { col: "date" | "debit" | "credit" | "balance" }) {
    if (sortBy !== col) return <ArrowUpDown className="h-3 w-3 text-muted-foreground/40 inline ml-1" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3 w-3 inline ml-1" />
      : <ArrowDown className="h-3 w-3 inline ml-1" />;
  }

  async function handleDismiss(id: number) {
    try {
      await dismissBankStatementEntry(id);
      toast.success("Transaction removed");
      router.refresh();
    } catch {
      toast.error("Failed to remove transaction");
    }
  }

  function navigateMonth(delta: number) {
    let m = currentMonth + delta;
    let y = currentYear;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    router.push(`/bank?month=${m}&year=${y}`);
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
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
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
        <Card title="Cumulative net position: sum of all credits minus debits from the earliest entry up to the end of this month.">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Balance · end of {MONTHS[currentMonth - 1]}</p>
            <p className={cn(
              "text-lg font-bold tabular-nums",
              stats.cumulativeBalance >= 0 ? "text-emerald-600" : "text-rose-600",
            )}>{formatCurrency(stats.cumulativeBalance)}</p>
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

      {/* Selection action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-md border bg-muted/40 px-4 py-2">
          <span className="text-sm">
            <span className="font-semibold tabular-nums">{selectedIds.size}</span> selected
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={clearSelection}>Clear</Button>
            <Button
              size="sm"
              onClick={() => setMergeDialogOpen(true)}
              disabled={selectedIds.size < 2}
              title={selectedIds.size < 2 ? "Select at least 2 rows" : undefined}
            >
              Merge &amp; classify ({selectedIds.size})
            </Button>
          </div>
        </div>
      )}

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
                  <TableHead className="w-[40px]">
                    <Checkbox
                      aria-label="Select all on this page"
                      checked={entries.length > 0 && entries.every((e) => selectedIds.has(e.id))}
                      onCheckedChange={(v) => {
                        if (v) setSelectedIds(new Set(entries.map((e) => e.id)));
                        else clearSelection();
                      }}
                    />
                  </TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead className="w-[100px]">
                    <button
                      type="button"
                      onClick={() => toggleSort("date")}
                      className="inline-flex items-center hover:text-foreground"
                    >
                      Date
                      <SortIndicator col="date" />
                    </button>
                  </TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right w-[120px]">
                    <button
                      type="button"
                      onClick={() => toggleSort("debit")}
                      className="inline-flex items-center hover:text-foreground ml-auto"
                    >
                      Debit
                      <SortIndicator col="debit" />
                    </button>
                  </TableHead>
                  <TableHead className="text-right w-[120px]">
                    <button
                      type="button"
                      onClick={() => toggleSort("credit")}
                      className="inline-flex items-center hover:text-foreground ml-auto"
                    >
                      Credit
                      <SortIndicator col="credit" />
                    </button>
                  </TableHead>
                  <TableHead className="text-right w-[130px]">
                    <button
                      type="button"
                      onClick={() => toggleSort("balance")}
                      className="inline-flex items-center hover:text-foreground ml-auto"
                    >
                      Balance
                      <SortIndicator col="balance" />
                    </button>
                  </TableHead>
                  <TableHead className="w-[180px]">Classification</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedEntries.map((entry) => (
                  <TableRow
                    key={entry.id}
                    className={cn(
                      "cursor-pointer hover:bg-muted/50",
                      selectedIds.has(entry.id) && "bg-primary/5"
                    )}
                    onClick={() => openClassify(entry)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(entry.id)}
                        onCheckedChange={() => toggleSelection(entry.id)}
                        aria-label={`Select row ${entry.id}`}
                      />
                    </TableCell>
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
                    <TableCell className="text-sm tabular-nums">
                      {formatDate(entry.date)}
                      {entry.time && (
                        <p className="text-[10px] font-light text-muted-foreground/60 mt-0.5">{entry.time}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const src = getSourceMeta(entry.bankName);
                        const Icon = src.icon;
                        return (
                          <div className="flex items-start gap-2">
                            <span
                              title={src.label}
                              aria-label={src.label}
                              className="mt-0.5 shrink-0 inline-flex"
                            >
                              <Icon className={`h-3.5 w-3.5 ${src.className}`} />
                            </span>
                            <div className="min-w-0 flex-1">
                              {entry.isClassified && entry.splits && entry.splits.length > 1 ? (
                                <>
                                  <p className="text-sm font-medium">{entry.expenseName || `Split into ${entry.splits.length} transactions`}</p>
                                  <p className="text-[11px] font-light text-muted-foreground/60 leading-tight line-clamp-1 mt-0.5">
                                    {entry.splits.slice(0, 3).map((split) => split.expenseName).join(" • ")}
                                  </p>
                                </>
                              ) : entry.isClassified && entry.expenseName ? (
                                <>
                                  <p className="text-sm font-medium">{entry.expenseName}</p>
                                  <p className="text-[11px] font-light text-muted-foreground/60 leading-tight line-clamp-1 mt-0.5">
                                    {entry.description.replace(/\n/g, " ").trim()}
                                  </p>
                                </>
                              ) : (
                                <p className="text-sm leading-tight line-clamp-2">
                                  {entry.description.replace(/\n/g, " ").trim()}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })()}
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
                      {entry.isClassified && entry.splits && entry.splits.length > 1 ? (
                        <div className="space-y-1">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
                            {entry.splits.length} splits
                          </Badge>
                          <p className="text-[11px] text-muted-foreground line-clamp-2">
                            {entry.splits.map((split) => `${split.expenseName} (${formatCurrency(split.amount)})`).join(" • ")}
                          </p>
                        </div>
                      ) : entry.isClassified ? (
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
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/40 hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Transaction</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will hide the transaction and prevent it from being re-imported. Are you sure?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDismiss(entry.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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

      <MergeClassifyDialog
        open={mergeDialogOpen}
        onClose={() => setMergeDialogOpen(false)}
        onSuccess={() => { setMergeDialogOpen(false); clearSelection(); }}
        entries={selectedEntries}
        accounts={accounts}
      />
    </div>
  );
}
