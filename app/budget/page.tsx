import { requirePageAccess } from "@/lib/auth";
import { getBudgetItems, getBudgetMonthlyIncome } from "@/actions/budget";
import { BudgetClient } from "@/components/budget/budget-client";
import "./budget.css";

export default async function BudgetPage() {
  await requirePageAccess();

  const [items, income] = await Promise.all([
    getBudgetItems(),
    getBudgetMonthlyIncome(),
  ]);

  return (
    <BudgetClient
      initialItems={items}
      monthlyIncome={income.monthlyIncome}
      monthsCounted={income.monthsCounted}
    />
  );
}
