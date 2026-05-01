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
    totalTax: number;
    totalTransfersOut: number;
    net: number;
    balance: number;
    incomeByCategory: { id: number; name: string; amount: number; percentage: number; color: string | null }[];
    expenseByCategory: { id: number; name: string; amount: number; percentage: number; color: string | null; subCategories: { id: number; name: string; amount: number; percentage: number; color: string | null }[] }[];
    transfersByType: { type: string; amount: number; percentage: number; subCategories: { id: number; name: string; amount: number; percentage: number; color: string | null }[] }[];
    topLevelSplit: { postTaxIncome: number; investments: { amount: number; percentage: number }; savings: { amount: number; percentage: number }; expenses: { amount: number; percentage: number } };
  };
  budgets: (ExpenseBudget & { categoryIds: number[]; categoryNames: string[]; spent: number })[];
  targets: (ExpenseTarget & { accountIds: number[]; accountNames: string[]; thisMonthActual: number; fyAverage: number })[];
  recurringExpenses: ExpenseRecurring[];
  fyStats: {
    totalIncome: number;
    totalExpenses: number;
    totalTax: number;
    totalTransfersOut: number;
    net: number;
    balance: number;
    incomeByCategory: { id: number; name: string; amount: number; percentage: number; color: string | null }[];
    expenseByCategory: { id: number; name: string; amount: number; percentage: number; color: string | null; subCategories: { id: number; name: string; amount: number; percentage: number; color: string | null }[] }[];
    transfersByType: { type: string; amount: number; percentage: number; subCategories: { id: number; name: string; amount: number; percentage: number; color: string | null }[] }[];
    topLevelSplit: { postTaxIncome: number; investments: { amount: number; percentage: number }; savings: { amount: number; percentage: number }; expenses: { amount: number; percentage: number } };
  };
  fyOverview: {
    months: { month: string; year: number; monthNum: number; income: number; expense: number; net: number; cumulativeNet: number }[];
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
    // Auto-update FY based on month
    const newFY = newMonth >= 4 ? `${newYear}-${String(newYear + 1).slice(2)}` : `${newYear - 1}-${String(newYear).slice(2)}`;
    router.push(`/expenses?month=${newMonth}&year=${newYear}&fy=${newFY}`);
  }

  function navigateFY(direction: -1 | 1) {
    const [startStr] = financialYear.split("-");
    const startYear = parseInt(startStr) + direction;
    const newFY = `${startYear}-${String(startYear + 1).slice(2)}`;
    // Jump to April of the new FY (or current month if in current FY)
    const now = new Date();
    const currentFY = now.getMonth() >= 3 ? `${now.getFullYear()}-${String(now.getFullYear() + 1).slice(2)}` : `${now.getFullYear() - 1}-${String(now.getFullYear()).slice(2)}`;
    if (newFY === currentFY) {
      router.push(`/expenses?fy=${newFY}`);
    } else {
      router.push(`/expenses?month=4&year=${startYear}&fy=${newFY}`);
    }
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
            <span className="flex items-center gap-1 ml-2">
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => navigateFY(-1)}>
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <span className="text-xs text-muted-foreground">FY {financialYear}</span>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => navigateFY(1)}>
                <ChevronRight className="h-3 w-3" />
              </Button>
            </span>
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
            balance={stats.balance}
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
