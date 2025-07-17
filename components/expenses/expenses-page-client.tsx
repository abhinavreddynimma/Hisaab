"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentFinancialYear } from "@/lib/constants";
import { TransactionList } from "./transaction-list";
import { TransactionDialog } from "./transaction-dialog";
import { StatsView } from "./stats-view";
import { BudgetsView } from "./budgets-view";
import { TargetsView } from "./targets-view";
import { AccountsList } from "./accounts-list";
import { RecurringView } from "./recurring-view";
import type { ExpenseAccount, ExpenseTransaction, ExpenseBudget, ExpenseTarget, ExpenseRecurring, ExpenseAccountType } from "@/lib/types";

interface ExpensesPageClientProps {
  accounts: ExpenseAccount[];
  accountsGrouped: {
    type: ExpenseAccountType;
    label: string;
    accounts: (ExpenseAccount & { children: ExpenseAccount[]; balance: number })[];
    totalBalance: number;
  }[];
  transactions: ExpenseTransaction[];
  stats: {
    totalIncome: number;
    totalExpenses: number;
    totalTransfersOut: number;
    net: number;
    incomeByCategory: { id: number; name: string; amount: number; percentage: number; color: string | null }[];
    expenseByCategory: { id: number; name: string; amount: number; percentage: number; color: string | null }[];
    transfersByType: { type: string; amount: number; percentage: number }[];
  };
  budgets: (ExpenseBudget & { categoryIds: number[]; categoryNames: string[]; spent: number })[];
  targets: ExpenseTarget[];
  recurringExpenses: ExpenseRecurring[];
  fyStats: {
    totalIncome: number;
    totalExpenses: number;
    totalTransfersOut: number;
    net: number;
    incomeByCategory: { id: number; name: string; amount: number; percentage: number; color: string | null }[];
    expenseByCategory: { id: number; name: string; amount: number; percentage: number; color: string | null }[];
    transfersByType: { type: string; amount: number; percentage: number }[];
  };
  fyOverview: {
    months: { month: string; year: number; monthNum: number; income: number; expense: number; net: number }[];
    totalIncome: number;
    totalExpenses: number;
  };
  currentMonth: number;
  currentYear: number;
  financialYear: string;
  initialTab?: string;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function ExpensesPageClient({
  accounts,
  accountsGrouped,
  transactions,
  stats,
  budgets,
  targets,
  recurringExpenses,
  fyStats,
  fyOverview,
  currentMonth,
  currentYear,
  financialYear,
  initialTab,
}: ExpensesPageClientProps) {
  const router = useRouter();
  const [txnDialogOpen, setTxnDialogOpen] = useState(false);
  const [editingTxn, setEditingTxn] = useState<ExpenseTransaction | null>(null);

  function navigateMonth(direction: -1 | 1) {
    let newMonth = currentMonth + direction;
    let newYear = currentYear;
    if (newMonth < 1) { newMonth = 12; newYear--; }
    if (newMonth > 12) { newMonth = 1; newYear++; }
    router.push(`/expenses?month=${newMonth}&year=${newYear}&fy=${financialYear}`);
  }

  function handleAddTxn() {
    setEditingTxn(null);
    setTxnDialogOpen(true);
  }

  function handleEditTxn(txn: ExpenseTransaction) {
    setEditingTxn(txn);
    setTxnDialogOpen(true);
  }

  function handleTxnDialogClose() {
    setTxnDialogOpen(false);
    setEditingTxn(null);
    router.refresh();
  }

  const isCurrentMonth = (() => {
    const now = new Date();
    return currentMonth === now.getMonth() + 1 && currentYear === now.getFullYear();
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Expenses</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigateMonth(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="text-muted-foreground text-sm">
              {MONTH_NAMES[currentMonth - 1]} {currentYear}
            </p>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigateMonth(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            {!isCurrentMonth && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => router.push("/expenses")}>
                Today
              </Button>
            )}
            <span className="text-xs text-muted-foreground ml-2">FY {financialYear}</span>
          </div>
        </div>
        <Button onClick={handleAddTxn}>
          <Plus className="mr-2 h-4 w-4" />
          Add Transaction
        </Button>
      </div>

      <Tabs defaultValue={initialTab || "transactions"}>
        <TabsList>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
          <TabsTrigger value="budgets">Budgets</TabsTrigger>
          <TabsTrigger value="targets">Targets</TabsTrigger>
          <TabsTrigger value="recurring">Recurring</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="mt-4">
          <TransactionList
            transactions={transactions}
            totalIncome={stats.totalIncome}
            totalExpenses={stats.totalExpenses + stats.totalTransfersOut}
            onEdit={handleEditTxn}
            onAddNew={handleAddTxn}
          />
        </TabsContent>

        <TabsContent value="stats" className="mt-4">
          <StatsView
            stats={stats}
            fyStats={fyStats}
            fyOverview={fyOverview}
            currentMonth={currentMonth}
            currentYear={currentYear}
            financialYear={financialYear}
          />
        </TabsContent>

        <TabsContent value="budgets" className="mt-4">
          <BudgetsView budgets={budgets} accounts={accounts} financialYear={financialYear} />
        </TabsContent>

        <TabsContent value="targets" className="mt-4">
          <TargetsView targets={targets} accounts={accounts} financialYear={financialYear} />
        </TabsContent>

        <TabsContent value="recurring" className="mt-4">
          <RecurringView recurringExpenses={recurringExpenses} accounts={accounts} />
        </TabsContent>

        <TabsContent value="accounts" className="mt-4">
          <AccountsList accountsGrouped={accountsGrouped} />
        </TabsContent>
      </Tabs>

      <TransactionDialog
        open={txnDialogOpen}
        onClose={handleTxnDialogClose}
        transaction={editingTxn}
        accounts={accounts}
      />
    </div>
  );
}
