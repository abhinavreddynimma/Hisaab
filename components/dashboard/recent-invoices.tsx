import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { INVOICE_STATUSES } from "@/lib/constants";
import { formatForeignCurrency, formatDate } from "@/lib/utils";
import type { InvoiceStatus } from "@/lib/constants";

interface RecentInvoicesProps {
  invoices: {
    id: number;
    invoiceNumber: string;
    clientName: string;
    total: number;
    currency: string;
    status: string;
    issueDate: string;
  }[];
}

export function RecentInvoices({ invoices }: RecentInvoicesProps) {
  if (invoices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-24 items-center justify-center text-muted-foreground">
            No invoices yet
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Invoices</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => {
              const statusConfig =
                INVOICE_STATUSES[invoice.status as InvoiceStatus];
              return (
                <TableRow key={invoice.id}>
                  <TableCell>
                    <Link
                      href={`/invoices/${invoice.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {invoice.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell>{invoice.clientName}</TableCell>
                  <TableCell>{formatForeignCurrency(invoice.total, invoice.currency)}</TableCell>
                  <TableCell>
                    {statusConfig ? (
                      <Badge variant={statusConfig.variant} className={statusConfig.className}>
                        {statusConfig.label}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">{invoice.status}</Badge>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(invoice.issueDate)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
