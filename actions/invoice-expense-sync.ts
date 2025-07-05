"use server";

import { db } from "@/db";
import { expenseTransactions, expenseAccounts, invoices, clients } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import type { ExpenseAccountType } from "@/lib/types";

/**
 * Invoice ↔ Expense Manager sync module.
 *
 * Design: every synced transaction carries `source = "invoice"` and
 * `sourceId = "<invoiceId>"`. This same pattern will be reused for
 * future sources (bank_statement, UPI imports, etc.) — just change
 * the source string and provide a meaningful sourceId.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Estimate net INR for an unpaid EUR invoice using the latest paid invoice's rate and avg deductions. */
function estimateNetInr(eurAmount: number): number {
  const paidInvs = db
    .select({
      total: invoices.total,
      eurToInrRate: invoices.eurToInrRate,
      platformCharges: invoices.platformCharges,
      bankCharges: invoices.bankCharges,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.status, "paid"),
        sql`${invoices.eurToInrRate} IS NOT NULL`,
      ),
    )
    .all();

  if (paidInvs.length === 0) return eurAmount; // no history, can't convert

  // Latest rate: use most recent paid invoice's rate
  // (paidInvs aren't sorted, so find the one with highest paidDate)
  const withRate = paidInvs.filter((i) => i.eurToInrRate);
  const totalEur = withRate.reduce((s, i) => s + (i.total ?? 0), 0);
  const avgRate =
    totalEur > 0
      ? withRate.reduce((s, i) => s + (i.eurToInrRate ?? 0) * (i.total ?? 0), 0) / totalEur
      : 0;
  const totalGrossInr = totalEur * avgRate;
  const totalDeductions = withRate.reduce(
    (s, i) => s + (i.platformCharges ?? 0) + (i.bankCharges ?? 0),
    0,
  );
  const deductionPct = totalGrossInr > 0 ? totalDeductions / totalGrossInr : 0;

  // Use latest paid invoice's rate for the spot conversion
  const sortedByRate = [...withRate].sort(
    (a, b) => (b.eurToInrRate ?? 0) - (a.eurToInrRate ?? 0),
  );
  // Actually we want the most recent — but we don't have paidDate here.
  // Use the same weighted avg rate as tax projection for consistency.
  const currentRate = avgRate;

  return Math.round(eurAmount * currentRate * (1 - deductionPct));
}

/** Find or create the "Freelance Income" account used for invoice-linked income. */
async function getOrCreateFreelanceIncomeAccount(): Promise<number> {
  const existing = db
    .select()
    .from(expenseAccounts)
    .where(
      and(
        eq(expenseAccounts.type, "income"),
        eq(expenseAccounts.name, "Freelance Income"),
      ),
    )
    .get();

  if (existing) return existing.id;

  const result = db
    .insert(expenseAccounts)
    .values({
      name: "Freelance Income",
      type: "income" as ExpenseAccountType,
      sortOrder: 0,
    })
    .run();

  return Number(result.lastInsertRowid);
}

/** Find the existing expense transaction linked to an invoice. */
function findLinkedTransaction(invoiceId: number) {
  return db
    .select()
    .from(expenseTransactions)
    .where(
      and(
        eq(expenseTransactions.source, "invoice"),
        eq(expenseTransactions.sourceId, String(invoiceId)),
      ),
    )
    .get();
}

// ---------------------------------------------------------------------------
// Core sync — called after any invoice status change
// ---------------------------------------------------------------------------

export async function syncInvoiceToExpense(invoiceId: number): Promise<void> {
  const invoice = db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      status: invoices.status,
      total: invoices.total,
      currency: invoices.currency,
      netInrAmount: invoices.netInrAmount,
      paidDate: invoices.paidDate,
      dueDate: invoices.dueDate,
      issueDate: invoices.issueDate,
      platformCharges: invoices.platformCharges,
      bankCharges: invoices.bankCharges,
      clientName: clients.name,
    })
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .where(eq(invoices.id, invoiceId))
    .get();

  if (!invoice) return;

  const existing = findLinkedTransaction(invoiceId);
  const categoryId = await getOrCreateFreelanceIncomeAccount();

  // Determine the amount to record:
  // - If paid and we have INR conversion → use netInrAmount
  // - Otherwise use the invoice total
  const amount =
    invoice.status === "paid" && invoice.netInrAmount
      ? invoice.netInrAmount
      : invoice.total;

  // Fees = platform + bank charges (only meaningful when paid)
  const fees =
    invoice.status === "paid"
      ? (invoice.platformCharges ?? 0) + (invoice.bankCharges ?? 0)
      : 0;

  const note = `Invoice ${invoice.invoiceNumber} — ${invoice.clientName}`;

  switch (invoice.status) {
    case "sent": {
      // Create or update an *estimated* income transaction on the due date
      // Convert EUR to estimated net INR using avg rate and deductions from paid invoices
      const date = invoice.dueDate || invoice.issueDate;
      const estimatedInr = estimateNetInr(invoice.total);
      if (existing) {
        db.update(expenseTransactions)
          .set({
            date,
            amount: estimatedInr,
            fees: 0,
            note,
            status: "estimated",
          })
          .where(eq(expenseTransactions.id, existing.id))
          .run();
      } else {
        db.insert(expenseTransactions)
          .values({
            type: "income",
            date,
            amount: estimatedInr,
            categoryId,
            fees: 0,
            note,
            source: "invoice",
            sourceId: String(invoiceId),
            status: "estimated",
          })
          .run();
      }
      break;
    }

    case "paid": {
      // Create or update a *confirmed* income transaction on the paid date
      const date = invoice.paidDate || invoice.issueDate;
      if (existing) {
        db.update(expenseTransactions)
          .set({
            date,
            amount,
            fees,
            note,
            status: "confirmed",
          })
          .where(eq(expenseTransactions.id, existing.id))
          .run();
      } else {
        db.insert(expenseTransactions)
          .values({
            type: "income",
            date,
            amount,
            categoryId,
            fees,
            note,
            source: "invoice",
            sourceId: String(invoiceId),
            status: "confirmed",
          })
          .run();
      }
      break;
    }

    case "draft":
    case "cancelled": {
      // Remove the linked transaction — invoice is no longer active
      if (existing) {
        db.delete(expenseTransactions)
          .where(eq(expenseTransactions.id, existing.id))
          .run();
      }
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Bulk sync — reconcile ALL invoices (useful for initial setup / repair)
// ---------------------------------------------------------------------------

export async function syncAllInvoicesToExpenses(): Promise<{ synced: number }> {
  // Sync invoices that are sent/paid:
  // - Missing linked transactions get created
  // - Estimated transactions get re-synced (amounts may change as rates update)
  const activeInvoices = db
    .select({ id: invoices.id, status: invoices.status })
    .from(invoices)
    .where(
      sql`${invoices.status} IN ('sent', 'paid')`,
    )
    .all();

  const linkedTxns = db
    .select({ sourceId: expenseTransactions.sourceId, status: expenseTransactions.status })
    .from(expenseTransactions)
    .where(eq(expenseTransactions.source, "invoice"))
    .all();

  const linkedMap = new Map(linkedTxns.map((r) => [r.sourceId, r.status]));

  let synced = 0;
  for (const inv of activeInvoices) {
    const existing = linkedMap.get(String(inv.id));
    // Sync if: no linked transaction, or it's estimated (re-estimate with latest rates)
    if (!existing || existing === "estimated") {
      await syncInvoiceToExpense(inv.id);
      synced++;
    }
  }

  return { synced };
}

// ---------------------------------------------------------------------------
// Called when an invoice is deleted (soft-delete = cancelled)
// ---------------------------------------------------------------------------

export async function removeInvoiceExpenseLink(invoiceId: number): Promise<void> {
  const existing = findLinkedTransaction(invoiceId);
  if (existing) {
    db.delete(expenseTransactions)
      .where(eq(expenseTransactions.id, existing.id))
      .run();
  }
}
