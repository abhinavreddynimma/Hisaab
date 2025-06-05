"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createExpenseTarget, updateExpenseTarget, deleteExpenseTarget } from "@/actions/expenses";
import { EXPENSE_ACCOUNT_TYPES } from "@/lib/constants";
import type { ExpenseAccount, ExpenseTarget } from "@/lib/types";

interface TargetDialogProps {
  open: boolean;
  onClose: () => void;
  target: ExpenseTarget | null;
  accounts: ExpenseAccount[];
  financialYear: string;
}

export function TargetDialog({ open, onClose, target, accounts, financialYear }: TargetDialogProps) {
  const [accountId, setAccountId] = useState("");
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (target) {
      setAccountId(String(target.accountId));
      setMonthlyAmount(String(target.monthlyAmount));
    } else {
      setAccountId("");
      setMonthlyAmount("");
    }
  }, [target, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId || !monthlyAmount) {
      toast.error("Please fill all fields");
      return;
    }

    setSaving(true);
    try {
      if (target) {
        await updateExpenseTarget(target.id, { monthlyAmount: parseFloat(monthlyAmount) });
        toast.success("Target updated");
      } else {
        await createExpenseTarget({ accountId: parseInt(accountId), monthlyAmount: parseFloat(monthlyAmount), financialYear });
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

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{target ? "Edit" : "Add"} Target</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Account</Label>
            <Select value={accountId} onValueChange={setAccountId} disabled={!!target}>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                {accounts.map(a => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.name} ({EXPENSE_ACCOUNT_TYPES[a.type].label})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Monthly Target (₹)</Label>
            <Input type="number" step="100" min="0" placeholder="50000" value={monthlyAmount} onChange={(e) => setMonthlyAmount(e.target.value)} />
          </div>

          <div className="flex justify-between pt-2">
            <div>{target && <Button type="button" variant="destructive" size="sm" onClick={handleDelete}>Delete</Button>}</div>
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
