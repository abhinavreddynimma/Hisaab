"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TargetProgressCard } from "./target-progress-card";
import { TargetDialog } from "./target-dialog";
import type { ExpenseAccount, ExpenseTarget } from "@/lib/types";

interface TargetsViewProps {
  targets: (ExpenseTarget & { accountIds: number[]; accountNames: string[]; thisMonthActual: number; fyAverage: number })[];
  accounts: ExpenseAccount[];
  financialYear: string;
}

export function TargetsView({ targets, accounts, financialYear }: TargetsViewProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<(ExpenseTarget & { accountIds: number[]; accountNames: string[] }) | null>(null);

  const investmentSavingsAccounts = accounts.filter(
    a => (a.type === "investment" || a.type === "savings") && a.isActive && !a.parentId
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Monthly Targets</h2>
        <Button size="sm" onClick={() => { setEditingTarget(null); setDialogOpen(true); }}>
          <Plus className="mr-1 h-4 w-4" />
          Add Target
        </Button>
      </div>

      {targets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground mb-2">No targets set for FY {financialYear}</p>
          <Button variant="link" onClick={() => { setEditingTarget(null); setDialogOpen(true); }}>Set your first target</Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {targets.map(target => (
            <TargetProgressCard key={target.id} target={target} financialYear={financialYear} onEdit={() => { setEditingTarget(target); setDialogOpen(true); }} />
          ))}
        </div>
      )}

      <TargetDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditingTarget(null); router.refresh(); }}
        target={editingTarget}
        accounts={investmentSavingsAccounts}
        financialYear={financialYear}
      />
    </div>
  );
}
