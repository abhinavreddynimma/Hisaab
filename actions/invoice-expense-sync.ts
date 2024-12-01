"use server";

import { db } from "@/db";
import { expenseTransactions, expenseAccounts, invoices, clients } from "@/db/schema";
import { eq, and } from "drizzle-orm";
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
      const date = invoice.dueDate || invoice.issueDate;
      if (existing) {
        db.update(expenseTransactions)
          .set({
            date,
            amount: invoice.total, // estimated = full invoice total
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
            amount: invoice.total,
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
  const allInvoices = db.select({ id: invoices.id }).from(invoices).all();

  for (const inv of allInvoices) {
    await syncInvoiceToExpense(inv.id);
  }

  return { synced: allInvoices.length };
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
