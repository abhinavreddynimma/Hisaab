import { getTaxPayments, getTaxSummaryForFY, getTaxComputation, getTaxProjection } from "@/actions/tax-payments";
import { getCurrentFinancialYear } from "@/lib/constants";
import { TaxPageClient } from "@/components/tax/tax-page-client";
import { requirePageAccess } from "@/lib/auth";

interface TaxPageProps {
  searchParams: Promise<{ fy?: string }>;
}

export default async function TaxPage({ searchParams }: TaxPageProps) {
  await requirePageAccess();

  const params = await searchParams;
  const fy = params.fy || getCurrentFinancialYear();
  const [payments, summary, computation, projection] = await Promise.all([
    getTaxPayments(fy),
    getTaxSummaryForFY(fy),
    getTaxComputation(fy),
    getTaxProjection(fy),
  ]);

  return (
    <TaxPageClient
      initialPayments={payments}
      initialSummary={summary}
      initialFY={fy}
      computation={computation}
      projection={projection}
    />
  );
}
