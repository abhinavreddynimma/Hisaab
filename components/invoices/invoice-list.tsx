"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, Eye, Send, CheckCircle, XCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { updateInvoiceStatus, deleteInvoice } from "@/actions/invoices";
import { INVOICE_STATUSES } from "@/lib/constants";
import type { Invoice } from "@/lib/types";
import { formatForeignCurrency, formatCurrency, formatDate } from "@/lib/utils";

interface InvoiceListProps {
  invoices: (Invoice & { clientName: string })[];
  canEdit?: boolean;
}

export function InvoiceList({ invoices, canEdit = true }: InvoiceListProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("all");

  // Mark as Paid dialog state
  const [paidDialogOpen, setPaidDialogOpen] = useState(false);
  const [paidInvoice, setPaidInvoice] = useState<(Invoice & { clientName: string }) | null>(null);
  const [paidDate, setPaidDate] = useState<string>("");
  const [eurToInrRate, setEurToInrRate] = useState<string>("");
  const [platformCharges, setPlatformCharges] = useState<string>("0");
  const [bankCharges, setBankCharges] = useState<string>("0");

  const filteredInvoices =
    activeTab === "all"
      ? invoices
      : invoices.filter((inv) => inv.status === activeTab);

  const rate = parseFloat(eurToInrRate) || 0;
  const grossInr = paidInvoice ? paidInvoice.total * rate : 0;
  const netInr = grossInr - (parseFloat(platformCharges) || 0) - (parseFloat(bankCharges) || 0);

  function openPaidDialog(invoice: Invoice & { clientName: string }) {
    setPaidInvoice(invoice);
    setPaidDate(new Date().toISOString().split("T")[0]);
    setEurToInrRate("");
    setPlatformCharges("0");
    setBankCharges("0");
    setPaidDialogOpen(true);
  }

  async function handleMarkAsPaid() {
    if (!paidInvoice) return;
    if (!rate || rate <= 0) {
      toast.error(`Please enter a valid ${paidInvoice.currency} to INR conversion rate`);
      return;
    }
    if (!paidDate) {
      toast.error("Please select the payment date");
      return;
    }

    try {
      const result = await updateInvoiceStatus(paidInvoice.id, "paid", {
        paidDate,
        eurToInrRate: rate,
        platformCharges: parseFloat(platformCharges) || 0,
        bankCharges: parseFloat(bankCharges) || 0,
        netInrAmount: netInr,
      });
      if (result.success) {
        toast.success(`Invoice marked as Paid`);
        setPaidDialogOpen(false);
        router.refresh();
      }
    } catch {
      toast.error("Failed to update invoice status");
    }
  }

  async function handleStatusChange(
    id: number,
    status: "draft" | "sent" | "paid"
  ) {
    try {
      const result = await updateInvoiceStatus(id, status);
      if (result.success) {
        toast.success(`Invoice marked as ${INVOICE_STATUSES[status].label}`);
        router.refresh();
      }
    } catch {
      toast.error("Failed to update invoice status");
    }
  }

  async function handleCancel(id: number) {
    try {
      const result = await deleteInvoice(id);
      if (result.success) {
        toast.success("Invoice cancelled");
        router.refresh();
      }
    } catch {
      toast.error("Failed to cancel invoice");
    }
  }

  function renderTable(items: (Invoice & { clientName: string })[]) {
    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground">No invoices found.</p>
          {canEdit && (
            <Button asChild variant="link" className="mt-2">
              <Link href="/invoices/new">Create your first invoice</Link>
            </Button>
          )}
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice #</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Period</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Paid Date</TableHead>
            <TableHead>Status</TableHead>
            {canEdit && <TableHead className="w-[70px]">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((invoice) => {
            const statusConfig = INVOICE_STATUSES[invoice.status];
            return (
              <TableRow key={invoice.id}>
                <TableCell>
                  <Link
                    href={`/invoices/${invoice.id}`}
                    className="font-medium hover:underline"
                  >
                    {invoice.invoiceNumber}
                  </Link>
                </TableCell>
                <TableCell>{invoice.clientName}</TableCell>
                <TableCell>
                  {formatDate(invoice.billingPeriodStart)} &ndash;{" "}
                  {formatDate(invoice.billingPeriodEnd)}
                </TableCell>
                <TableCell className="text-right">
                  {formatForeignCurrency(invoice.total, invoice.currency)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {invoice.paidDate ? formatDate(invoice.paidDate) : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={statusConfig.variant} className={statusConfig.className}>
                    {statusConfig.label}
                  </Badge>
                </TableCell>
                {canEdit && (
                  <TableCell>
                    <AlertDialog>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/invoices/${invoice.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </Link>
                          </DropdownMenuItem>
                          {invoice.status !== "sent" && invoice.status !== "cancelled" && (
                            <DropdownMenuItem
                              onClick={() =>
                                handleStatusChange(invoice.id, "sent")
                              }
                            >
                              <Send className="mr-2 h-4 w-4" />
                              Mark as Sent
                            </DropdownMenuItem>
                          )}
                          {invoice.status !== "paid" && invoice.status !== "cancelled" && (
                            <DropdownMenuItem
                              onClick={() => openPaidDialog(invoice)}
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Mark as Paid
                            </DropdownMenuItem>
                          )}
                          {invoice.status !== "cancelled" && (
                            <>
                              <DropdownMenuSeparator />
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem className="text-destructive focus:text-destructive">
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Cancel Invoice
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cancel Invoice</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to cancel invoice{" "}
                            <strong>{invoice.invoiceNumber}</strong>? The invoice
                            will be marked as cancelled and kept for records.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Go Back</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleCancel(invoice.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Cancel Invoice
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
        {(() => {
          const paidItems = items.filter((inv) => inv.status === "paid");
          // Group totals by currency
          const byCurrency = items.reduce<Record<string, number>>((acc, inv) => {
            acc[inv.currency] = (acc[inv.currency] ?? 0) + inv.total;
            return acc;
          }, {});
          const currencyKeys = Object.keys(byCurrency);
          return (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="font-medium">
                  {items.length} invoice{items.length !== 1 ? "s" : ""}
                  {paidItems.length > 0 && paidItems.length < items.length && (
                    <span className="text-muted-foreground font-normal"> ({paidItems.length} paid)</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {currencyKeys.map((cur, i) => (
                    <span key={cur}>
                      {i > 0 && " + "}
                      {formatForeignCurrency(byCurrency[cur], cur)}
                    </span>
                  ))}
                </TableCell>
                <TableCell colSpan={canEdit ? 3 : 2} />
              </TableRow>
            </TableFooter>
          );
        })()}
      </Table>
    );
  }

  return (
    <>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">
            All ({invoices.length})
          </TabsTrigger>
          <TabsTrigger value="draft">
            Draft ({invoices.filter((i) => i.status === "draft").length})
          </TabsTrigger>
          <TabsTrigger value="sent">
            Sent ({invoices.filter((i) => i.status === "sent").length})
          </TabsTrigger>
          <TabsTrigger value="paid">
            Paid ({invoices.filter((i) => i.status === "paid").length})
          </TabsTrigger>
          <TabsTrigger value="cancelled">
            Cancelled ({invoices.filter((i) => i.status === "cancelled").length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value={activeTab} className="mt-4">
          {renderTable(filteredInvoices)}
        </TabsContent>
      </Tabs>

      {canEdit && (
        <Dialog open={paidDialogOpen} onOpenChange={setPaidDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Mark as Paid</DialogTitle>
              <DialogDescription>
                Enter the {paidInvoice?.currency ?? "EUR"} to INR conversion details for invoice{" "}
                <strong>{paidInvoice?.invoiceNumber}</strong>.
              </DialogDescription>
            </DialogHeader>
            {paidInvoice && (
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Invoice Total</span>
                  <span className="font-medium">{formatForeignCurrency(paidInvoice.total, paidInvoice.currency)}</span>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="paidDate">Payment Date</Label>
                  <Input
                    id="paidDate"
                    type="date"
                    value={paidDate}
                    onChange={(e) => setPaidDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eurToInrRate">{paidInvoice.currency} to INR Rate</Label>
                  <Input
                    id="eurToInrRate"
                    type="number"
                    min={0}
                    step="0.01"
                    value={eurToInrRate}
                    onChange={(e) => setEurToInrRate(e.target.value)}
                    placeholder="e.g. 89.50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="platformCharges">Platform Charges (INR)</Label>
                    <Input
                      id="platformCharges"
                      type="number"
                      min={0}
                      step="0.01"
                      value={platformCharges}
                      onChange={(e) => setPlatformCharges(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bankCharges">Bank Charges (INR)</Label>
                    <Input
                      id="bankCharges"
                      type="number"
                      min={0}
                      step="0.01"
                      value={bankCharges}
                      onChange={(e) => setBankCharges(e.target.value)}
                    />
                  </div>
                </div>
                <Separator />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gross INR</span>
                    <span className="font-medium">{formatCurrency(grossInr)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Net INR Realized</span>
                    <span className="font-semibold">{formatCurrency(netInr)}</span>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setPaidDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleMarkAsPaid}>Confirm Payment</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
