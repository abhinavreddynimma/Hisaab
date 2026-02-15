import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InvoiceList } from "@/components/invoices/invoice-list";
import { getInvoices, getInvoiceAttachmentCounts } from "@/actions/invoices";
import { requirePageAccess } from "@/lib/auth";

export default async function InvoicesPage() {
  const access = await requirePageAccess({ allowViewer: true });
  const canEdit = !access.sessionsEnabled || access.user?.role === "admin";
  const [invoices, attachmentCounts] = await Promise.all([
    getInvoices(),
    getInvoiceAttachmentCounts(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight">Invoices</h1>
        {canEdit && (
          <Button asChild>
            <Link href="/invoices/new">
              <Plus className="mr-2 h-4 w-4" />
              New Invoice
            </Link>
          </Button>
        )}
      </div>
      <InvoiceList invoices={invoices} canEdit={canEdit} attachmentCounts={attachmentCounts} />
    </div>
  );
}
