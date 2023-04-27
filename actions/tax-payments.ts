"use server";

import { db } from "@/db";
import { taxPayments, invoices } from "@/db/schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import type { TaxPayment, TaxQuarter, DayEntry } from "@/lib/types";
import { getDayEntriesForMonth } from "./day-entries";
import { getDefaultProjectId } from "./settings";
import { getEffectiveRate } from "./projects";
import { calculateMonthSummary, withImplicitWorkingDays } from "@/lib/calculations";
import { getFrenchHolidays } from "@/lib/constants";

export async function getTaxPayments(financialYear?: string): Promise<TaxPayment[]> {
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
  return { success: true, id: Number(result.lastInsertRowid) };
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
  return { success: true };
}

export async function deleteTaxPayment(id: number): Promise<{ success: boolean }> {
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

export async function getTaxProjection(financialYear: string): Promise<{
  monthlyBreakdown: { month: string; actual: number; projected: boolean; workingDays?: number }[];
  monthsElapsed: number;
  monthsRemaining: number;
  avgRate: number;
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
  const [startYear] = financialYear.split("-").map(Number);
  const fyStart = `${startYear}-04-01`;
  const fyEnd = `${startYear + 1}-03-31`;

  // Get all paid invoices in the FY
  const paidInvoices = db
    .select({
      netInrAmount: invoices.netInrAmount,
      paidDate: invoices.paidDate,
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

  // Group actual income by month (Apr=0 .. Mar=11)
  const monthlyActual: number[] = Array(12).fill(0);
  const MONTH_LABELS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];

  for (const inv of paidInvoices) {
    if (!inv.paidDate) continue;
    const [y, m] = inv.paidDate.split("-").map(Number);
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
  const monthsElapsed = Math.min(12, Math.max(1, currentIdx + 1));
  const monthsRemaining = 12 - monthsElapsed;

  // Compute average EUR-INR rate and deduction % from paid invoices
  const totalEur = paidInvoices.reduce((s, i) => s + (i.total ?? 0), 0);
  const avgRate = totalEur > 0
    ? paidInvoices.reduce((s, i) => s + (i.eurToInrRate ?? 0) * (i.total ?? 0), 0) / totalEur
    : 0;
  const totalGrossInr = totalEur * avgRate;
  const totalDeductions = paidInvoices.reduce((s, i) => s + (i.platformCharges ?? 0) + (i.bankCharges ?? 0), 0);
  const deductionPct = totalGrossInr > 0 ? totalDeductions / totalGrossInr : 0;

  // Project remaining months using calendar working days
  const defaultProjectId = await getDefaultProjectId();
  const projectedMonthly: number[] = Array(12).fill(0);
  const projectedWorkingDays: (number | undefined)[] = Array(12).fill(undefined);

  for (let i = monthsElapsed; i < 12; i++) {
    // FY month index to calendar year/month: Apr(i=0)=startYear/4, Mar(i=11)=startYear+1/3
    const calYear = i < 9 ? startYear : startYear + 1;
    const calMonth = i < 9 ? i + 4 : i - 8;

    const entries = await getDayEntriesForMonth(calYear, calMonth);
    const holidays = getFrenchHolidays(calYear);
    const augmented = withImplicitWorkingDays(entries as DayEntry[], calYear, calMonth, holidays);
    const summary = calculateMonthSummary(augmented);

    const monthKey = `${calYear}-${String(calMonth).padStart(2, "0")}`;
    const dailyRate = defaultProjectId ? await getEffectiveRate(defaultProjectId, monthKey) : 0;

    const eurAmount = summary.effectiveWorkingDays * dailyRate;
    const grossInr = eurAmount * avgRate;
    const netInr = grossInr * (1 - deductionPct);

    projectedMonthly[i] = Math.round(netInr);
    projectedWorkingDays[i] = summary.effectiveWorkingDays;
  }

  const actualTotal = monthlyActual.reduce((a, b) => a + b, 0);
  const projectedTotal = projectedMonthly.reduce((a, b) => a + b, 0);

  // Build monthly breakdown
  const monthlyBreakdown = MONTH_LABELS.map((label, i) => ({
    month: label,
    actual: i < monthsElapsed ? monthlyActual[i] : projectedMonthly[i],
    projected: i >= monthsElapsed,
    workingDays: projectedWorkingDays[i],
  }));

  const projectedGrossReceipts = actualTotal + projectedTotal;
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
    avgRate: Math.round(avgRate * 100) / 100,
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

export async function getTaxSummaryForFY(financialYear: string): Promise<{
  byQuarter: Record<TaxQuarter, number>;
  total: number;
}> {
  const payments = await getTaxPayments(financialYear);
  const byQuarter: Record<TaxQuarter, number> = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
  let total = 0;
  for (const p of payments) {
    byQuarter[p.quarter] += p.amount;
    total += p.amount;
  }
  return { byQuarter, total };
}
