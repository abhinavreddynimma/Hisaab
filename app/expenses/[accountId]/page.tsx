import { requirePageAccess } from "@/lib/auth";
import { getAccountDrillDown, getExpenseBudgets, getExpenseTargets } from "@/actions/expenses";
import { getCurrentFinancialYear, getFYDateRange } from "@/lib/constants";
import { AccountDetailView } from "@/components/expenses/account-detail-view";

interface AccountDetailPageProps {
  params: Promise<{ accountId: string }>;
}

export default async function AccountDetailPage({ params }: AccountDetailPageProps) {
  await requirePageAccess();

  const { accountId } = await params;
  const id = parseInt(accountId);
  const fy = getCurrentFinancialYear();
  const { start, end } = getFYDateRange(fy);

  const [drillDown, budgets, targets] = await Promise.all([
    getAccountDrillDown(id, start, end),
    getExpenseBudgets(fy),
    getExpenseTargets(fy),
  ]);

  return (
    <AccountDetailView
      drillDown={drillDown}
      budgets={budgets}
      targets={targets}
      financialYear={fy}
    />
  );
}
