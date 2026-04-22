"use server";

import { db } from "@/db";
import { taxPayments, taxPaymentAttachments, invoices, projects } from "@/db/schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import type { TaxPayment, TaxPaymentAttachment, TaxQuarter, DayEntry } from "@/lib/types";
import { getDayEntriesForMonth } from "./day-entries";
import { getDefaultProjectId } from "./settings";
import { getEffectiveRate } from "./projects";
import { calculateMonthSummary, withImplicitWorkingDays } from "@/lib/calculations";
import { syncTaxPaymentToExpense, removeTaxPaymentExpenseLink } from "./tax-expense-sync";
import { getFrenchHolidays } from "@/lib/constants";
import { assertAdminAccess, assertAuthenticatedAccess } from "@/lib/auth";
import { unlink } from "fs/promises";
import path from "path";

export type TaxProjectionMode = "auto" | "invoice" | "calendar";

type ProjectionCalendarBreakdown = {
  weekdayWorkingDays: number;
  publicHolidayWorkingDays: number;
  weekendWorkingDays: number;
};

export async function getTaxPayments(financialYear?: string): Promise<TaxPayment[]> {
  await assertAdminAccess();
  if (financialYear) {
    return db
      .select()
      .from(taxPayments)
      .where(eq(taxPayments.financialYear, financialYear))
      .orderBy(desc(taxPayments.paymentDate))
      .all() as TaxPayment[];
  }
  return db
    .select()
    .from(taxPayments)
    .orderBy(desc(taxPayments.paymentDate))
    .all() as TaxPayment[];
}

export async function getTaxPayment(id: number): Promise<TaxPayment | null> {
  await assertAdminAccess();
  const result = db
    .select()
    .from(taxPayments)
    .where(eq(taxPayments.id, id))
    .get() as TaxPayment | undefined;
  return result ?? null;
}

export async function createTaxPayment(data: {
  financialYear: string;
  quarter: TaxQuarter;
  amount: number;
  paymentDate: string;
  challanNo?: string;
  notes?: string;
}): Promise<{ success: boolean; id?: number }> {
  await assertAdminAccess();
  const result = db
    .insert(taxPayments)
    .values({
      financialYear: data.financialYear,
      quarter: data.quarter,
      amount: data.amount,
      paymentDate: data.paymentDate,
      challanNo: data.challanNo || null,
      notes: data.notes || null,
    })
    .run();
  const id = Number(result.lastInsertRowid);
  await syncTaxPaymentToExpense(id);
  return { success: true, id };
}

export async function updateTaxPayment(
  id: number,
  data: {
    financialYear: string;
    quarter: TaxQuarter;
    amount: number;
    paymentDate: string;
    challanNo?: string;
    notes?: string;
  }
): Promise<{ success: boolean }> {
  await assertAdminAccess();
  db.update(taxPayments)
    .set({
      financialYear: data.financialYear,
      quarter: data.quarter,
      amount: data.amount,
      paymentDate: data.paymentDate,
      challanNo: data.challanNo || null,
      notes: data.notes || null,
    })
    .where(eq(taxPayments.id, id))
    .run();
  await syncTaxPaymentToExpense(id);
  return { success: true };
}

export async function deleteTaxPayment(id: number): Promise<{ success: boolean }> {
  await assertAdminAccess();

  // Cascade-delete attachments from disk and DB
  const attachments = db
    .select()
    .from(taxPaymentAttachments)
    .where(eq(taxPaymentAttachments.taxPaymentId, id))
    .all();

  for (const att of attachments) {
    const filePath = path.join(process.cwd(), "data", "attachments", att.fileName);
    try { await unlink(filePath); } catch { /* file may be gone */ }
  }
  db.delete(taxPaymentAttachments).where(eq(taxPaymentAttachments.taxPaymentId, id)).run();

  await removeTaxPaymentExpenseLink(id);
  db.delete(taxPayments).where(eq(taxPayments.id, id)).run();
  return { success: true };
}

// New Tax Regime slabs for FY 2025-26
const NEW_REGIME_SLABS = [
  { upTo: 400000, rate: 0 },
  { upTo: 800000, rate: 0.05 },
  { upTo: 1200000, rate: 0.10 },
  { upTo: 1600000, rate: 0.15 },
  { upTo: 2000000, rate: 0.20 },
  { upTo: 2400000, rate: 0.25 },
  { upTo: Infinity, rate: 0.30 },
];

function calculateIncomeTax(taxableIncome: number): { slabBreakdown: { slab: string; taxable: number; rate: number; tax: number }[]; totalTax: number } {
  const slabBreakdown: { slab: string; taxable: number; rate: number; tax: number }[] = [];
  let remaining = taxableIncome;
  let prev = 0;
  let totalTax = 0;

  for (const { upTo, rate } of NEW_REGIME_SLABS) {
    if (remaining <= 0) break;
    const slabWidth = upTo === Infinity ? remaining : upTo - prev;
    const taxable = Math.min(remaining, slabWidth);
    const tax = taxable * rate;
    const slabLabel = upTo === Infinity ? `Above ₹${(prev / 100000).toFixed(0)}L` : `₹${(prev / 100000).toFixed(0)}L – ₹${(upTo / 100000).toFixed(0)}L`;
    slabBreakdown.push({ slab: slabLabel, taxable, rate, tax });
    totalTax += tax;
    remaining -= taxable;
    prev = upTo;
  }

  return { slabBreakdown, totalTax };
}

export async function getTaxComputation(financialYear: string): Promise<{
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
}> {
  await assertAdminAccess();
  // FY "2025-26" → April 2025 to March 2026
  const [startYear] = financialYear.split("-").map(Number);
  const fyStart = `${startYear}-04-01`;
  const fyEnd = `${startYear + 1}-03-31`;

  // Get all paid invoices whose paidDate falls within the FY
  const paidInvoices = db
    .select({ netInrAmount: invoices.netInrAmount })
    .from(invoices)
    .where(
      and(
        eq(invoices.status, "paid"),
        sql`${invoices.paidDate} >= ${fyStart}`,
        sql`${invoices.paidDate} <= ${fyEnd}`,
      )
    )
    .all();

  const grossReceipts = paidInvoices.reduce((sum, inv) => sum + (inv.netInrAmount ?? 0), 0);

  // Section 44ADA: presumptive income = 50% of gross receipts
  // No standard deduction for self-employed under 44ADA
  const presumptiveIncome = grossReceipts * 0.5;
  const taxableIncome = Math.max(0, presumptiveIncome);

  // Calculate tax
  const { slabBreakdown, totalTax: incomeTax } = calculateIncomeTax(taxableIncome);

  // Rebate u/s 87A: up to ₹60,000 if taxable income ≤ ₹12L (new regime FY 2025-26)
  const rebate87A = taxableIncome <= 1200000 ? Math.min(incomeTax, 60000) : 0;
  const taxAfterRebate = incomeTax - rebate87A;

  // 4% Health & Education Cess
  const cess = taxAfterRebate * 0.04;
  const totalTaxLiability = taxAfterRebate + cess;

  // Total advance tax paid
  const summary = await getTaxSummaryForFY(financialYear);
  const totalPaid = summary.total;
  const balance = totalTaxLiability - totalPaid;

  return {
    grossReceipts,
    presumptiveIncome,
    taxableIncome,
    slabBreakdown,
    incomeTax,
    rebate87A,
    cess,
    totalTaxLiability,
    totalPaid,
    balance,
  };
}

export async function getTaxProjection(financialYear: string, mode: TaxProjectionMode = "auto"): Promise<{
  monthlyBreakdown: {
    month: string;
    actual: number;
    projected: boolean;
    workingDays?: number;
    invoiceBased?: boolean;
    calendarBreakdown?: ProjectionCalendarBreakdown;
  }[];
  monthsElapsed: number;
  monthsRemaining: number;
  avgRate: number;
  mode: TaxProjectionMode;
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
}> {
  await assertAdminAccess();
  const [startYear] = financialYear.split("-").map(Number);
  const fyStart = `${startYear}-04-01`;
  const fyEnd = `${startYear + 1}-03-31`;

  // Get all paid invoices in the FY
  const paidInvoices = db
    .select({
      netInrAmount: invoices.netInrAmount,
      paidDate: invoices.paidDate,
      billingPeriodStart: invoices.billingPeriodStart,
      total: invoices.total,
      eurToInrRate: invoices.eurToInrRate,
      platformCharges: invoices.platformCharges,
      bankCharges: invoices.bankCharges,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.status, "paid"),
        sql`${invoices.paidDate} >= ${fyStart}`,
        sql`${invoices.paidDate} <= ${fyEnd}`,
      )
    )
    .all();

  // Group actual income by paid date month (Apr=0 .. Mar=11)
  // Earnings in month M = payment received in M for work done in M-1
  const monthlyActual: number[] = Array(12).fill(0);
  const MONTH_LABELS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];

  for (const inv of paidInvoices) {
    if (!inv.paidDate) continue;
    const dateStr = inv.paidDate;
    const [y, m] = dateStr.split("-").map(Number);
    let idx: number;
    if (y === startYear) {
      idx = m - 4;
    } else {
      idx = m + 8;
    }
    if (idx >= 0 && idx < 12) {
      monthlyActual[idx] += inv.netInrAmount ?? 0;
    }
  }

  // Determine elapsed months
  const now = new Date();
  let currentIdx: number;
  if (now.getFullYear() === startYear) {
    currentIdx = now.getMonth() - 3;
  } else {
    currentIdx = now.getMonth() + 9;
  }
  // Don't count the current month as elapsed — it's still in progress
  // and we likely haven't received payment yet, so project it instead.
  const invoiceMonthsElapsed = Math.min(12, Math.max(0, currentIdx));
  const monthsElapsed = mode === "calendar" ? 0 : invoiceMonthsElapsed;
  const monthsRemaining = 12 - monthsElapsed;

  const defaultProjectId = await getDefaultProjectId();
  let projectCurrency = "EUR";
  if (defaultProjectId) {
    const project = db
      .select({ currency: projects.currency })
      .from(projects)
      .where(eq(projects.id, defaultProjectId))
      .get();
    if (project?.currency) {
      projectCurrency = project.currency;
    }
  }

  // Use the most recent paid invoice's FX rate, otherwise fall back to
  // a live currency rate for the default project, then to a static EUR-INR fallback.
  const sortedByDate = [...paidInvoices]
    .filter((i) => i.paidDate && i.eurToInrRate)
    .sort((a, b) => b.paidDate!.localeCompare(a.paidDate!));
  let currentRate = 0;
  let rateSourceLabel = "No FX data";
  if (projectCurrency === "INR") {
    currentRate = 1;
    rateSourceLabel = "Using INR project rate";
  } else if (sortedByDate.length > 0) {
    currentRate = sortedByDate[0].eurToInrRate!;
    rateSourceLabel = "Using latest paid invoice FX rate";
  } else {
    const liveRate = await getLiveRateForCurrency(projectCurrency);
    if (liveRate) {
      currentRate = liveRate;
      rateSourceLabel = `Using live ${projectCurrency}-INR rate`;
    } else {
      currentRate = 90;
      rateSourceLabel = "Using fallback EUR-INR rate";
    }
  }

  // Compute average deduction % from paid invoices
  const totalEur = paidInvoices.reduce((s, i) => s + (i.total ?? 0), 0);
  const avgRate = totalEur > 0
    ? paidInvoices.reduce((s, i) => s + (i.eurToInrRate ?? 0) * (i.total ?? 0), 0) / totalEur
    : currentRate;
  const totalGrossInr = totalEur * avgRate;
  const totalDeductions = paidInvoices.reduce((s, i) => s + (i.platformCharges ?? 0) + (i.bankCharges ?? 0), 0);
  const deductionPct = totalGrossInr > 0 ? totalDeductions / totalGrossInr : 0;

  // Query sent/draft invoices with due dates in the FY for projection
  const shouldUseInvoices = mode !== "calendar";
  const openInvoices = shouldUseInvoices
    ? db
      .select({
        total: invoices.total,
        dueDate: invoices.dueDate,
        status: invoices.status,
      })
      .from(invoices)
      .where(
        and(
          sql`${invoices.status} IN ('sent', 'draft')`,
          sql`${invoices.dueDate} >= ${fyStart}`,
          sql`${invoices.dueDate} <= ${fyEnd}`,
        )
      )
      .all()
    : [];

  // Group open invoice totals by FY month index (based on due date)
  const invoiceByMonth: number[] = Array(12).fill(0);
  const hasInvoiceForMonth: boolean[] = Array(12).fill(false);
  for (const inv of openInvoices) {
    if (!inv.dueDate) continue;
    const [y, m] = inv.dueDate.split("-").map(Number);
    let idx: number;
    if (y === startYear) {
      idx = m - 4;
    } else {
      idx = m + 8;
    }
    if (idx >= 0 && idx < 12) {
      // Estimate net INR from the invoice EUR total
      invoiceByMonth[idx] += Math.round((inv.total ?? 0) * currentRate * (1 - deductionPct));
      hasInvoiceForMonth[idx] = true;
    }
  }

  // Project remaining months: prefer sent invoices, fall back to working-days estimate
  const projectedMonthly: number[] = Array(12).fill(0);
  const projectedWorkingDays: (number | undefined)[] = Array(12).fill(undefined);
  const projectedCalendarBreakdown: (ProjectionCalendarBreakdown | undefined)[] = Array(12).fill(undefined);

  for (let i = monthsElapsed; i < 12; i++) {
    if (hasInvoiceForMonth[i]) {
      // Use actual invoice amount instead of estimating
      projectedMonthly[i] = invoiceByMonth[i];
    } else {
      // Fall back to working-days-based estimate
      const prevIdx = i - 1;
      const prevCalYear = prevIdx < 9 ? startYear : startYear + 1;
      const prevCalMonth = prevIdx < 9 ? prevIdx + 4 : prevIdx - 8;

      const entries = await getDayEntriesForMonth(prevCalYear, prevCalMonth);
      const holidays = getFrenchHolidays(prevCalYear);
      const augmented = withImplicitWorkingDays(entries as DayEntry[], prevCalYear, prevCalMonth, holidays);
      const summary = calculateMonthSummary(augmented);
      const calendarBreakdown = calculateProjectionCalendarBreakdown(augmented, holidays);

      const monthKey = `${prevCalYear}-${String(prevCalMonth).padStart(2, "0")}`;
      const dailyRate = defaultProjectId ? await getEffectiveRate(defaultProjectId, monthKey) : 0;

      const baseAmount = summary.effectiveWorkingDays * dailyRate;
      const grossInr = projectCurrency === "INR" ? baseAmount : baseAmount * currentRate;
      const netInr = grossInr * (1 - deductionPct);

      projectedMonthly[i] = Math.round(netInr);
      projectedWorkingDays[i] = summary.effectiveWorkingDays;
      projectedCalendarBreakdown[i] = calendarBreakdown;
    }
  }

  const actualTotal = monthlyActual.reduce((a, b) => a + b, 0);
  const projectedTotal = projectedMonthly.reduce((a, b) => a + b, 0);

  // Build monthly breakdown
  const monthlyBreakdown = MONTH_LABELS.map((label, i) => ({
    month: label,
    actual: mode === "calendar"
      ? projectedMonthly[i]
      : i < monthsElapsed
        ? monthlyActual[i]
        : projectedMonthly[i],
    projected: mode === "calendar" ? true : i >= monthsElapsed,
    workingDays: projectedWorkingDays[i],
    invoiceBased: i >= monthsElapsed && hasInvoiceForMonth[i],
    calendarBreakdown: projectedCalendarBreakdown[i],
  }));

  const projectedGrossReceipts = mode === "calendar"
    ? projectedTotal
    : actualTotal + projectedTotal;
  const projectedPresumptiveIncome = projectedGrossReceipts * 0.5;
  const projectedTaxableIncome = Math.max(0, projectedPresumptiveIncome);

  const { slabBreakdown, totalTax } = calculateIncomeTax(projectedTaxableIncome);

  const projectedRebate87A = projectedTaxableIncome <= 1200000 ? Math.min(totalTax, 60000) : 0;
  const taxAfterRebate = totalTax - projectedRebate87A;
  const projectedCess = taxAfterRebate * 0.04;
  const projectedTotalTax = taxAfterRebate + projectedCess;

  const taxSummary = await getTaxSummaryForFY(financialYear);
  const totalPaid = taxSummary.total;
  const projectedBalance = projectedTotalTax - totalPaid;

  return {
    monthlyBreakdown,
    monthsElapsed,
    monthsRemaining,
    avgRate: Math.round(currentRate * 100) / 100,
    mode,
    modeSummary: getProjectionModeSummary(mode),
    rateSourceLabel,
    projectedGrossReceipts: Math.round(projectedGrossReceipts),
    projectedPresumptiveIncome: Math.round(projectedPresumptiveIncome),
    projectedTaxableIncome: Math.round(projectedTaxableIncome),
    slabBreakdown,
    projectedIncomeTax: totalTax,
    projectedRebate87A,
    projectedCess,
    projectedTotalTax,
    totalPaid,
    projectedBalance,
  };
}

function calculateProjectionCalendarBreakdown(
  entries: DayEntry[],
  holidays: Map<string, string>,
): ProjectionCalendarBreakdown {
  const breakdown: ProjectionCalendarBreakdown = {
    weekdayWorkingDays: 0,
    publicHolidayWorkingDays: 0,
    weekendWorkingDays: 0,
  };

  for (const entry of entries) {
    let weight = 0;
    if (entry.dayType === "working" || entry.dayType === "extra_working") {
      weight = 1;
    } else if (entry.dayType === "half_day") {
      weight = 0.5;
    }

    if (weight === 0) continue;

    if (holidays.has(entry.date)) {
      breakdown.publicHolidayWorkingDays += weight;
      continue;
    }

    const dayOfWeek = new Date(`${entry.date}T00:00:00`).getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      breakdown.weekendWorkingDays += weight;
    } else {
      breakdown.weekdayWorkingDays += weight;
    }
  }

  return breakdown;
}

function getProjectionModeSummary(mode: TaxProjectionMode): string {
  switch (mode) {
    case "invoice":
      return "Prefer sent or draft invoices where available, then fall back to calendar working days.";
    case "calendar":
      return "Ignore invoices and project the whole remaining period from calendar working days.";
    default:
      return "Auto mode uses invoices when available and falls back to calendar working days otherwise.";
  }
}

async function getLiveRateForCurrency(currency: string): Promise<number | null> {
  try {
    const response = await fetch(`https://open.er-api.com/v6/latest/${currency}`, { next: { revalidate: 3600 } });
    if (!response.ok) return null;
    const data = await response.json();
    return data?.rates?.INR ?? null;
  } catch {
    return null;
  }
}

export async function getTaxSummaryForFY(financialYear: string): Promise<{
  byQuarter: Record<TaxQuarter, number>;
  total: number;
}> {
  await assertAdminAccess();
  const payments = await getTaxPayments(financialYear);
  const byQuarter: Record<TaxQuarter, number> = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
  let total = 0;
  for (const p of payments) {
    byQuarter[p.quarter] += p.amount;
    total += p.amount;
  }
  return { byQuarter, total };
}

// --- Tax Payment Attachments ---

export async function getTaxPaymentAttachments(taxPaymentId: number): Promise<TaxPaymentAttachment[]> {
  await assertAuthenticatedAccess();
  return db
    .select()
    .from(taxPaymentAttachments)
    .where(eq(taxPaymentAttachments.taxPaymentId, taxPaymentId))
    .orderBy(desc(taxPaymentAttachments.createdAt))
    .all() as TaxPaymentAttachment[];
}

export async function addTaxPaymentAttachment(data: {
  taxPaymentId: number;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  label?: string;
}): Promise<{ success: boolean; id?: number }> {
  await assertAdminAccess();
  const result = db
    .insert(taxPaymentAttachments)
    .values({
      taxPaymentId: data.taxPaymentId,
      fileName: data.fileName,
      originalName: data.originalName,
      mimeType: data.mimeType,
      fileSize: data.fileSize,
      label: data.label || null,
    })
    .run();
  return { success: true, id: Number(result.lastInsertRowid) };
}

export async function deleteTaxPaymentAttachment(id: number): Promise<{ success: boolean; fileName?: string }> {
  await assertAdminAccess();
  const attachment = db
    .select()
    .from(taxPaymentAttachments)
    .where(eq(taxPaymentAttachments.id, id))
    .get() as TaxPaymentAttachment | undefined;

  if (!attachment) return { success: false };

  db.delete(taxPaymentAttachments).where(eq(taxPaymentAttachments.id, id)).run();
  return { success: true, fileName: attachment.fileName };
}
