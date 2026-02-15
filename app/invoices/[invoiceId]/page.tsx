import { notFound } from "next/navigation";
import { getInvoice, getInvoiceLineItems, getInvoiceAttachments } from "@/actions/invoices";
import { InvoicePreview } from "@/components/invoices/invoice-preview";
import { PaymentDetails } from "@/components/invoices/payment-details";
import { InvoiceAttachments } from "@/components/invoices/invoice-attachments";
import { Badge } from "@/components/ui/badge";
import { INVOICE_STATUSES } from "@/lib/constants";
import { InvoiceDetailActions } from "./invoice-detail-actions";
import { requirePageAccess } from "@/lib/auth";

interface InvoiceDetailPageProps {
  params: Promise<{ invoiceId: string }>;
}

export default async function InvoiceDetailPage({
  params,
}: InvoiceDetailPageProps) {
  const access = await requirePageAccess({ allowViewer: true });
  const canEdit = !access.sessionsEnabled || access.user?.role === "admin";

  const { invoiceId } = await params;
  const id = parseInt(invoiceId);

  if (isNaN(id)) {
    notFound();
  }

  const [invoice, lineItems, attachments] = await Promise.all([
    getInvoice(id),
    getInvoiceLineItems(id),
    getInvoiceAttachments(id),
  ]);

  if (!invoice) {
    notFound();
  }

  const statusConfig = INVOICE_STATUSES[invoice.status];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {invoice.invoiceNumber}
          </h1>
          <Badge variant={statusConfig.variant} className={statusConfig.className}>{statusConfig.label}</Badge>
        </div>
        <InvoiceDetailActions />
      </div>
      <InvoicePreview invoice={invoice} lineItems={lineItems} />
      {invoice.status === "paid" && (
        <>
          <PaymentDetails invoice={invoice} canEdit={canEdit} />
          <div id="attachments">
            <InvoiceAttachments
              invoiceId={invoice.id}
              attachments={attachments}
              canEdit={canEdit}
            />
          </div>
        </>
      )}
    </div>
  );
}
