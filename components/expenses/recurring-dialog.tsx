"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createRecurringExpense, updateRecurringExpense } from "@/actions/recurring-expenses";
import type { ExpenseAccount, ExpenseRecurring, RecurringFrequency } from "@/lib/types";

interface RecurringDialogProps {
  open: boolean;
  onClose: () => void;
  recurring: ExpenseRecurring | null;
  accounts: ExpenseAccount[];
}

export function RecurringDialog({ open, onClose, recurring, accounts }: RecurringDialogProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"expense" | "transfer">("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [fromAccountId, setFromAccountId] = useState<string>("");
  const [toAccountId, setToAccountId] = useState<string>("");
  const [frequency, setFrequency] = useState<RecurringFrequency>("monthly");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (recurring) {
      setName(recurring.name);
      setType(recurring.type as "expense" | "transfer");
      setAmount(String(recurring.amount));
      setCategoryId(recurring.categoryId ? String(recurring.categoryId) : "");
      setFromAccountId(recurring.fromAccountId ? String(recurring.fromAccountId) : "");
      setToAccountId(recurring.toAccountId ? String(recurring.toAccountId) : "");
      setFrequency(recurring.frequency);
      setDayOfMonth(String(recurring.dayOfMonth));
      setStartDate(recurring.startDate);
      setEndDate(recurring.endDate || "");
    } else {
      setName("");
      setType("expense");
      setAmount("");
      setCategoryId("");
      setFromAccountId("");
      setToAccountId("");
      setFrequency("monthly");
      setDayOfMonth("1");
      setStartDate(new Date().toISOString().split("T")[0]);
      setEndDate("");
    }
  }, [recurring, open]);

  const expenseCategories = accounts.filter((a) => a.type === "expense");
  const transferAccounts = accounts.filter((a) => ["bank", "cash", "investment", "savings"].includes(a.type));

  async function handleSave() {
    if (!name || !amount || parseFloat(amount) <= 0) {
      toast.error("Please fill in name and amount");
      return;
    }

    setSaving(true);
    try {
      const data = {
        name,
        type: type as "expense" | "transfer",
        amount: parseFloat(amount),
        categoryId: type === "expense" && categoryId ? parseInt(categoryId) : null,
        fromAccountId: type === "transfer" && fromAccountId ? parseInt(fromAccountId) : null,
        toAccountId: type === "transfer" && toAccountId ? parseInt(toAccountId) : null,
        frequency,
        dayOfMonth: parseInt(dayOfMonth),
        startDate,
        endDate: endDate || null,
      };

      if (recurring) {
        await updateRecurringExpense(recurring.id, data);
        toast.success("Recurring expense updated");
      } else {
        await createRecurringExpense(data);
        toast.success("Recurring expense created");
      }
      onClose();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{recurring ? "Edit" : "Add"} Recurring Expense</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              placeholder="e.g., Rent, Netflix, SIP"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as "expense" | "transfer")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>

          {type === "expense" && (
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {expenseCategories.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {type === "transfer" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>From</Label>
                <Select value={fromAccountId} onValueChange={setFromAccountId}>
                  <SelectTrigger><SelectValue placeholder="From account" /></SelectTrigger>
                  <SelectContent>
                    {transferAccounts.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>To</Label>
                <Select value={toAccountId} onValueChange={setToAccountId}>
                  <SelectTrigger><SelectValue placeholder="To account" /></SelectTrigger>
                  <SelectContent>
                    {transferAccounts.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as RecurringFrequency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Day of Month</Label>
              <Input
                type="number"
                min={1}
                max={28}
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={!!recurring}
              />
            </div>
            <div className="space-y-1.5">
              <Label>End Date (optional)</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : recurring ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
