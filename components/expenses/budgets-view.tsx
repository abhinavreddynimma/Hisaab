"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BudgetProgressCard } from "./budget-progress-card";
import { BudgetDialog } from "./budget-dialog";
import type { ExpenseAccount, ExpenseBudget } from "@/lib/types";

interface BudgetsViewProps {
  budgets: (ExpenseBudget & { categoryIds: number[]; categoryNames: string[]; spent: number })[];
  accounts: ExpenseAccount[];
  financialYear: string;
}

export function BudgetsView({ budgets, accounts, financialYear }: BudgetsViewProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<(ExpenseBudget & { categoryIds: number[]; categoryNames: string[]; spent: number }) | null>(null);

  const expenseCategories = accounts.filter(a => a.type === "expense" && !a.parentId && a.isActive);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Monthly Budgets</h2>
        <Button size="sm" onClick={() => { setEditingBudget(null); setDialogOpen(true); }}>
          <Plus className="mr-1 h-4 w-4" />
          Add Budget
        </Button>
      </div>

      {budgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground mb-2">No budgets set for FY {financialYear}</p>
          <Button variant="link" onClick={() => { setEditingBudget(null); setDialogOpen(true); }}>Create your first budget</Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {budgets.map(budget => (
            <BudgetProgressCard key={budget.id} budget={budget} onClick={() => { setEditingBudget(budget); setDialogOpen(true); }} />
          ))}
        </div>
      )}

      <BudgetDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditingBudget(null); router.refresh(); }}
        budget={editingBudget}
        expenseCategories={expenseCategories}
        financialYear={financialYear}
      />
    </div>
  );
}
