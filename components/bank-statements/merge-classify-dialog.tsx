"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { classifyBankStatementsTogether } from "@/actions/bank-statements";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { BankStatementEntry, ExpenseAccount, ExpenseTransactionType } from "@/lib/types";

interface MergeClassifyDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  entries: BankStatementEntry[];
  accounts: ExpenseAccount[];
}

export function MergeClassifyDialog({ open, onClose, onSuccess, entries, accounts }: MergeClassifyDialogProps) {
  const router = useRouter();
  const [expenseName, setExpenseName] = useState("");
  const [type, setType] = useState<ExpenseTransactionType>("expense");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const incomeAccounts = accounts.filter((a) => a.type === "income" && a.isActive);
  const expenseAccountsList = accounts.filter((a) => a.type === "expense" && a.isActive);
  const bankCashAccounts = accounts.filter((a) => (a.type === "bank" || a.type === "cash") && a.isActive);
  const transferableAccounts = accounts.filter((a) => a.type !== "expense" && a.type !== "income" && a.isActive);

  const topLevelExpense = expenseAccountsList.filter((a) => !a.parentId);
  const level2Expense = expenseAccountsList.filter((a) => a.parentId && topLevelExpense.some((p) => p.id === a.parentId));
  const level3Expense = expenseAccountsList.filter((a) => a.parentId && level2Expense.some((p) => p.id === a.parentId));

  const defaultBankId = (
    bankCashAccounts.find((a) => a.type === "bank" && a.name.trim().toLowerCase() === "sbi")
    ?? bankCashAccounts.find((a) => a.type === "bank")
    ?? bankCashAccounts[0]
  )?.id;
  const defaultBankStr = defaultBankId ? String(defaultBankId) : "";

  const totalDebit = entries.reduce((s, e) => s + (e.debit ?? 0), 0);
  const totalCredit = entries.reduce((s, e) => s + (e.credit ?? 0), 0);
  const mixed = totalDebit > 0 && totalCredit > 0;
  const total = totalDebit > 0 ? totalDebit : totalCredit;
  const defaultType: ExpenseTransactionType = totalCredit > 0 ? "income" : "expense";

  useEffect(() => {
    if (!open) return;
    // Compose a default expense name from the most common description prefix
    const firstDesc = (entries[0]?.description ?? "").split(/[|—]/, 1)[0].trim();
    setExpenseName(firstDesc.slice(0, 80) || `Merged ${entries.length} transactions`);
    setType(defaultType);
    setCategoryId("");
    setAccountId(defaultBankStr);
    setFromAccountId(defaultBankStr);
    setToAccountId("");
    setNote("");
  }, [open, entries, defaultType, defaultBankStr]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mixed) {
      toast.error("Cannot merge debit and credit rows together");
      return;
    }
    if (!expenseName.trim()) {
      toast.error("Please enter a classification name");
      return;
    }

    setSaving(true);
    try {
      await classifyBankStatementsTogether(
        entries.map((e) => e.id),
        {
          expenseName: expenseName.trim(),
          expenseType: type,
          categoryId: type !== "transfer" && categoryId ? parseInt(categoryId) : null,
          accountId: type !== "transfer" && accountId ? parseInt(accountId) : null,
          fromAccountId: type === "transfer" && fromAccountId ? parseInt(fromAccountId) : null,
          toAccountId: type === "transfer" && toAccountId ? parseInt(toAccountId) : null,
          note: note.trim() || null,
        },
      );
      toast.success(`Merged ${entries.length} transactions into one`);
      onSuccess();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to merge");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Merge & classify {entries.length} transactions</DialogTitle>
        </DialogHeader>

        {/* Selected-rows summary */}
        <div className="rounded-md border bg-muted/30 max-h-32 overflow-y-auto">
          <table className="w-full text-xs">
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b last:border-b-0">
                  <td className="px-3 py-1.5 text-muted-foreground tabular-nums w-20">{formatDate(e.date)}</td>
                  <td className="px-2 py-1.5 truncate max-w-[280px]">{e.description.replace(/\n/g, " ").trim()}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {e.debit ? <span className="text-rose-600">{formatCurrency(e.debit)}</span> : null}
                    {e.credit ? <span className="text-emerald-600">{formatCurrency(e.credit)}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t bg-muted/40">
              <tr>
                <td colSpan={2} className="px-3 py-1.5 font-semibold">Total</td>
                <td className="px-3 py-1.5 text-right tabular-nums font-bold">
                  <span className={totalDebit > 0 ? "text-rose-600" : "text-emerald-600"}>{formatCurrency(total)}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {mixed && (
          <p className="text-xs text-rose-600">
            Cannot merge — selection mixes debits and credits. Cancel and pick rows of the same direction.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-1 rounded-lg border p-1">
            {(["income", "expense", "transfer"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  type === t
                    ? t === "income" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      : t === "expense" ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                      : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Classification name</Label>
            <Input value={expenseName} onChange={(e) => setExpenseName(e.target.value)} placeholder="e.g. Private Chittis - Dad" />
          </div>

          {type !== "transfer" && (
            <>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {type === "income" ? (
                      incomeAccounts.map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                      ))
                    ) : (
                      topLevelExpense.map((parent) => {
                        const children = level2Expense.filter((c) => c.parentId === parent.id);
                        if (children.length === 0) {
                          return <SelectItem key={parent.id} value={String(parent.id)}>{parent.name}</SelectItem>;
                        }
                        return (
                          <SelectGroup key={parent.id}>
                            <SelectItem value={String(parent.id)} className="font-semibold">{parent.name}</SelectItem>
                            {children.map((child) => {
                              const gcs = level3Expense.filter((gc) => gc.parentId === child.id);
                              if (gcs.length === 0) {
                                return <SelectItem key={child.id} value={String(child.id)} className="pl-6">{child.name}</SelectItem>;
                              }
                              return [
                                <SelectItem key={child.id} value={String(child.id)} className="pl-6 font-medium">{child.name}</SelectItem>,
                                ...gcs.map((gc) => (
                                  <SelectItem key={gc.id} value={String(gc.id)} className="pl-10 text-muted-foreground">{gc.name}</SelectItem>
                                )),
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
                    {bankCashAccounts.map((a) => (
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
                    {transferableAccounts.map((a) => (
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
                    {transferableAccounts.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>Note (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Add a note..." />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving || mixed}>
              {saving ? "Saving..." : `Merge ${entries.length} into one`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
