"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { createExpenseTarget, updateExpenseTarget, deleteExpenseTarget } from "@/actions/expenses";
import { EXPENSE_ACCOUNT_TYPES } from "@/lib/constants";
import type { ExpenseAccount, ExpenseTarget } from "@/lib/types";

interface TargetDialogProps {
  open: boolean;
  onClose: () => void;
  target: (ExpenseTarget & { accountIds: number[]; accountNames: string[] }) | null;
  accounts: ExpenseAccount[];
  financialYear: string;
}

export function TargetDialog({ open, onClose, target, accounts, financialYear }: TargetDialogProps) {
  const [name, setName] = useState("");
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (target) {
      setName(target.name);
      setMonthlyAmount(String(target.monthlyAmount));
      setSelectedAccounts(target.accountIds ?? []);
    } else {
      setName("");
      setMonthlyAmount("");
      setSelectedAccounts([]);
    }
  }, [target, open]);

  function toggleAccount(id: number) {
    setSelectedAccounts(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !monthlyAmount || selectedAccounts.length === 0) {
      toast.error("Please fill all fields and select at least one account");
      return;
    }

    setSaving(true);
    try {
      if (target) {
        await updateExpenseTarget(target.id, { name, monthlyAmount: parseFloat(monthlyAmount), accountIds: selectedAccounts });
        toast.success("Target updated");
      } else {
        await createExpenseTarget({ name, monthlyAmount: parseFloat(monthlyAmount), financialYear, accountIds: selectedAccounts });
        toast.success("Target created");
      }
      onClose();
    } catch {
      toast.error("Failed to save target");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!target) return;
    try {
      await deleteExpenseTarget(target.id);
      toast.success("Target deleted");
      onClose();
    } catch {
      toast.error("Failed to delete target");
    }
  }

  // Group accounts by type for easier selection
  const grouped = new Map<string, ExpenseAccount[]>();
  for (const acc of accounts) {
    const list = grouped.get(acc.type) ?? [];
    list.push(acc);
    grouped.set(acc.type, list);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{target ? "Edit" : "Create"} Target</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Target Name</Label>
            <Input placeholder="e.g. Total Investments, Market Portfolio" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Monthly Target (₹)</Label>
            <Input type="number" step="100" min="0" placeholder="50000" value={monthlyAmount} onChange={(e) => setMonthlyAmount(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Accounts</Label>
            <p className="text-xs text-muted-foreground">Select investment/savings accounts covered by this target</p>
            <div className="space-y-3 max-h-[250px] overflow-y-auto border rounded-lg p-3">
              {Array.from(grouped.entries()).map(([type, accs]) => (
                <div key={type}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    {EXPENSE_ACCOUNT_TYPES[type as keyof typeof EXPENSE_ACCOUNT_TYPES]?.label ?? type}
                  </p>
                  <div className="space-y-1.5 ml-1">
                    {accs.map(acc => (
                      <label key={acc.id} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox checked={selectedAccounts.includes(acc.id)} onCheckedChange={() => toggleAccount(acc.id)} />
                        <span className="text-sm">{acc.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <div>
              {target && (
                <Button type="button" variant="destructive" size="sm" onClick={handleDelete}>Delete</Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : target ? "Update" : "Create"}</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
