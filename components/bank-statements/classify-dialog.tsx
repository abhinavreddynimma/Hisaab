"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { classifyBankStatementEntry, unclassifyBankStatementEntry } from "@/actions/bank-statements";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { BankStatementEntry, ExpenseAccount, ExpenseTransactionType } from "@/lib/types";
import { extractTitle } from "./utils";

interface ClassifyDialogProps {
  open: boolean;
  onClose: () => void;
  entry: BankStatementEntry | null;
  accounts: ExpenseAccount[];
}

export function ClassifyDialog({ open, onClose, entry, accounts }: ClassifyDialogProps) {
  const router = useRouter();
  const [expenseName, setExpenseName] = useState("");
  const [type, setType] = useState<ExpenseTransactionType>("expense");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (entry) {
      if (entry.isClassified) {
        setExpenseName(entry.expenseName || "");
        setType(entry.expenseType || (entry.credit ? "income" : "expense"));
        setCategoryId(entry.categoryId ? String(entry.categoryId) : "");
        setAccountId(entry.accountId ? String(entry.accountId) : "");
        setFromAccountId(entry.fromAccountId ? String(entry.fromAccountId) : "");
        setToAccountId(entry.toAccountId ? String(entry.toAccountId) : "");
        setNote(entry.note || "");
      } else {
        setExpenseName(entry.phonepeName || extractTitle(entry.description));
        setType(entry.credit ? "income" : "expense");
        setCategoryId("");
        setAccountId("");
        setFromAccountId("");
        setToAccountId("");
        setNote("");
      }
    }
  }, [entry, open]);

  const incomeAccounts = accounts.filter(a => a.type === "income" && a.isActive);
  const expenseAccounts = accounts.filter(a => a.type === "expense" && a.isActive);
  const bankCashAccounts = accounts.filter(a => (a.type === "bank" || a.type === "cash") && a.isActive);
  const transferableAccounts = accounts.filter(a => a.type !== "expense" && a.type !== "income" && a.isActive);

  const topLevelExpense = expenseAccounts.filter(a => !a.parentId);
  const level2Expense = expenseAccounts.filter(a => a.parentId && topLevelExpense.some(p => p.id === a.parentId));
  const level3Expense = expenseAccounts.filter(a => a.parentId && level2Expense.some(p => p.id === a.parentId));

  const amount = entry ? (entry.debit || entry.credit || 0) : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!entry) return;
    if (!expenseName.trim()) {
      toast.error("Please enter an expense name");
      return;
    }

    setSaving(true);
    try {
      // If already classified, unclassify first then reclassify
      if (entry.isClassified) {
        await unclassifyBankStatementEntry(entry.id);
      }
      await classifyBankStatementEntry(entry.id, {
        expenseName: expenseName.trim(),
        expenseType: type,
        categoryId: categoryId ? parseInt(categoryId) : null,
        accountId: accountId ? parseInt(accountId) : null,
        fromAccountId: fromAccountId ? parseInt(fromAccountId) : null,
        toAccountId: toAccountId ? parseInt(toAccountId) : null,
        note: note || null,
      });
      toast.success("Transaction classified");
      router.refresh();
      onClose();
    } catch {
      toast.error("Failed to classify transaction");
    } finally {
      setSaving(false);
    }
  }

  async function handleUnclassify() {
    if (!entry) return;
    setSaving(true);
    try {
      await unclassifyBankStatementEntry(entry.id);
      toast.success("Classification removed");
      router.refresh();
      onClose();
    } catch {
      toast.error("Failed to remove classification");
    } finally {
      setSaving(false);
    }
  }

  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Classify Transaction</DialogTitle>
        </DialogHeader>

        {/* Bank statement summary */}
        <div className="rounded-lg border bg-muted/30 px-3 py-2 flex items-center justify-between text-sm">
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">{formatDate(entry.date)}</span>
            {entry.refNo && <span className="text-[10px] font-mono text-muted-foreground/60">{entry.refNo}</span>}
          </div>
          <div className="flex items-center gap-3">
            <span className={`font-bold tabular-nums ${entry.credit ? "text-emerald-600" : "text-rose-600"}`}>
              {entry.credit ? "+" : "-"}{formatCurrency(amount)}
            </span>
            {entry.balance != null && (
              <span className="text-xs text-muted-foreground tabular-nums">Bal: {formatCurrency(entry.balance)}</span>
            )}
          </div>
        </div>

        {/* Classification form */}
        <div className="flex gap-1 rounded-lg border p-1">
          {(["income", "expense", "transfer"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                type === t
                  ? t === "income" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                    : t === "expense" ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Expense Name</Label>
            <Input
              placeholder="e.g. Grocery shopping, Salary, Transfer to savings..."
              value={expenseName}
              onChange={(e) => setExpenseName(e.target.value)}
              autoFocus
            />
            <p className="text-[11px] font-light text-muted-foreground/70 leading-relaxed">
              {entry.description.replace(/\n/g, " ").trim()}
            </p>
          </div>

          {type !== "transfer" && (
            <>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {type === "income" ? (
                      incomeAccounts.map(a => (
                        <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                      ))
                    ) : (
                      topLevelExpense.map(parent => {
                        const children = level2Expense.filter(c => c.parentId === parent.id);
                        if (children.length === 0) {
                          return <SelectItem key={parent.id} value={String(parent.id)}>{parent.name}</SelectItem>;
                        }
                        return (
                          <SelectGroup key={parent.id}>
                            <SelectItem value={String(parent.id)} className="font-semibold">{parent.name}</SelectItem>
                            {children.map(child => {
                              const grandchildren = level3Expense.filter(gc => gc.parentId === child.id);
                              if (grandchildren.length === 0) {
                                return <SelectItem key={child.id} value={String(child.id)} className="pl-6">{child.name}</SelectItem>;
                              }
                              return [
                                <SelectItem key={child.id} value={String(child.id)} className="pl-6 font-medium">{child.name}</SelectItem>,
                                ...grandchildren.map(gc => (
                                  <SelectItem key={gc.id} value={String(gc.id)} className="pl-10 text-muted-foreground">{gc.name}</SelectItem>
                                ))
                              ];
                            })}
                          </SelectGroup>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Account</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>
                    {bankCashAccounts.map(a => (
                      <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {type === "transfer" && (
            <>
              <div className="space-y-2">
                <Label>From</Label>
                <Select value={fromAccountId} onValueChange={setFromAccountId}>
                  <SelectTrigger><SelectValue placeholder="From account" /></SelectTrigger>
                  <SelectContent>
                    {transferableAccounts.map(a => (
                      <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>To</Label>
                <Select value={toAccountId} onValueChange={setToAccountId}>
                  <SelectTrigger><SelectValue placeholder="To account" /></SelectTrigger>
                  <SelectContent>
                    {transferableAccounts.map(a => (
                      <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>Note (optional)</Label>
            <Textarea placeholder="Add a note..." value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>

          <div className="flex justify-between pt-2">
            <div>
              {entry.isClassified && (
                <Button type="button" variant="outline" className="text-destructive" onClick={handleUnclassify} disabled={saving}>
                  Remove Classification
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : entry.isClassified ? "Update" : "Classify"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
