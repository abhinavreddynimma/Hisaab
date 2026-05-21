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

/** Find SBI bank account so tax debits hit the spendable pool by default. */
function getSBIAccountId(): number | null {
  const sbi = db
    .select()
    .from(expenseAccounts)
    .where(and(eq(expenseAccounts.type, "bank"), eq(expenseAccounts.name, "SBI")))
    .get();
  return sbi?.id ?? null;
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
  const sbiAccountId = getSBIAccountId();

  const note = `Tax ${payment.quarter} FY ${payment.financialYear}${payment.challanNo ? ` — Challan ${payment.challanNo}` : ""}`;

  if (existing) {
    db.update(expenseTransactions)
      .set({
        date: payment.paymentDate,
        amount: payment.amount,
        note,
        categoryId,
        accountId: existing.accountId ?? sbiAccountId,
        fromAccountId: existing.fromAccountId ?? sbiAccountId,
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
        accountId: sbiAccountId,
        fromAccountId: sbiAccountId,
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

  // Track linked rows with their accountId so we can resync any that are
  // missing an account — those won't debit any bank balance otherwise.
  const linkedRows = db
    .select({ sourceId: expenseTransactions.sourceId, accountId: expenseTransactions.accountId })
    .from(expenseTransactions)
    .where(eq(expenseTransactions.source, "tax_payment"))
    .all();
  const linkedMap = new Map(linkedRows.map((r) => [r.sourceId, r.accountId]));

  let synced = 0;
  for (const payment of allPayments) {
    const existing = linkedMap.get(String(payment.id));
    if (existing === undefined || existing == null) {
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
