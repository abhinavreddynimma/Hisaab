"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, X, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Plus, Link2, Check, Repeat, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import { deleteExpenseTransaction } from "@/actions/expenses";
import { confirmRecurringTransaction } from "@/actions/recurring-expenses";
import type { ExpenseTransaction } from "@/lib/types";

interface TransactionListProps {
  transactions: ExpenseTransaction[];
  totalIncome: number;
  totalExpenses: number;
  onEdit: (txn: ExpenseTransaction) => void;
  onAddNew: () => void;
}

const TYPE_CONFIG = {
  income: { icon: ArrowDownLeft, color: "text-emerald-600", bg: "bg-emerald-50", label: "Income" },
  expense: { icon: ArrowUpRight, color: "text-rose-600", bg: "bg-rose-50", label: "Expense" },
  transfer: { icon: ArrowLeftRight, color: "text-blue-600", bg: "bg-blue-50", label: "Transfer" },
};

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" },
  { value: "transfer", label: "Transfer" },
] as const;

type FilterType = (typeof FILTER_OPTIONS)[number]["value"];

export function TransactionList({ transactions, totalIncome, totalExpenses, onEdit, onAddNew }: TransactionListProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>("all");

  const filtered = filter === "all" ? transactions : transactions.filter(t => t.type === filter);

  async function handleDelete(id: number) {
    try {
      await deleteExpenseTransaction(id);
      toast.success("Transaction deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete transaction");
    }
  }

  async function handleConfirm(id: number) {
    try {
      await confirmRecurringTransaction(id);
      toast.success("Transaction confirmed");
      router.refresh();
    } catch {
      toast.error("Failed to confirm transaction");
    }
  }

  const net = totalIncome - totalExpenses;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Income</p>
            <p className="text-lg font-bold tabular-nums text-emerald-600">{formatCurrency(totalIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Expenses</p>
            <p className="text-lg font-bold tabular-nums text-rose-600">{formatCurrency(totalExpenses)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Net</p>
            <p className={`text-lg font-bold tabular-nums ${net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {formatCurrency(Math.abs(net))}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-1">
        {FILTER_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant={filter === opt.value ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setFilter(opt.value)}
          >
            {opt.label}
            {opt.value !== "all" && (
              <span className="ml-1 text-[10px] opacity-60">
                {transactions.filter(t => t.type === opt.value).length}
              </span>
            )}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-muted-foreground mb-2">No transactions this month</p>
              <Button variant="link" onClick={onAddNew}>
                <Plus className="mr-1 h-4 w-4" />
                Add your first transaction
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Date</TableHead>
                  <TableHead className="w-[80px]">Type</TableHead>
                  <TableHead>Category / Account</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((txn) => {
                  const config = TYPE_CONFIG[txn.type];
                  const Icon = config.icon;
                  return (
                    <TableRow
                      key={txn.id}
                      className={`hover:bg-muted/50 ${txn.status === "estimated" ? "opacity-40" : txn.source !== "manual" ? "opacity-80" : "cursor-pointer"}`}
                      onClick={() => txn.source === "manual" && onEdit(txn)}
                    >
                      <TableCell className="text-sm tabular-nums">{formatDate(txn.date)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <div className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${config.bg} ${config.color}`}>
                            <Icon className="h-3 w-3" />
                            {config.label}
                          </div>
                          {txn.source === "invoice" && (
                            <div className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${txn.status === "estimated" ? "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400" : "bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400"}`}>
                              <Link2 className="h-2.5 w-2.5" />
                              {txn.status === "estimated" ? "Est." : "Inv."}
                            </div>
                          )}
                          {txn.source === "recurring" && (
                            <div className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${txn.status === "estimated" ? "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400" : "bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400"}`}>
                              <Repeat className="h-2.5 w-2.5" />
                              {txn.status === "estimated" ? "Est." : "Rec."}
                            </div>
                          )}
                          {txn.source === "tax_payment" && (
                            <div className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400">
                              <Link2 className="h-2.5 w-2.5" />
                              Tax
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {txn.type === "transfer" ? (
                          <span className="text-sm">{txn.fromAccountName} → {txn.toAccountName}</span>
                        ) : (
                          <div>
                            <span className="text-sm font-medium">{txn.categoryName}</span>
                            {txn.accountName && (
                              <span className="text-xs text-muted-foreground ml-2">({txn.accountName})</span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-medium tabular-nums ${txn.type === "income" ? "text-emerald-600" : txn.type === "expense" ? "text-rose-600" : ""}`}>
                        {txn.type === "income" ? "+" : txn.type === "expense" ? "-" : ""}{formatCurrency(txn.amount)}
                        {txn.type === "transfer" && txn.fees && txn.fees > 0 && (
                          <span className="text-xs text-muted-foreground ml-1">(+{formatCurrency(txn.fees)} fees)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {txn.note || "—"}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {txn.source === "tax_payment" ? (
                          <span className="text-[10px] text-muted-foreground">auto</span>
                        ) : txn.source === "recurring" && txn.status === "estimated" ? (
                          <div className="flex items-center gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => onEdit(txn)}
                              title="Edit before confirming"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              onClick={() => handleConfirm(txn.id)}
                              title="Confirm this expense"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDelete(txn.id)}
                              title="Delete this estimated entry"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : txn.source === "invoice" || (txn.source === "recurring" && txn.status === "confirmed") ? (
                          <span className="text-[10px] text-muted-foreground">auto</span>
                        ) : (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Delete this {txn.type} of {formatCurrency(txn.amount)}?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(txn.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
