import { z } from "zod/v4";

export const userProfileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  company: z.string().optional().default(""),
  addressLine1: z.string().optional().default(""),
  addressLine2: z.string().optional().default(""),
  city: z.string().optional().default(""),
  state: z.string().optional().default(""),
  pincode: z.string().optional().default(""),
  country: z.string().optional().default(""),
  gstin: z.string().optional().default(""),
  pan: z.string().optional().default(""),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().default(""),
  bankName: z.string().optional().default(""),
  bankAccount: z.string().optional().default(""),
  bankIfsc: z.string().optional().default(""),
  bankBranch: z.string().optional().default(""),
  bankIban: z.string().optional().default(""),
  bankBic: z.string().optional().default(""),
  // SEPA Transfer
  sepaAccountName: z.string().optional().default(""),
  sepaIban: z.string().optional().default(""),
  sepaBic: z.string().optional().default(""),
  sepaBank: z.string().optional().default(""),
  sepaAccountType: z.string().optional().default(""),
  sepaAddress: z.string().optional().default(""),
  // SWIFT Transfer
  swiftAccountName: z.string().optional().default(""),
  swiftIban: z.string().optional().default(""),
  swiftBic: z.string().optional().default(""),
  swiftBank: z.string().optional().default(""),
  swiftAccountType: z.string().optional().default(""),
});

export const leavePolicySchema = z.object({
  leavesPerMonth: z.number().min(0).default(1),
  standardWorkingDays: z.number().min(1).max(31).default(22),
  trackingStartDate: z.string().regex(/^\d{4}-\d{2}$/, "Must be YYYY-MM format"),
  annualDaysOffTarget: z.number().min(0).default(20),
});

export const invoiceSettingsSchema = z.object({
  prefix: z.string().default("INV"),
  nextNumber: z.number().int().min(1).default(1),
  defaultHsnSac: z.string().default("998314"),
  defaultTaxRate: z.number().min(0).max(100).default(18),
  taxType: z.enum(["cgst_sgst", "igst"]).default("cgst_sgst"),
});

export const clientSchema = z.object({
  name: z.string().min(1, "Client name is required"),
  company: z.string().optional().default(""),
  gstin: z.string().optional().default(""),
  addressLine1: z.string().optional().default(""),
  addressLine2: z.string().optional().default(""),
  city: z.string().optional().default(""),
  state: z.string().optional().default(""),
  pincode: z.string().optional().default(""),
  country: z.string().optional().default(""),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().default(""),
});

export const projectSchema = z.object({
  clientId: z.number().int().positive(),
  name: z.string().min(1, "Project name is required"),
  defaultDailyRate: z.number().min(0, "Rate must be positive"),
});

export const dayEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format"),
  dayType: z.enum(["working", "leave", "holiday", "half_day", "extra_working", "weekend"]),
  projectId: z.number().int().positive().nullable().optional(),
  notes: z.string().optional().default(""),
});

export const invoiceLineItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  hsnSac: z.string().optional().default(""),
  quantity: z.number().min(0),
  unitPrice: z.number().min(0),
  amount: z.number(),
});

export const invoiceFormSchema = z.object({
  clientId: z.number().int().positive(),
  projectId: z.number().int().positive().nullable().optional(),
  billingPeriodStart: z.string(),
  billingPeriodEnd: z.string(),
  issueDate: z.string(),
  dueDate: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  lineItems: z.array(invoiceLineItemSchema).min(1, "At least one line item required"),
});

export const paymentSchema = z.object({
  eurToInrRate: z.number().positive("Conversion rate must be positive"),
  platformCharges: z.number().min(0).default(0),
  bankCharges: z.number().min(0).default(0),
});

const halfDayNumber = z.number().positive().refine((value) => Number.isInteger(value * 2), {
  message: "Value must be in 0.5 day increments",
});

export const extraDayBucketSchema = z.object({
  name: z.string().trim().min(1, "Bucket name is required"),
});

export const extraDayTargetSchema = z.discriminatedUnion("targetType", [
  z.object({
    bucketId: z.number().int().positive(),
    name: z.string().trim().min(1, "Target name is required"),
    targetType: z.literal("day"),
    goalDays: halfDayNumber,
    goalAmountInr: z.null().optional(),
    notes: z.string().optional().default(""),
  }),
  z.object({
    bucketId: z.number().int().positive(),
    name: z.string().trim().min(1, "Target name is required"),
    targetType: z.literal("money"),
    goalDays: z.null().optional(),
    goalAmountInr: z.number().positive("Goal amount must be positive"),
    notes: z.string().optional().default(""),
  }),
]);

export const extraDayAllocationSchema = z.discriminatedUnion("kind", [
  z.object({
    bucketId: z.number().int().positive(),
    targetId: z.number().int().positive().nullable().optional(),
    financialYear: z.string().regex(/^\d{4}-\d{2}$/, "Financial year must be YYYY-YY"),
    kind: z.literal("day"),
    confirmedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format"),
    days: halfDayNumber,
    dailyRate: z.null().optional(),
    amountInr: z.null().optional(),
    notes: z.string().optional().default(""),
  }),
  z.object({
    bucketId: z.number().int().positive(),
    targetId: z.number().int().positive().nullable().optional(),
    financialYear: z.string().regex(/^\d{4}-\d{2}$/, "Financial year must be YYYY-YY"),
    kind: z.literal("money"),
    confirmedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format"),
    days: halfDayNumber,
    dailyRate: z.number().positive("Daily rate must be positive"),
    amountInr: z.number().nonnegative().optional(),
    notes: z.string().optional().default(""),
  }),
]);
