"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { createExpenseTransaction, updateExpenseTransaction, getBucketTargets, getCategoryBucketMap } from "@/actions/expenses";
import { BucketPicker } from "@/components/bank-statements/bucket-picker";
import type { ExpenseAccount, ExpenseTransaction, ExpenseTransactionType } from "@/lib/types";

interface TransactionDialogProps {
  open: boolean;
  onClose: () => void;
  transaction: ExpenseTransaction | null;
  accounts: ExpenseAccount[];
}

export function TransactionDialog({ open, onClose, transaction, accounts }: TransactionDialogProps) {
  const [type, setType] = useState<ExpenseTransactionType>("expense");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [fees, setFees] = useState("");
  const [note, setNote] = useState("");
  const [selectedTags] = useState<string[]>([]);
  const [excludeFromTax, setExcludeFromTax] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bucketTargetId, setBucketTargetId] = useState<number | null>(null);
  const [bucketTargets, setBucketTargets] = useState<{ id: number; name: string }[]>([]);
  const [categoryBucketMap, setCategoryBucketMap] = useState<Record<number, { id: number; name: string }>>({});
  const [isModification, setIsModification] = useState(false);

  useEffect(() => {
    if (open && bucketTargets.length === 0) {
      Promise.all([getBucketTargets(), getCategoryBucketMap()]).then(([bt, cbm]) => {
        setBucketTargets(bt.map((t) => ({ id: t.id, name: t.name })));
        setCategoryBucketMap(cbm);
      });
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const autoResolvesTo = categoryId ? categoryBucketMap[parseInt(categoryId, 10)]?.name ?? null : null;

  useEffect(() => {
    if (transaction) {
      setType(transaction.type);
      setDate(transaction.date);
      setAmount(String(transaction.amount));
      setCategoryId(transaction.categoryId ? String(transaction.categoryId) : "");
      setAccountId(transaction.accountId ? String(transaction.accountId) : "");
      setFromAccountId(transaction.fromAccountId ? String(transaction.fromAccountId) : "");
      setToAccountId(transaction.toAccountId ? String(transaction.toAccountId) : "");
      setFees(transaction.fees ? String(transaction.fees) : "");
      setNote(transaction.note || "");
      setExcludeFromTax(transaction.excludeFromTax ?? false);
      setBucketTargetId(transaction.bucketTargetId ?? null);
      setIsModification(transaction.isModification ?? false);
    } else {
      setType("expense");
      setDate(new Date().toISOString().split("T")[0]);
      setAmount("");
      setCategoryId("");
      setAccountId(defaultBankIdStr);
      setFromAccountId(defaultBankIdStr);
      setToAccountId("");
      setFees("");
      setNote("");
      setExcludeFromTax(false);
      setBucketTargetId(null);
      setIsModification(false);
    }
  }, [transaction, open]);

  const incomeAccounts = accounts.filter(a => a.type === "income" && a.isActive);
  const expenseAccounts = accounts.filter(a => a.type === "expense" && a.isActive);
  const bankCashAccounts = accounts.filter(a => (a.type === "bank" || a.type === "cash") && a.isActive);
  const transferableAccounts = accounts.filter(a => a.type !== "expense" && a.type !== "income" && a.isActive);
  const defaultBankAccountId = (
    bankCashAccounts.find(a => a.type === "bank" && a.name.trim().toLowerCase() === "sbi")
    ?? bankCashAccounts.find(a => a.type === "bank")
    ?? bankCashAccounts[0]
  )?.id;
  const defaultBankIdStr = defaultBankAccountId ? String(defaultBankAccountId) : "";

  // Build 3-level hierarchy for expense categories
  const topLevelExpense = expenseAccounts.filter(a => !a.parentId);
  const level2Expense = expenseAccounts.filter(a => a.parentId && topLevelExpense.some(p => p.id === a.parentId));
  const level3Expense = expenseAccounts.filter(a => a.parentId && level2Expense.some(p => p.id === a.parentId));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setSaving(true);
    try {
      const data = {
        type,
        date,
        amount: parseFloat(amount),
        categoryId: categoryId ? parseInt(categoryId) : null,
        accountId: accountId ? parseInt(accountId) : null,
        fromAccountId: fromAccountId ? parseInt(fromAccountId) : null,
        toAccountId: toAccountId ? parseInt(toAccountId) : null,
        fees: fees ? parseFloat(fees) : null,
        note: note || null,
        tags: selectedTags.length > 0 ? selectedTags : null,
        excludeFromTax: type === "income" ? excludeFromTax : false,
        bucketTargetId: type === "expense" ? bucketTargetId : null,
        isModification,
      };

      if (transaction) {
        await updateExpenseTransaction(transaction.id, data);
        toast.success("Transaction updated");
      } else {
        await createExpenseTransaction(data);
        toast.success("Transaction added");
      }
      onClose();
    } catch {
      toast.error("Failed to save transaction");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{transaction ? "Edit" : "Add"} Transaction</DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 rounded-lg border p-1">
          {(["income", "expense", "transfer"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                type === t
                  ? t === "income" ? "bg-emerald-100 text-emerald-700"
                    : t === "expense" ? "bg-rose-100 text-rose-700"
                    : "bg-blue-100 text-blue-700"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Amount (₹)</Label>
              <Input type="number" step="0.01" min="0" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
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
                            <SelectItem key={parent.id} value={String(parent.id)} className="font-semibold">{parent.name}</SelectItem>
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
              <div className="space-y-2">
                <Label>Fees (optional)</Label>
                <Input type="number" step="0.01" min="0" placeholder="0.00" value={fees} onChange={(e) => setFees(e.target.value)} />
              </div>
            </>
          )}

          {type === "expense" && (
            <BucketPicker
              value={bucketTargetId}
              onChange={setBucketTargetId}
              buckets={bucketTargets}
              autoResolvesTo={autoResolvesTo}
            />
          )}

          <label className="flex items-start gap-2 rounded-md border bg-muted/30 p-3 cursor-pointer">
            <Checkbox
              checked={isModification}
              onCheckedChange={(v) => setIsModification(v === true)}
              className="mt-0.5"
            />
            <div className="flex-1">
              <p className="text-sm font-medium">Mark as modification</p>
              <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                Opening balance / one-off adjustment. Affects the account balance but is excluded from Monthly stats.
              </p>
            </div>
          </label>

          <div className="space-y-2">
            <Label>Note</Label>
            <Textarea placeholder="Add a note..." value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>

          {type === "income" && (
            <label className="flex items-start gap-2 rounded-md border bg-muted/30 p-3 cursor-pointer">
              <Checkbox
                checked={excludeFromTax}
                onCheckedChange={(v) => setExcludeFromTax(v === true)}
                className="mt-0.5"
              />
              <div className="flex-1">
                <p className="text-sm font-medium">Exclude from tax calculation</p>
                <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                  Tick for non-taxable income — old savings restored, gifts, refunds, etc. Doesn&apos;t affect dashboards or budget math, only the Tax Overview gross-receipts total.
                </p>
              </div>
            </label>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : transaction ? "Update" : "Add"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
