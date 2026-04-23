import { getTaxPayments, getTaxSummaryForFY, getTaxComputation, getTaxProjection, getTaxPaymentAttachments, type TaxProjectionMode } from "@/actions/tax-payments";
import { getCurrentFinancialYear } from "@/lib/constants";
import { TaxPageClient } from "@/components/tax/tax-page-client";
import { requirePageAccess } from "@/lib/auth";
import type { TaxPaymentAttachment } from "@/lib/types";

interface TaxPageProps {
  searchParams: Promise<{ fy?: string; pm?: string }>;
}

export default async function TaxPage({ searchParams }: TaxPageProps) {
  await requirePageAccess();

  const params = await searchParams;
  const fy = params.fy || getCurrentFinancialYear();
  const projectionMode: TaxProjectionMode =
    params.pm === "invoice" || params.pm === "calendar" ? params.pm : "auto";
  const [payments, summary, computation, projection] = await Promise.all([
    getTaxPayments(fy),
    getTaxSummaryForFY(fy),
    getTaxComputation(fy),
    getTaxProjection(fy, projectionMode),
  ]);

  // Fetch attachments for all payments
  const attachmentsByPaymentId: Record<number, TaxPaymentAttachment[]> = {};
  await Promise.all(
    payments.map(async (p) => {
      attachmentsByPaymentId[p.id] = await getTaxPaymentAttachments(p.id);
    })
  );

  return (
    <TaxPageClient
      initialPayments={payments}
      initialSummary={summary}
      initialFY={fy}
      computation={computation}
      projection={projection}
      initialProjectionMode={projectionMode}
      attachmentsByPaymentId={attachmentsByPaymentId}
    />
  );
}
