"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Pause, Play, Repeat } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatCurrency } from "@/lib/utils";
import { deleteRecurringExpense, toggleRecurringActive } from "@/actions/recurring-expenses";
import { RecurringDialog } from "./recurring-dialog";
import type { ExpenseAccount, ExpenseRecurring } from "@/lib/types";

interface RecurringViewProps {
  recurringExpenses: ExpenseRecurring[];
  accounts: ExpenseAccount[];
}

const FREQUENCY_LABELS: Record<string, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export function RecurringView({ recurringExpenses, accounts }: RecurringViewProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRecurring | null>(null);

  async function handleDelete(id: number) {
    try {
      await deleteRecurringExpense(id);
      toast.success("Recurring expense deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete");
    }
  }

  async function handleToggle(id: number) {
    try {
      await toggleRecurringActive(id);
      toast.success("Status updated");
      router.refresh();
    } catch {
      toast.error("Failed to update");
    }
  }

  function handleEdit(item: ExpenseRecurring) {
    setEditing(item);
    setDialogOpen(true);
  }

  function handleAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  const monthlyTotal = recurringExpenses
    .filter((r) => r.isActive)
    .reduce((sum, r) => {
      if (r.frequency === "monthly") return sum + r.amount;
      if (r.frequency === "quarterly") return sum + r.amount / 3;
      if (r.frequency === "yearly") return sum + r.amount / 12;
      return sum;
    }, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Estimated monthly recurring: <span className="font-medium text-foreground">{formatCurrency(Math.round(monthlyTotal))}</span>
          </p>
        </div>
        <Button size="sm" onClick={handleAdd}>
          <Plus className="mr-1 h-4 w-4" />
          Add Recurring
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {recurringExpenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Repeat className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-muted-foreground mb-2">No recurring expenses set up</p>
              <Button variant="link" onClick={handleAdd}>
                <Plus className="mr-1 h-4 w-4" />
                Add your first recurring expense
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...recurringExpenses].sort((a, b) => a.dayOfMonth - b.dayOfMonth).map((item) => (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleEdit(item)}
                  >
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.categoryName || "—"}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400">
                        {FREQUENCY_LABELS[item.frequency]}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {item.dayOfMonth}{item.dayOfMonth === 1 ? "st" : item.dayOfMonth === 2 ? "nd" : item.dayOfMonth === 3 ? "rd" : "th"}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-rose-600">
                      {formatCurrency(item.amount)}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${item.isActive ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400" : "bg-stone-50 text-stone-500 dark:bg-stone-900 dark:text-stone-400"}`}>
                        {item.isActive ? "Active" : "Paused"}
                      </span>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleToggle(item.id)}
                          title={item.isActive ? "Pause" : "Resume"}
                        >
                          {item.isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Recurring Expense</AlertDialogTitle>
                              <AlertDialogDescription>
                                Delete &quot;{item.name}&quot;? Future estimated transactions will also be removed.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(item.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <RecurringDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(null); router.refresh(); }}
        recurring={editing}
        accounts={accounts}
      />
    </div>
  );
}
