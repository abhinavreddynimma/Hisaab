"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { classifyBankStatementEntry, classifyBankStatementEntryWithSplits, unclassifyBankStatementEntry } from "@/actions/bank-statements";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { BankStatementEntry, ExpenseAccount, ExpenseTransactionType } from "@/lib/types";
import { extractTitle } from "./utils";

interface ClassifyDialogProps {
  open: boolean;
  onClose: () => void;
  entry: BankStatementEntry | null;
  accounts: ExpenseAccount[];
}

interface SplitDraft {
  expenseName: string;
  type: ExpenseTransactionType;
  amount: string;
  categoryId: string;
  accountId: string;
  fromAccountId: string;
  toAccountId: string;
  note: string;
}

function roundCurrency(amount: number) {
  return Math.round(amount * 100) / 100;
}

function buildSplitDraft(params: {
  expenseName: string;
  type: ExpenseTransactionType;
  amount: number | string;
  accountId?: string;
  categoryId?: string;
  fromAccountId?: string;
  toAccountId?: string;
  note?: string;
}): SplitDraft {
  return {
    expenseName: params.expenseName,
    type: params.type,
    amount: String(params.amount),
    categoryId: params.categoryId ?? "",
    accountId: params.accountId ?? "",
    fromAccountId: params.fromAccountId ?? "",
    toAccountId: params.toAccountId ?? "",
    note: params.note ?? "",
  };
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
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [splits, setSplits] = useState<SplitDraft[]>([]);
  const [saving, setSaving] = useState(false);

  const incomeAccounts = accounts.filter((account) => account.type === "income" && account.isActive);
  const expenseAccounts = accounts.filter((account) => account.type === "expense" && account.isActive);
  const bankCashAccounts = accounts.filter((account) => (account.type === "bank" || account.type === "cash") && account.isActive);
  const transferableAccounts = accounts.filter((account) => account.type !== "expense" && account.type !== "income" && account.isActive);
  const defaultBankAccountId = (
    bankCashAccounts.find((account) => account.type === "bank" && account.name.trim().toLowerCase() === "sbi")
    ?? bankCashAccounts.find((account) => account.type === "bank")
    ?? bankCashAccounts[0]
  )?.id;
  const amount = entry ? (entry.debit || entry.credit || 0) : 0;

  const topLevelExpense = expenseAccounts.filter((account) => !account.parentId);
  const level2Expense = expenseAccounts.filter((account) => account.parentId && topLevelExpense.some((parent) => parent.id === account.parentId));
  const level3Expense = expenseAccounts.filter((account) => account.parentId && level2Expense.some((parent) => parent.id === account.parentId));

  useEffect(() => {
    if (!entry) return;

    const defaultName = entry.phonepeName || extractTitle(entry.description);
    const defaultType = entry.credit ? "income" : "expense";
    const defaultAccount = defaultBankAccountId ? String(defaultBankAccountId) : "";

    if (entry.isClassified && entry.splits && entry.splits.length > 0) {
      const [firstSplit] = entry.splits;
      setExpenseName(firstSplit.expenseName);
      setType(firstSplit.expenseType);
      setCategoryId(firstSplit.categoryId ? String(firstSplit.categoryId) : "");
      setAccountId(firstSplit.accountId ? String(firstSplit.accountId) : "");
      setFromAccountId(firstSplit.fromAccountId ? String(firstSplit.fromAccountId) : "");
      setToAccountId(firstSplit.toAccountId ? String(firstSplit.toAccountId) : "");
      setNote(firstSplit.note || "");
      setIsSplitMode(true);
      setSplits(entry.splits.map((split) => buildSplitDraft({
        expenseName: split.expenseName,
        type: split.expenseType,
        amount: split.amount,
        categoryId: split.categoryId ? String(split.categoryId) : "",
        accountId: split.accountId ? String(split.accountId) : "",
        fromAccountId: split.fromAccountId ? String(split.fromAccountId) : "",
        toAccountId: split.toAccountId ? String(split.toAccountId) : "",
        note: split.note || "",
      })));
      return;
    }

    if (entry.isClassified) {
      setExpenseName(entry.expenseName || "");
      setType(entry.expenseType || defaultType);
      setCategoryId(entry.categoryId ? String(entry.categoryId) : "");
      setAccountId(entry.accountId ? String(entry.accountId) : "");
      setFromAccountId(entry.fromAccountId ? String(entry.fromAccountId) : "");
      setToAccountId(entry.toAccountId ? String(entry.toAccountId) : "");
      setNote(entry.note || "");
    } else {
      setExpenseName(defaultName);
      setType(defaultType);
      setCategoryId("");
      setAccountId(defaultAccount);
      setFromAccountId("");
      setToAccountId("");
      setNote("");
    }

    setIsSplitMode(false);
    setSplits([
      buildSplitDraft({
        expenseName: defaultName,
        type: defaultType,
        amount: roundCurrency(amount),
        accountId: defaultAccount,
      }),
      buildSplitDraft({
        expenseName: "",
        type: defaultType,
        amount: "",
        accountId: defaultAccount,
      }),
    ]);
  }, [amount, defaultBankAccountId, entry, open]);

  const splitTotal = roundCurrency(
    splits.reduce((sum, split) => sum + (parseFloat(split.amount) || 0), 0),
  );
  const splitRemaining = roundCurrency(amount - splitTotal);

  function updateSplit(index: number, patch: Partial<SplitDraft>) {
    setSplits((current) => current.map((split, splitIndex) => (
      splitIndex === index ? { ...split, ...patch } : split
    )));
  }

  function addSplitLine() {
    setSplits((current) => [
      ...current,
      buildSplitDraft({
        expenseName: "",
        type: entry?.credit ? "income" : "expense",
        amount: "",
        accountId: defaultBankAccountId ? String(defaultBankAccountId) : "",
      }),
    ]);
  }

  function removeSplitLine(index: number) {
    setSplits((current) => current.filter((_, splitIndex) => splitIndex !== index));
  }

  function toggleSplitMode(nextValue: boolean) {
    if (!entry) return;

    if (!nextValue && isSplitMode) {
      const [firstSplit] = splits;
      if (firstSplit) {
        setExpenseName(firstSplit.expenseName);
        setType(firstSplit.type);
        setCategoryId(firstSplit.categoryId);
        setAccountId(firstSplit.accountId);
        setFromAccountId(firstSplit.fromAccountId);
        setToAccountId(firstSplit.toAccountId);
        setNote(firstSplit.note);
      }
      setIsSplitMode(false);
      return;
    }

    if (nextValue && !isSplitMode) {
      const nextSplits = [
        buildSplitDraft({
          expenseName: expenseName || entry.phonepeName || extractTitle(entry.description),
          type,
          amount: roundCurrency(amount),
          categoryId,
          accountId,
          fromAccountId,
          toAccountId,
          note,
        }),
        buildSplitDraft({
          expenseName: "",
          type,
          amount: "",
          accountId: defaultBankAccountId ? String(defaultBankAccountId) : "",
        }),
      ];
      setSplits(nextSplits);
      setIsSplitMode(true);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!entry) return;

    setSaving(true);
    try {
      if (entry.isClassified) {
        await unclassifyBankStatementEntry(entry.id);
      }

      if (isSplitMode) {
        if (splits.length < 2) {
          toast.error("Add at least two split lines");
          return;
        }

        const preparedSplits = splits.map((split) => ({
          expenseName: split.expenseName.trim(),
          expenseType: split.type,
          amount: parseFloat(split.amount) || 0,
          categoryId: split.categoryId ? parseInt(split.categoryId, 10) : null,
          accountId: split.accountId ? parseInt(split.accountId, 10) : null,
          fromAccountId: split.fromAccountId ? parseInt(split.fromAccountId, 10) : null,
          toAccountId: split.toAccountId ? parseInt(split.toAccountId, 10) : null,
          note: split.note || null,
        }));

        if (preparedSplits.some((split) => !split.expenseName || split.amount <= 0)) {
          toast.error("Each split needs a name and amount");
          return;
        }

        const preparedTotal = roundCurrency(
          preparedSplits.reduce((sum, split) => sum + split.amount, 0),
        );

        if (preparedTotal !== roundCurrency(amount)) {
          toast.error("Split total must match the transaction amount");
          return;
        }

        await classifyBankStatementEntryWithSplits(entry.id, preparedSplits);
      } else {
        if (!expenseName.trim()) {
          toast.error("Please enter an expense name");
          return;
        }

        await classifyBankStatementEntry(entry.id, {
          expenseName: expenseName.trim(),
          expenseType: type,
          categoryId: categoryId ? parseInt(categoryId, 10) : null,
          accountId: accountId ? parseInt(accountId, 10) : null,
          fromAccountId: fromAccountId ? parseInt(fromAccountId, 10) : null,
          toAccountId: toAccountId ? parseInt(toAccountId, 10) : null,
          note: note || null,
        });
      }

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
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Classify Transaction</DialogTitle>
        </DialogHeader>

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

        <div className="flex gap-1 rounded-lg border p-1">
          <button
            type="button"
            onClick={() => toggleSplitMode(false)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              !isSplitMode ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-50" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            Single
          </button>
          <button
            type="button"
            onClick={() => toggleSplitMode(true)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              isSplitMode ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-50" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            Split
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isSplitMode ? (
            <>
              <div className="flex gap-1 rounded-lg border p-1">
                {(["income", "expense", "transfer"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setType(option)}
                    className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      type === option
                        ? option === "income"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                          : option === "expense"
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <Label>Expense Name</Label>
                <Input
                  placeholder="e.g. Grocery shopping, Salary, Transfer to savings..."
                  value={expenseName}
                  onChange={(event) => setExpenseName(event.target.value)}
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
                          incomeAccounts.map((account) => (
                            <SelectItem key={account.id} value={String(account.id)}>{account.name}</SelectItem>
                          ))
                        ) : (
                          topLevelExpense.map((parent) => {
                            const children = level2Expense.filter((child) => child.parentId === parent.id);
                            if (children.length === 0) {
                              return <SelectItem key={parent.id} value={String(parent.id)}>{parent.name}</SelectItem>;
                            }

                            return (
                              <SelectGroup key={parent.id}>
                                <SelectItem value={String(parent.id)} className="font-semibold">{parent.name}</SelectItem>
                                {children.map((child) => {
                                  const grandchildren = level3Expense.filter((grandchild) => grandchild.parentId === child.id);
                                  if (grandchildren.length === 0) {
                                    return <SelectItem key={child.id} value={String(child.id)} className="pl-6">{child.name}</SelectItem>;
                                  }

                                  return [
                                    <SelectItem key={child.id} value={String(child.id)} className="pl-6 font-medium">{child.name}</SelectItem>,
                                    ...grandchildren.map((grandchild) => (
                                      <SelectItem key={grandchild.id} value={String(grandchild.id)} className="pl-10 text-muted-foreground">{grandchild.name}</SelectItem>
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
                        {bankCashAccounts.map((account) => (
                          <SelectItem key={account.id} value={String(account.id)}>{account.name}</SelectItem>
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
                        {transferableAccounts.map((account) => (
                          <SelectItem key={account.id} value={String(account.id)}>{account.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>To</Label>
                    <Select value={toAccountId} onValueChange={setToAccountId}>
                      <SelectTrigger><SelectValue placeholder="To account" /></SelectTrigger>
                      <SelectContent>
                        {transferableAccounts.map((account) => (
                          <SelectItem key={account.id} value={String(account.id)}>{account.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label>Note (optional)</Label>
                <Textarea placeholder="Add a note..." value={note} onChange={(event) => setNote(event.target.value)} rows={2} />
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Split total</span>
                  <span className="font-medium tabular-nums">{formatCurrency(splitTotal)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Remaining</span>
                  <span className={`font-medium tabular-nums ${splitRemaining === 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {formatCurrency(Math.abs(splitRemaining))}
                  </span>
                </div>
              </div>

              {splits.map((split, index) => (
                <div key={`${index}-${split.expenseName}-${split.amount}`} className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Split {index + 1}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeSplitLine(index)}
                      disabled={splits.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        value={split.expenseName}
                        onChange={(event) => updateSplit(index, { expenseName: event.target.value })}
                        placeholder="Describe this split"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Amount</Label>
                      <Input
                        inputMode="decimal"
                        value={split.amount}
                        onChange={(event) => updateSplit(index, { amount: event.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="flex gap-1 rounded-lg border p-1">
                    {(["income", "expense", "transfer"] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => updateSplit(index, { type: option })}
                        className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                          split.type === option
                            ? option === "income"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                              : option === "expense"
                                ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
                                : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                            : "text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </button>
                    ))}
                  </div>

                  {split.type !== "transfer" && (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select value={split.categoryId} onValueChange={(value) => updateSplit(index, { categoryId: value })}>
                          <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                          <SelectContent>
                            {split.type === "income" ? (
                              incomeAccounts.map((account) => (
                                <SelectItem key={account.id} value={String(account.id)}>{account.name}</SelectItem>
                              ))
                            ) : (
                              topLevelExpense.map((parent) => {
                                const children = level2Expense.filter((child) => child.parentId === parent.id);
                                if (children.length === 0) {
                                  return <SelectItem key={parent.id} value={String(parent.id)}>{parent.name}</SelectItem>;
                                }

                                return (
                                  <SelectGroup key={parent.id}>
                                    <SelectItem value={String(parent.id)} className="font-semibold">{parent.name}</SelectItem>
                                    {children.map((child) => {
                                      const grandchildren = level3Expense.filter((grandchild) => grandchild.parentId === child.id);
                                      if (grandchildren.length === 0) {
                                        return <SelectItem key={child.id} value={String(child.id)} className="pl-6">{child.name}</SelectItem>;
                                      }

                                      return [
                                        <SelectItem key={child.id} value={String(child.id)} className="pl-6 font-medium">{child.name}</SelectItem>,
                                        ...grandchildren.map((grandchild) => (
                                          <SelectItem key={grandchild.id} value={String(grandchild.id)} className="pl-10 text-muted-foreground">{grandchild.name}</SelectItem>
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
                        <Select value={split.accountId} onValueChange={(value) => updateSplit(index, { accountId: value })}>
                          <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                          <SelectContent>
                            {bankCashAccounts.map((account) => (
                              <SelectItem key={account.id} value={String(account.id)}>{account.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {split.type === "transfer" && (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>From</Label>
                        <Select value={split.fromAccountId} onValueChange={(value) => updateSplit(index, { fromAccountId: value })}>
                          <SelectTrigger><SelectValue placeholder="From account" /></SelectTrigger>
                          <SelectContent>
                            {transferableAccounts.map((account) => (
                              <SelectItem key={account.id} value={String(account.id)}>{account.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>To</Label>
                        <Select value={split.toAccountId} onValueChange={(value) => updateSplit(index, { toAccountId: value })}>
                          <SelectTrigger><SelectValue placeholder="To account" /></SelectTrigger>
                          <SelectContent>
                            {transferableAccounts.map((account) => (
                              <SelectItem key={account.id} value={String(account.id)}>{account.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Note (optional)</Label>
                    <Textarea
                      placeholder="Add a note for this split..."
                      value={split.note}
                      onChange={(event) => updateSplit(index, { note: event.target.value })}
                      rows={2}
                    />
                  </div>
                </div>
              ))}

              <Button type="button" variant="outline" className="w-full" onClick={addSplitLine}>
                <Plus className="mr-2 h-4 w-4" />
                Add split line
              </Button>
            </div>
          )}

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
