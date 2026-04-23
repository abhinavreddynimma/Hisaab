"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Printer, TrendingUp, ChevronLeft, ChevronRight, FileText, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { TAX_QUARTERS } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import { deleteTaxPayment } from "@/actions/tax-payments";
import { TaxPaymentDialog } from "./tax-payment-dialog";
import { getCurrentFinancialYear } from "@/lib/constants";
import type { TaxPayment, TaxPaymentAttachment, TaxQuarter } from "@/lib/types";

function shiftFY(fy: string, direction: -1 | 1): string {
  const startYear = parseInt(fy.split("-")[0]) + direction;
  return `${startYear}-${String(startYear + 1).slice(2)}`;
}

interface TaxComputation {
  grossReceipts: number;
  presumptiveIncome: number;
  taxableIncome: number;
  slabBreakdown: { slab: string; taxable: number; rate: number; tax: number }[];
  incomeTax: number;
  rebate87A: number;
  cess: number;
  totalTaxLiability: number;
  totalPaid: number;
  balance: number;
}

interface TaxProjection {
  monthlyBreakdown: {
    month: string;
    actual: number;
    projected: boolean;
    workingDays?: number;
    invoiceBased?: boolean;
    calendarBreakdown?: {
      weekdayWorkingDays: number;
      publicHolidayWorkingDays: number;
      weekendWorkingDays: number;
    };
  }[];
  monthsElapsed: number;
  monthsRemaining: number;
  avgRate: number;
  mode: "auto" | "invoice" | "calendar";
  modeSummary: string;
  rateSourceLabel: string;
  projectedGrossReceipts: number;
  projectedPresumptiveIncome: number;
  projectedTaxableIncome: number;
  slabBreakdown: { slab: string; taxable: number; rate: number; tax: number }[];
  projectedIncomeTax: number;
  projectedRebate87A: number;
  projectedCess: number;
  projectedTotalTax: number;
  totalPaid: number;
  projectedBalance: number;
}

interface TaxPageClientProps {
  initialPayments: TaxPayment[];
  initialSummary: { byQuarter: Record<TaxQuarter, number>; total: number };
  initialFY: string;
  computation: TaxComputation;
  projection: TaxProjection;
  initialProjectionMode: "auto" | "invoice" | "calendar";
  attachmentsByPaymentId: Record<number, TaxPaymentAttachment[]>;
}

export function TaxPageClient({
  initialPayments,
  initialSummary,
  initialFY,
  computation,
  projection,
  initialProjectionMode,
  attachmentsByPaymentId,
}: TaxPageClientProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<TaxPayment | null>(null);

  function setProjectionMode(mode: "auto" | "invoice" | "calendar") {
    const params = new URLSearchParams();
    params.set("fy", initialFY);
    if (mode !== "auto") {
      params.set("pm", mode);
    }
    router.push(`/tax?${params.toString()}`);
  }

  function handleAdd() {
    setEditingPayment(null);
    setDialogOpen(true);
  }

  function handleEdit(payment: TaxPayment) {
    setEditingPayment(payment);
    setDialogOpen(true);
  }

  async function handleDelete(id: number) {
    try {
      const result = await deleteTaxPayment(id);
      if (result.success) {
        toast.success("Tax payment deleted");
        router.refresh();
      }
    } catch {
      toast.error("Failed to delete tax payment");
    }
  }

  function handleDialogClose() {
    setDialogOpen(false);
    setEditingPayment(null);
    router.refresh();
  }

  const quarters = (["Q1", "Q2", "Q3", "Q4"] as const);

  function formatDayCount(days: number) {
    return Number.isInteger(days) ? String(days) : days.toFixed(1);
  }

  const presumptiveLimit = 7500000;
  const actualExceeds44AdaLimit = computation.grossReceipts > presumptiveLimit;
  const projectedExceeds44AdaLimit = projection.projectedGrossReceipts > presumptiveLimit;
  const yearlyCalendarBreakdown = projection.monthlyBreakdown.reduce(
    (totals, month) => {
      if (!month.calendarBreakdown) return totals;
      totals.weekdayWorkingDays += month.calendarBreakdown.weekdayWorkingDays;
      totals.publicHolidayWorkingDays += month.calendarBreakdown.publicHolidayWorkingDays;
      totals.weekendWorkingDays += month.calendarBreakdown.weekendWorkingDays;
      return totals;
    },
    {
      weekdayWorkingDays: 0,
      publicHolidayWorkingDays: 0,
      weekendWorkingDays: 0,
    }
  );
  const hasYearlyCalendarBreakdown =
    yearlyCalendarBreakdown.weekdayWorkingDays > 0 ||
    yearlyCalendarBreakdown.publicHolidayWorkingDays > 0 ||
    yearlyCalendarBreakdown.weekendWorkingDays > 0;
  const yearlyCalendarWorkingDays =
    yearlyCalendarBreakdown.weekdayWorkingDays +
    yearlyCalendarBreakdown.publicHolidayWorkingDays +
    yearlyCalendarBreakdown.weekendWorkingDays;
  const excessOver44AdaLimit = Math.max(0, projection.projectedGrossReceipts - presumptiveLimit);
  const estimatedReceiptsPerDay =
    yearlyCalendarWorkingDays > 0 ? projection.projectedGrossReceipts / yearlyCalendarWorkingDays : 0;
  const daysToTrimFor44Ada =
    excessOver44AdaLimit > 0 && estimatedReceiptsPerDay > 0
      ? Math.ceil((excessOver44AdaLimit / estimatedReceiptsPerDay) * 2) / 2
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Advance Tax</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 no-print"
              onClick={() => router.push(`/tax?fy=${shiftFY(initialFY, -1)}`)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="text-muted-foreground text-sm">
              FY {initialFY} &middot; Section 44ADA (New Regime)
            </p>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 no-print"
              onClick={() => router.push(`/tax?fy=${shiftFY(initialFY, 1)}`)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {initialFY !== getCurrentFinancialYear() && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs no-print"
                onClick={() => router.push("/tax")}
              >
                Current
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="no-print" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button className="no-print" onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add Payment
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="no-print-tabs">
        <TabsList className="no-print">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="projection">
            <TrendingUp className="mr-1.5 h-3.5 w-3.5" />
            Projection
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">
          {actualExceeds44AdaLimit && (
            <div className="rounded-lg border border-red-500/40 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-300">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Gross receipts have crossed ₹75 lakh for FY {initialFY}. Section 44ADA does not apply above this threshold.
                  The ₹75 lakh limit itself applies only when cash receipts are at most 5%; otherwise the limit is ₹50 lakh.
                </p>
              </div>
            </div>
          )}

          {/* Tax Computation */}
          <Card>
            <CardHeader>
              <CardTitle>Tax Computation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gross Receipts (INR received)</span>
                  <span className="font-medium tabular-nums">{formatCurrency(computation.grossReceipts)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Presumptive Income (50% u/s 44ADA)</span>
                  <span className="font-medium tabular-nums">{formatCurrency(computation.presumptiveIncome)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Taxable Income</span>
                  <span className="tabular-nums">{formatCurrency(computation.taxableIncome)}</span>
                </div>

                {/* Slab Breakdown */}
                <div className="mt-4 rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Slab</TableHead>
                        <TableHead className="text-xs text-right">Taxable</TableHead>
                        <TableHead className="text-xs text-right">Rate</TableHead>
                        <TableHead className="text-xs text-right">Tax</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {computation.slabBreakdown.map((s) => (
                        <TableRow key={s.slab}>
                          <TableCell className="text-xs">{s.slab}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{formatCurrency(s.taxable)}</TableCell>
                          <TableCell className="text-xs text-right">{(s.rate * 100).toFixed(0)}%</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{formatCurrency(s.tax)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-between pt-2">
                  <span className="text-muted-foreground">Income Tax</span>
                  <span className="font-medium tabular-nums">{formatCurrency(computation.incomeTax)}</span>
                </div>
                {computation.rebate87A > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Less: Rebate u/s 87A</span>
                    <span className="font-medium tabular-nums text-green-600">-{formatCurrency(computation.rebate87A)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Health & Education Cess (4%)</span>
                  <span className="font-medium tabular-nums">{formatCurrency(computation.cess)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-base font-bold">
                  <span>
                    Total Tax Liability
                    {computation.grossReceipts > 0 && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        ({((computation.totalTaxLiability / computation.grossReceipts) * 100).toFixed(1)}% effective)
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums">{formatCurrency(computation.totalTaxLiability)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Advance Tax Paid</span>
                  <span className="font-medium tabular-nums text-green-600">-{formatCurrency(computation.totalPaid)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-base font-bold">
                  <span>{computation.balance >= 0 ? "Balance Payable" : "Refund Due"}</span>
                  <span className={`tabular-nums ${computation.balance > 0 ? "text-red-600" : "text-green-600"}`}>
                    {formatCurrency(Math.abs(computation.balance))}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quarter Summary Cards */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 print:break-before-page">
            {quarters.map((q) => {
              const config = TAX_QUARTERS[q];
              const paid = initialSummary.byQuarter[q];
              return (
                <Card key={q}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-muted-foreground">{config.label}</p>
                      <span className="text-[10px] text-muted-foreground">Due: {config.dueDate}</span>
                    </div>
                    <p className="text-2xl font-bold tabular-nums">
                      {paid > 0 ? formatCurrency(paid) : "—"}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Payments Table */}
          <Card>
            <CardHeader>
              <CardTitle>Payments</CardTitle>
            </CardHeader>
            <CardContent>
              {initialPayments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-muted-foreground">No tax payments recorded yet.</p>
                  <Button variant="link" className="mt-2 no-print" onClick={handleAdd}>
                    Record your first payment
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Quarter</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Challan No</TableHead>
                      <TableHead>Attachments</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="w-[80px] no-print">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {initialPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                        <TableCell>{TAX_QUARTERS[payment.quarter].label}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatCurrency(payment.amount)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {payment.challanNo || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {(attachmentsByPaymentId[payment.id]?.length || 0) > 0 ? (
                            <div className="space-y-0.5">
                              {attachmentsByPaymentId[payment.id].map((att) => (
                                <a
                                  key={att.id}
                                  href={`/hisaab/api/tax-attachments/${att.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                                >
                                  <FileText className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate max-w-[150px]">{att.originalName}</span>
                                </a>
                              ))}
                            </div>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">
                          {payment.notes || "—"}
                        </TableCell>
                        <TableCell className="no-print">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleEdit(payment)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Payment</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this tax payment of {formatCurrency(payment.amount)}?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(payment.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projection" className="space-y-6 mt-4">
          {projectedExceeds44AdaLimit && (
            <div className="rounded-lg border border-red-500/40 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-300">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Projected gross receipts have crossed ₹75 lakh for FY {initialFY}. Section 44ADA does not apply above this threshold.
                  The ₹75 lakh limit itself applies only when cash receipts are at most 5%; otherwise the limit is ₹50 lakh.
                </p>
              </div>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Projection Source</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "auto", label: "Auto" },
                  { value: "invoice", label: "Invoice-based" },
                  { value: "calendar", label: "Calendar-based" },
                ].map((option) => (
                  <Button
                    key={option.value}
                    variant={initialProjectionMode === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setProjectionMode(option.value as "auto" | "invoice" | "calendar")}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>

              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">{projection.modeSummary}</p>
                <p className="text-muted-foreground">
                  {projection.mode === "calendar"
                    ? `${projection.rateSourceLabel}. Calendar mode projects from the default project's daily rate and current working days.`
                    : projection.rateSourceLabel}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Income Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Monthly Income (Apr–Mar)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-6 gap-3">
                {projection.monthlyBreakdown.map((m) => (
                  <div
                    key={m.month}
                    className={cn(
                      "rounded-lg border p-3 text-center",
                      m.projected && "border-dashed bg-muted/30"
                    )}
                  >
                    <p className="text-xs font-medium text-muted-foreground mb-1">{m.month}{m.projected ? "*" : ""}</p>
                    <p className={cn(
                      "text-sm font-semibold tabular-nums",
                      m.projected && "text-muted-foreground italic"
                    )}>
                      {m.actual > 0 ? formatCurrency(m.actual) : "—"}
                    </p>
                    {m.projected && m.invoiceBased && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">Invoice sent</p>
                    )}
                    {m.projected && !m.invoiceBased && m.workingDays !== undefined && (
                      <div className="mt-0.5 space-y-0.5">
                        <p className="text-[10px] text-muted-foreground">
                          {formatDayCount(m.workingDays)} days / ₹{projection.avgRate.toFixed(2)}
                        </p>
                        {m.calendarBreakdown && (
                          <div className="flex items-center justify-center gap-1.5 text-[10px] font-medium tabular-nums leading-tight">
                            <span className="text-slate-600 dark:text-slate-300">
                              {formatDayCount(m.calendarBreakdown.weekdayWorkingDays)}
                            </span>
                            <span className="text-violet-600 dark:text-violet-400">
                              {formatDayCount(m.calendarBreakdown.publicHolidayWorkingDays)}
                            </span>
                            <span className="text-emerald-600 dark:text-emerald-400">
                              {formatDayCount(m.calendarBreakdown.weekendWorkingDays)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {hasYearlyCalendarBreakdown && (
                <div className="mt-5 rounded-xl border bg-muted/20 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">Financial Year Total</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDayCount(yearlyCalendarWorkingDays)} total working days from calendar mode
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-sm font-semibold tabular-nums">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                      {formatDayCount(yearlyCalendarBreakdown.weekdayWorkingDays)}
                    </span>
                    <span className="rounded-full bg-violet-100 px-2.5 py-1 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
                      {formatDayCount(yearlyCalendarBreakdown.publicHolidayWorkingDays)}
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                      {formatDayCount(yearlyCalendarBreakdown.weekendWorkingDays)}
                    </span>
                    </div>
                  </div>
                  {projection.mode === "calendar" && daysToTrimFor44Ada > 0 && (
                    <p className="mt-3 text-xs text-red-600 dark:text-red-400">
                      To come under the ₹75 lakh limit at the current projection, you need to remove about{" "}
                      {formatDayCount(daysToTrimFor44Ada)} working day{daysToTrimFor44Ada === 1 ? "" : "s"} or take the same number of additional leave day{daysToTrimFor44Ada === 1 ? "" : "s"}.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {projection.mode === "calendar" ? (
            <p className="text-xs text-muted-foreground">
              * Calendar mode models the full FY from calendar days and the active project rate, so the day split is shown for the whole year.
            </p>
          ) : projection.monthsRemaining > 0 && (() => {
            const invoiceCount = projection.monthlyBreakdown.filter((m) => m.invoiceBased).length;
            const workingDaysCount = projection.monthsRemaining - invoiceCount;
            const parts: string[] = [];
            if (invoiceCount > 0) parts.push(`${invoiceCount} from sent invoices`);
            if (workingDaysCount > 0) parts.push(`${workingDaysCount} from calendar working days`);
            return (
              <p className="text-xs text-muted-foreground">
                * Based on {projection.monthsElapsed} month{projection.monthsElapsed !== 1 ? "s" : ""} of actual data, projecting {projection.monthsRemaining} remaining month{projection.monthsRemaining !== 1 ? "s" : ""}{parts.length > 0 ? ` (${parts.join(", ")})` : ""}.
              </p>
            );
          })()}

          {/* Projected Tax Computation */}
          <Card className="print:break-before-page">
            <CardHeader>
              <CardTitle className="text-base">Projected Tax Computation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Projected Gross Receipts (12 months)</span>
                  <span className="font-medium tabular-nums">{formatCurrency(projection.projectedGrossReceipts)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Presumptive Income (50% u/s 44ADA)</span>
                  <span className="font-medium tabular-nums">{formatCurrency(projection.projectedPresumptiveIncome)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Projected Taxable Income</span>
                  <span className="tabular-nums">{formatCurrency(projection.projectedTaxableIncome)}</span>
                </div>

                {/* Slab Breakdown */}
                <div className="mt-4 rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Slab</TableHead>
                        <TableHead className="text-xs text-right">Taxable</TableHead>
                        <TableHead className="text-xs text-right">Rate</TableHead>
                        <TableHead className="text-xs text-right">Tax</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projection.slabBreakdown.map((s) => (
                        <TableRow key={s.slab}>
                          <TableCell className="text-xs">{s.slab}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{formatCurrency(s.taxable)}</TableCell>
                          <TableCell className="text-xs text-right">{(s.rate * 100).toFixed(0)}%</TableCell>
                          <TableCell className="text-xs text-right tabular-nums">{formatCurrency(s.tax)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-between pt-2">
                  <span className="text-muted-foreground">Projected Income Tax</span>
                  <span className="font-medium tabular-nums">{formatCurrency(projection.projectedIncomeTax)}</span>
                </div>
                {projection.projectedRebate87A > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Less: Rebate u/s 87A</span>
                    <span className="font-medium tabular-nums text-green-600">-{formatCurrency(projection.projectedRebate87A)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Health & Education Cess (4%)</span>
                  <span className="font-medium tabular-nums">{formatCurrency(projection.projectedCess)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-base font-bold">
                  <span>
                    Projected Total Tax
                    {projection.projectedGrossReceipts > 0 && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        ({((projection.projectedTotalTax / projection.projectedGrossReceipts) * 100).toFixed(1)}% effective)
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums">{formatCurrency(projection.projectedTotalTax)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Advance Tax Paid</span>
                  <span className="font-medium tabular-nums text-green-600">-{formatCurrency(initialSummary.total)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-base font-bold">
                  <span>{projection.projectedTotalTax - initialSummary.total >= 0 ? "Estimated Balance Payable" : "Estimated Refund Due"}</span>
                  <span className={`tabular-nums ${projection.projectedTotalTax - initialSummary.total > 0 ? "text-red-600" : "text-green-600"}`}>
                    {formatCurrency(Math.abs(projection.projectedTotalTax - initialSummary.total))}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quarter Summary Cards */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {quarters.map((q) => {
              const config = TAX_QUARTERS[q];
              const paid = initialSummary.byQuarter[q];
              return (
                <Card key={q}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-muted-foreground">{config.label}</p>
                      <span className="text-[10px] text-muted-foreground">Due: {config.dueDate}</span>
                    </div>
                    <p className="text-2xl font-bold tabular-nums">
                      {paid > 0 ? formatCurrency(paid) : "—"}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      <TaxPaymentDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        payment={editingPayment}
        financialYear={initialFY}
        attachments={editingPayment ? attachmentsByPaymentId[editingPayment.id] || [] : []}
      />
    </div>
  );
}
