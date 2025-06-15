"use server";

import { db } from "@/db";
import { invoices, invoiceLineItems, invoiceAttachments, clients, projects } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { getInvoiceSettings, getUserProfile } from "./settings";
import { getDayEntriesForRange } from "./day-entries";
import { getProjectRateTimeline } from "./projects";
import { getClient } from "./clients";
import type { Invoice, InvoiceLineItem, InvoiceAttachment, InvoiceStatus } from "@/lib/types";
import { withImplicitWorkingDays } from "@/lib/calculations";
import { getFrenchHolidays } from "@/lib/constants";
import { getProject } from "./projects";
import { getDefaultProjectId } from "./settings";
import { assertAdminAccess, assertAuthenticatedAccess } from "@/lib/auth";
import { syncInvoiceToExpense, removeInvoiceExpenseLink } from "./invoice-expense-sync";

const invoiceSelectFields = {
  id: invoices.id,
  invoiceNumber: invoices.invoiceNumber,
  clientId: invoices.clientId,
  projectId: invoices.projectId,
  billingPeriodStart: invoices.billingPeriodStart,
  billingPeriodEnd: invoices.billingPeriodEnd,
  issueDate: invoices.issueDate,
  dueDate: invoices.dueDate,
  fromName: invoices.fromName,
  fromCompany: invoices.fromCompany,
  fromAddress: invoices.fromAddress,
  fromGstin: invoices.fromGstin,
  fromPan: invoices.fromPan,
  fromEmail: invoices.fromEmail,
  fromPhone: invoices.fromPhone,
  fromBankName: invoices.fromBankName,
  fromBankAccount: invoices.fromBankAccount,
  fromBankIfsc: invoices.fromBankIfsc,
  fromBankBranch: invoices.fromBankBranch,
  fromBankIban: invoices.fromBankIban,
  fromBankBic: invoices.fromBankBic,
  fromSepaAccountName: invoices.fromSepaAccountName,
  fromSepaIban: invoices.fromSepaIban,
  fromSepaBic: invoices.fromSepaBic,
  fromSepaBank: invoices.fromSepaBank,
  fromSepaAccountType: invoices.fromSepaAccountType,
  fromSepaAddress: invoices.fromSepaAddress,
  fromSwiftAccountName: invoices.fromSwiftAccountName,
  fromSwiftIban: invoices.fromSwiftIban,
  fromSwiftBic: invoices.fromSwiftBic,
  fromSwiftBank: invoices.fromSwiftBank,
  fromSwiftAccountType: invoices.fromSwiftAccountType,
  toName: invoices.toName,
  toCompany: invoices.toCompany,
  toAddress: invoices.toAddress,
  toGstin: invoices.toGstin,
  toEmail: invoices.toEmail,
  subtotal: invoices.subtotal,
  cgstRate: invoices.cgstRate,
  cgstAmount: invoices.cgstAmount,
  sgstRate: invoices.sgstRate,
  sgstAmount: invoices.sgstAmount,
  igstRate: invoices.igstRate,
  igstAmount: invoices.igstAmount,
  total: invoices.total,
  currency: invoices.currency,
  status: invoices.status,
  notes: invoices.notes,
  paidDate: invoices.paidDate,
  eurToInrRate: invoices.eurToInrRate,
  platformCharges: invoices.platformCharges,
  bankCharges: invoices.bankCharges,
  netInrAmount: invoices.netInrAmount,
  createdAt: invoices.createdAt,
  clientName: clients.name,
};

export async function getInvoices(statusFilter?: InvoiceStatus): Promise<(Invoice & { clientName: string })[]> {
  await assertAuthenticatedAccess();
  let query;
  if (statusFilter) {
    query = db
      .select(invoiceSelectFields)
      .from(invoices)
      .innerJoin(clients, eq(invoices.clientId, clients.id))
      .where(eq(invoices.status, statusFilter))
      .orderBy(desc(invoices.createdAt))
      .all();
  } else {
    query = db
      .select(invoiceSelectFields)
      .from(invoices)
      .innerJoin(clients, eq(invoices.clientId, clients.id))
      .orderBy(desc(invoices.createdAt))
      .all();
  }

  return query as (Invoice & { clientName: string })[];
}

export async function getInvoice(id: number): Promise<(Invoice & { clientName: string }) | null> {
  await assertAuthenticatedAccess();
  const result = db
    .select(invoiceSelectFields)
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .where(eq(invoices.id, id))
    .get();

  return (result as (Invoice & { clientName: string })) ?? null;
}

export async function getInvoiceLineItems(invoiceId: number): Promise<InvoiceLineItem[]> {
  await assertAuthenticatedAccess();
  return db
    .select()
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, invoiceId))
    .all() as InvoiceLineItem[];
}

export async function generateInvoiceNumber(): Promise<string> {
  await assertAdminAccess();
  const settings = await getInvoiceSettings();
  const number = String(settings.nextNumber).padStart(4, "0");
  return `${settings.prefix}-${number}`;
}

export async function getAutoPopulatedLineItems(
  projectId: number,
  startDate: string,
  endDate: string
): Promise<{ description: string; hsnSac: string; quantity: number; unitPrice: number; amount: number }[]> {
  await assertAdminAccess();
  const [startYear, startMonth] = startDate.split("-").map(Number);
  const rawEntries = await getDayEntriesForRange(startDate, endDate);
  const holidays = getFrenchHolidays(startYear);
  const defaultProjectId = await getDefaultProjectId();

  // Augment with implicit working days (weekdays with no explicit entry)
  const allEntries = withImplicitWorkingDays(rawEntries, startYear, startMonth, holidays);

  // For implicit working days (id < 0), assign the default project
  const augmented = allEntries.map((e) =>
    e.id < 0 && !e.projectId && defaultProjectId
      ? { ...e, projectId: defaultProjectId }
      : e
  );

  const projectEntries = augmented.filter(
    (e) => e.projectId === projectId && (e.dayType === "working" || e.dayType === "extra_working" || e.dayType === "half_day")
  );

  if (projectEntries.length === 0) return [];

  const invoiceSettings = await getInvoiceSettings();
  const project = await getProject(projectId);
  const rateTimeline = await getProjectRateTimeline(projectId);
  const fallbackRate = project?.defaultDailyRate ?? 0;
  const baseDescription = `Software Development (${project?.name ?? "Project"})`;
  const BASE_RATE_KEY = "base";
  const quantityByRatePoint = new Map<string, { effectiveFrom: string; unitPrice: number; quantity: number }>();

  function quantityForEntry(dayType: "working" | "extra_working" | "half_day"): number {
    if (dayType === "half_day") return 0.5;
    return 1;
  }

  function getRatePointForDate(date: string): { effectiveFrom: string; unitPrice: number } {
    let selected: { effectiveFrom: string; unitPrice: number } = {
      effectiveFrom: BASE_RATE_KEY,
      unitPrice: fallbackRate,
    };

    for (const point of rateTimeline) {
      if (point.monthKey <= date) {
        selected = { effectiveFrom: point.monthKey, unitPrice: point.dailyRate };
        continue;
      }
      break;
    }

    return selected;
  }

  for (const entry of projectEntries) {
    const qty = quantityForEntry(entry.dayType as "working" | "extra_working" | "half_day");
    const ratePoint = getRatePointForDate(entry.date);
    const key = `${ratePoint.effectiveFrom}|${ratePoint.unitPrice}`;
    const current = quantityByRatePoint.get(key);

    if (current) {
      current.quantity += qty;
    } else {
      quantityByRatePoint.set(key, {
        effectiveFrom: ratePoint.effectiveFrom,
        unitPrice: ratePoint.unitPrice,
        quantity: qty,
      });
    }
  }

  const buckets = Array.from(quantityByRatePoint.values()).sort((a, b) => {
    if (a.effectiveFrom === BASE_RATE_KEY) return -1;
    if (b.effectiveFrom === BASE_RATE_KEY) return 1;
    return a.effectiveFrom.localeCompare(b.effectiveFrom);
  });

  const hasMultipleRates = buckets.length > 1;
  return buckets.map((bucket) => ({
    description: hasMultipleRates
      ? `${baseDescription} - Rate from ${bucket.effectiveFrom === BASE_RATE_KEY ? "base contract" : bucket.effectiveFrom}`
      : baseDescription,
    hsnSac: invoiceSettings.defaultHsnSac,
    quantity: bucket.quantity,
    unitPrice: bucket.unitPrice,
    amount: bucket.quantity * bucket.unitPrice,
  }));
}

export async function createInvoice(data: {
  clientId: number;
  projectId?: number | null;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  issueDate: string;
  dueDate?: string;
  notes?: string;
  lineItems: {
    description: string;
    hsnSac?: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }[];
}): Promise<{ success: boolean; id?: number }> {
  await assertAdminAccess();
  const invoiceNumber = await generateInvoiceNumber();
  const profile = await getUserProfile();
  const client = await getClient(data.clientId);

  if (!client) return { success: false };

  // Determine currency from project → client → default
  const project = data.projectId ? await getProject(data.projectId) : null;
  const currency = project?.currency ?? client.currency ?? "EUR";

  const subtotal = data.lineItems.reduce((sum, item) => sum + item.amount, 0);
  // Export of services under LUT — IGST at 0%
  const cgstRate = 0, cgstAmount = 0, sgstRate = 0, sgstAmount = 0, igstRate = 0, igstAmount = 0;
  const total = subtotal;

  const fromAddress = [profile.addressLine1, profile.addressLine2, profile.city, profile.state, profile.pincode, profile.country]
    .filter(Boolean)
    .join(", ");

  const toAddress = [client.addressLine1, client.addressLine2, client.city, client.state, client.pincode]
    .filter(Boolean)
    .join(", ");

  const result = db
    .insert(invoices)
    .values({
      invoiceNumber,
      clientId: data.clientId,
      projectId: data.projectId ?? null,
      billingPeriodStart: data.billingPeriodStart,
      billingPeriodEnd: data.billingPeriodEnd,
      issueDate: data.issueDate,
      dueDate: data.dueDate || null,
      fromName: profile.name || null,
      fromCompany: profile.company || null,
      fromAddress: fromAddress || null,
      fromGstin: profile.gstin || null,
      fromPan: profile.pan || null,
      fromEmail: profile.email || null,
      fromPhone: profile.phone || null,
      fromBankName: profile.bankName || null,
      fromBankAccount: profile.bankAccount || null,
      fromBankIfsc: profile.bankIfsc || null,
      fromBankBranch: profile.bankBranch || null,
      fromBankIban: profile.bankIban || null,
      fromBankBic: profile.bankBic || null,
      fromSepaAccountName: profile.sepaAccountName || null,
      fromSepaIban: profile.sepaIban || null,
      fromSepaBic: profile.sepaBic || null,
      fromSepaBank: profile.sepaBank || null,
      fromSepaAccountType: profile.sepaAccountType || null,
      fromSepaAddress: profile.sepaAddress || null,
      fromSwiftAccountName: profile.swiftAccountName || null,
      fromSwiftIban: profile.swiftIban || null,
      fromSwiftBic: profile.swiftBic || null,
      fromSwiftBank: profile.swiftBank || null,
      fromSwiftAccountType: profile.swiftAccountType || null,
      toName: client.name || null,
      toCompany: client.company || null,
      toAddress: toAddress || null,
      toGstin: client.gstin || null,
      toEmail: client.email || null,
      subtotal,
      cgstRate,
      cgstAmount,
      sgstRate,
      sgstAmount,
      igstRate,
      igstAmount,
      total,
      currency,
      status: "draft",
      notes: data.notes || null,
    })
    .run();

  const invoiceId = Number(result.lastInsertRowid);

  for (const item of data.lineItems) {
    db.insert(invoiceLineItems)
      .values({
        invoiceId,
        description: item.description,
        hsnSac: item.hsnSac || null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
      })
      .run();
  }

  // Increment next invoice number
  const settings = await getInvoiceSettings();
  const { saveInvoiceSettings } = await import("./settings");
  await saveInvoiceSettings({ ...settings, nextNumber: settings.nextNumber + 1 });

  return { success: true, id: invoiceId };
}

export async function updateInvoiceStatus(
  id: number,
  status: InvoiceStatus,
  paymentData?: {
    paidDate: string;
    eurToInrRate: number;
    platformCharges: number;
    bankCharges: number;
    netInrAmount: number;
  }
): Promise<{ success: boolean }> {
  await assertAdminAccess();
  if (status === "paid" && paymentData) {
    db.update(invoices)
      .set({
        status,
        paidDate: paymentData.paidDate,
        eurToInrRate: paymentData.eurToInrRate,
        platformCharges: paymentData.platformCharges,
        bankCharges: paymentData.bankCharges,
        netInrAmount: paymentData.netInrAmount,
      })
      .where(eq(invoices.id, id))
      .run();
  } else {
    db.update(invoices).set({ status }).where(eq(invoices.id, id)).run();
  }

  // Sync to expense manager
  await syncInvoiceToExpense(id);

  return { success: true };
}

export async function updatePaymentDetails(
  id: number,
  data: {
    paidDate: string | null;
    eurToInrRate: number;
    platformCharges: number;
    bankCharges: number;
    netInrAmount: number;
  }
): Promise<{ success: boolean }> {
  await assertAdminAccess();
  db.update(invoices)
    .set({
      paidDate: data.paidDate,
      eurToInrRate: data.eurToInrRate,
      platformCharges: data.platformCharges,
      bankCharges: data.bankCharges,
      netInrAmount: data.netInrAmount,
    })
    .where(eq(invoices.id, id))
    .run();

  // Re-sync to expense manager (amount/date may have changed)
  await syncInvoiceToExpense(id);

  return { success: true };
}

export async function resetInvoiceCounter(nextNumber: number = 1): Promise<{ success: boolean }> {
  await assertAdminAccess();
  const settings = await getInvoiceSettings();
  const { saveInvoiceSettings } = await import("./settings");
  await saveInvoiceSettings({ ...settings, nextNumber });
  return { success: true };
}

export async function deleteInvoice(id: number): Promise<{ success: boolean }> {
  await assertAdminAccess();
  // Soft-delete: mark as cancelled to preserve invoice number audit trail
  db.update(invoices).set({ status: "cancelled" }).where(eq(invoices.id, id)).run();

  // Remove linked expense transaction
  await removeInvoiceExpenseLink(id);

  return { success: true };
}

// --- Attachments ---

export async function getInvoiceAttachments(invoiceId: number): Promise<InvoiceAttachment[]> {
  await assertAuthenticatedAccess();
  return db
    .select()
    .from(invoiceAttachments)
    .where(eq(invoiceAttachments.invoiceId, invoiceId))
    .orderBy(desc(invoiceAttachments.createdAt))
    .all() as InvoiceAttachment[];
}

export async function getAllInvoiceAttachments(): Promise<Record<number, InvoiceAttachment[]>> {
  await assertAuthenticatedAccess();
  const all = db
    .select()
    .from(invoiceAttachments)
    .orderBy(desc(invoiceAttachments.createdAt))
    .all() as InvoiceAttachment[];
  const byInvoice: Record<number, InvoiceAttachment[]> = {};
  for (const att of all) {
    (byInvoice[att.invoiceId] ??= []).push(att);
  }
  return byInvoice;
}

export async function getInvoiceAttachmentCounts(): Promise<Record<number, number>> {
  await assertAuthenticatedAccess();
  const rows = db
    .select({ invoiceId: invoiceAttachments.invoiceId, count: sql<number>`count(*)` })
    .from(invoiceAttachments)
    .groupBy(invoiceAttachments.invoiceId)
    .all();
  const counts: Record<number, number> = {};
  for (const row of rows) {
    counts[row.invoiceId] = row.count;
  }
  return counts;
}

export async function addInvoiceAttachment(data: {
  invoiceId: number;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  label?: string;
}): Promise<{ success: boolean; id?: number }> {
  await assertAdminAccess();
  const result = db
    .insert(invoiceAttachments)
    .values({
      invoiceId: data.invoiceId,
      fileName: data.fileName,
      originalName: data.originalName,
      mimeType: data.mimeType,
      fileSize: data.fileSize,
      label: data.label || null,
    })
    .run();

  return { success: true, id: Number(result.lastInsertRowid) };
}

export async function deleteInvoiceAttachment(id: number): Promise<{ success: boolean; fileName?: string }> {
  await assertAdminAccess();
  const attachment = db
    .select()
    .from(invoiceAttachments)
    .where(eq(invoiceAttachments.id, id))
    .get() as InvoiceAttachment | undefined;

  if (!attachment) return { success: false };

  db.delete(invoiceAttachments).where(eq(invoiceAttachments.id, id)).run();
  return { success: true, fileName: attachment.fileName };
}
