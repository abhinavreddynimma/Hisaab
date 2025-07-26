"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { createExpenseBudget, updateExpenseBudget, deleteExpenseBudget } from "@/actions/expenses";
import type { ExpenseAccount, ExpenseBudget } from "@/lib/types";

interface BudgetDialogProps {
  open: boolean;
  onClose: () => void;
  budget: (ExpenseBudget & { categoryIds: number[]; categoryNames: string[]; spent: number }) | null;
  expenseCategories: ExpenseAccount[];
  financialYear: string;
}

export function BudgetDialog({ open, onClose, budget, expenseCategories, financialYear }: BudgetDialogProps) {
  const [name, setName] = useState("");
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (budget) {
      setName(budget.name);
      setMonthlyAmount(String(budget.monthlyAmount));
      setSelectedCategories(budget.categoryIds);
    } else {
      setName("");
      setMonthlyAmount("");
      setSelectedCategories([]);
    }
  }, [budget, open]);

  function toggleCategory(id: number) {
    setSelectedCategories(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !monthlyAmount || selectedCategories.length === 0) {
      toast.error("Please fill all fields and select at least one category");
      return;
    }

    setSaving(true);
    try {
      if (budget) {
        await updateExpenseBudget(budget.id, { name, monthlyAmount: parseFloat(monthlyAmount), categoryIds: selectedCategories });
        toast.success("Budget updated");
      } else {
        await createExpenseBudget({ name, monthlyAmount: parseFloat(monthlyAmount), financialYear, categoryIds: selectedCategories });
        toast.success("Budget created");
      }
      onClose();
    } catch {
      toast.error("Failed to save budget");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!budget) return;
    try {
      await deleteExpenseBudget(budget.id);
      toast.success("Budget deleted");
      onClose();
    } catch {
      toast.error("Failed to delete budget");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{budget ? "Edit" : "Create"} Budget</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Budget Name</Label>
            <Input placeholder="e.g. Living Expenses" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Monthly Amount (₹)</Label>
            <Input type="number" step="100" min="0" placeholder="30000" value={monthlyAmount} onChange={(e) => setMonthlyAmount(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Expense Categories</Label>
            <p className="text-xs text-muted-foreground">Select categories covered by this budget</p>
            <div className="space-y-2 max-h-[250px] overflow-y-auto border rounded-lg p-3">
              {expenseCategories.filter(c => !c.parentId).map(parent => {
                const children = expenseCategories.filter(c => c.parentId === parent.id);
                return (
                  <div key={parent.id}>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={selectedCategories.includes(parent.id)} onCheckedChange={() => toggleCategory(parent.id)} />
                      <span className="text-sm font-medium">{parent.name}</span>
                    </label>
                    {children.length > 0 && (
                      <div className="ml-5 mt-1 space-y-1">
                        {children.map(child => {
                          const grandchildren = expenseCategories.filter(gc => gc.parentId === child.id);
                          return (
                            <div key={child.id}>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <Checkbox checked={selectedCategories.includes(child.id)} onCheckedChange={() => toggleCategory(child.id)} />
                                <span className="text-sm">{child.name}</span>
                              </label>
                              {grandchildren.length > 0 && (
                                <div className="ml-5 mt-0.5 space-y-0.5">
                                  {grandchildren.map(gc => (
                                    <label key={gc.id} className="flex items-center gap-2 cursor-pointer">
                                      <Checkbox checked={selectedCategories.includes(gc.id)} onCheckedChange={() => toggleCategory(gc.id)} />
                                      <span className="text-xs text-muted-foreground">{gc.name}</span>
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <div>
              {budget && (
                <Button type="button" variant="destructive" size="sm" onClick={handleDelete}>Delete</Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : budget ? "Update" : "Create"}</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
