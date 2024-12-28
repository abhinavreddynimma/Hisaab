"use server";

import { db } from "@/db";
import { expenseTransactions, expenseAccounts, taxPayments } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import type { ExpenseAccountType } from "@/lib/types";

/**
 * Tax Payment ↔ Expense Manager sync module.
 * Mirrors the invoice sync pattern: source = "tax_payment", sourceId = taxPaymentId.
 */

async function getOrCreateTaxCategory(): Promise<number> {
  // Find the "Advance Tax" sub-category under "Tax"
  const taxParent = db
    .select()
    .from(expenseAccounts)
    .where(and(eq(expenseAccounts.type, "expense"), eq(expenseAccounts.name, "Tax")))
    .get();

  if (taxParent) {
    const advanceTax = db
      .select()
      .from(expenseAccounts)
      .where(and(eq(expenseAccounts.parentId, taxParent.id), eq(expenseAccounts.name, "Advance Tax")))
      .get();
    if (advanceTax) return advanceTax.id;
  }

  // Fallback: find or create "Tax" category
  if (taxParent) return taxParent.id;

  const result = db
    .insert(expenseAccounts)
    .values({ name: "Tax", type: "expense" as ExpenseAccountType, sortOrder: 99 })
    .run();
  return Number(result.lastInsertRowid);
}

function findLinkedTransaction(taxPaymentId: number) {
  return db
    .select()
    .from(expenseTransactions)
    .where(
      and(
        eq(expenseTransactions.source, "tax_payment"),
        eq(expenseTransactions.sourceId, String(taxPaymentId)),
      ),
    )
    .get();
}

export async function syncTaxPaymentToExpense(taxPaymentId: number): Promise<void> {
  const payment = db
    .select()
    .from(taxPayments)
    .where(eq(taxPayments.id, taxPaymentId))
    .get();

  if (!payment) return;

  const existing = findLinkedTransaction(taxPaymentId);
  const categoryId = await getOrCreateTaxCategory();

  const note = `Tax ${payment.quarter} FY ${payment.financialYear}${payment.challanNo ? ` — Challan ${payment.challanNo}` : ""}`;

  if (existing) {
    db.update(expenseTransactions)
      .set({
        date: payment.paymentDate,
        amount: payment.amount,
        note,
        categoryId,
        status: "confirmed",
      })
      .where(eq(expenseTransactions.id, existing.id))
      .run();
  } else {
    db.insert(expenseTransactions)
      .values({
        type: "expense",
        date: payment.paymentDate,
        amount: payment.amount,
        categoryId,
        note,
        source: "tax_payment",
        sourceId: String(taxPaymentId),
        status: "confirmed",
      })
      .run();
  }
}

export async function syncAllTaxPaymentsToExpenses(): Promise<{ synced: number }> {
  const allPayments = db.select({ id: taxPayments.id }).from(taxPayments).all();

  const linkedIds = new Set(
    db
      .select({ sourceId: expenseTransactions.sourceId })
      .from(expenseTransactions)
      .where(eq(expenseTransactions.source, "tax_payment"))
      .all()
      .map((r) => r.sourceId),
  );

  let synced = 0;
  for (const payment of allPayments) {
    if (!linkedIds.has(String(payment.id))) {
      await syncTaxPaymentToExpense(payment.id);
      synced++;
    }
  }

  return { synced };
}

export async function removeTaxPaymentExpenseLink(taxPaymentId: number): Promise<void> {
  const existing = findLinkedTransaction(taxPaymentId);
  if (existing) {
    db.delete(expenseTransactions)
      .where(eq(expenseTransactions.id, existing.id))
      .run();
  }
}
