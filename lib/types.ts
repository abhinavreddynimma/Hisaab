import type { DayType, InvoiceStatus } from "./constants";

export type { DayType, InvoiceStatus };

export type AuthRole = "admin" | "viewer";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: AuthRole;
  tag: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface UserProfile {
  name: string;
  company: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  gstin: string;
  pan: string;
  email: string;
  phone: string;
  bankName: string;
  bankAccount: string;
  bankIfsc: string;
  bankBranch: string;
  bankIban: string;
  bankBic: string;
  // SEPA Transfer details
  sepaAccountName: string;
  sepaIban: string;
  sepaBic: string;
  sepaBank: string;
  sepaAccountType: string;
  sepaAddress: string;
  // SWIFT Transfer details
  swiftAccountName: string;
  swiftIban: string;
  swiftBic: string;
  swiftBank: string;
  swiftAccountType: string;
}

export interface LeavePolicy {
  leavesPerMonth: number;
  standardWorkingDays: number;
  trackingStartDate: string; // "YYYY-MM"
  annualDaysOffTarget: number;
}

export interface InvoiceSettings {
  prefix: string;
  nextNumber: number;
  defaultHsnSac: string;
  defaultTaxRate: number;
  taxType: "cgst_sgst" | "igst";
}

export interface Client {
  id: number;
  name: string;
  company: string | null;
  gstin: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  currency: string;
  isActive: boolean;
  createdAt: string;
}

export interface Project {
  id: number;
  clientId: number;
  name: string;
  defaultDailyRate: number;
  currentDailyRate?: number;
  currency: string;
  isActive: boolean;
  createdAt: string;
}

export interface ProjectRate {
  id: number;
  projectId: number;
  monthKey: string; // Effective date in YYYY-MM-DD format
  dailyRate: number;
}

export interface DayEntry {
  id: number;
  date: string;
  dayType: DayType;
  projectId: number | null;
  notes: string | null;
}

export interface MonthSummary {
  workingDays: number;
  leaves: number;
  holidays: number;
  halfDays: number;
  extraWorkingDays: number;
  weekends: number;
  effectiveWorkingDays: number;
}

export interface Invoice {
  id: number;
  invoiceNumber: string;
  clientId: number;
  projectId: number | null;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  issueDate: string;
  dueDate: string | null;
  fromName: string | null;
  fromCompany: string | null;
  fromAddress: string | null;
  fromGstin: string | null;
  fromPan: string | null;
  fromEmail: string | null;
  fromPhone: string | null;
  fromBankName: string | null;
  fromBankAccount: string | null;
  fromBankIfsc: string | null;
  fromBankBranch: string | null;
  fromBankIban: string | null;
  fromBankBic: string | null;
  // SEPA Transfer snapshot
  fromSepaAccountName: string | null;
  fromSepaIban: string | null;
  fromSepaBic: string | null;
  fromSepaBank: string | null;
  fromSepaAccountType: string | null;
  fromSepaAddress: string | null;
  // SWIFT Transfer snapshot
  fromSwiftAccountName: string | null;
  fromSwiftIban: string | null;
  fromSwiftBic: string | null;
  fromSwiftBank: string | null;
  fromSwiftAccountType: string | null;
  toName: string | null;
  toCompany: string | null;
  toAddress: string | null;
  toGstin: string | null;
  toEmail: string | null;
  subtotal: number;
  cgstRate: number | null;
  cgstAmount: number | null;
  sgstRate: number | null;
  sgstAmount: number | null;
  igstRate: number | null;
  igstAmount: number | null;
  total: number;
  currency: string;
  status: InvoiceStatus;
  notes: string | null;
  paidDate: string | null;
  eurToInrRate: number | null;
  platformCharges: number | null;
  bankCharges: number | null;
  netInrAmount: number | null;
  createdAt: string;
}

export interface InvoiceLineItem {
  id: number;
  invoiceId: number;
  description: string;
  hsnSac: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface InvoiceAttachment {
  id: number;
  invoiceId: number;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  label: string | null;
  createdAt: string;
}

export type TaxQuarter = "Q1" | "Q2" | "Q3" | "Q4";

export interface TaxPayment {
  id: number;
  financialYear: string;
  quarter: TaxQuarter;
  amount: number;
  paymentDate: string;
  challanNo: string | null;
  notes: string | null;
  createdAt: string;
}

export interface TaxPaymentAttachment {
  id: number;
  taxPaymentId: number;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  label: string | null;
  createdAt: string;
}

export interface DashboardStats {
  totalEarnings: number;
  thisMonthEarnings: number;
  leaveBalance: number;
  openInvoices: number;
  outstandingByCurrency: { currency: string; amount: number }[];
  outstandingInr: number;
  avgPaymentDelay: number | null;
  nextMonthProjection: {
    estimatedInr: number;
    workingDays: number;
    avgRate: number;
    currency: string;
  } | null;
}

// Expense Manager types
export type ExpenseAccountType = "income" | "expense" | "investment" | "savings" | "bank" | "cash";
export type ExpenseTransactionType = "income" | "expense" | "transfer";

export interface ExpenseAccount {
  id: number;
  name: string;
  type: ExpenseAccountType;
  parentId: number | null;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export type ExpenseTransactionSource = "manual" | "invoice" | "recurring" | "tax_payment" | "bank_statement";
export type ExpenseTransactionStatus = "confirmed" | "estimated" | "dismissed";

export interface ExpenseTransaction {
  id: number;
  type: ExpenseTransactionType;
  date: string;
  amount: number;
  categoryId: number | null;
  accountId: number | null;
  fromAccountId: number | null;
  toAccountId: number | null;
  fees: number | null;
  note: string | null;
  tags: string | null;
  source: ExpenseTransactionSource;
  sourceId: string | null;
  status: ExpenseTransactionStatus;
  createdAt: string;
  categoryName?: string;
  accountName?: string;
  fromAccountName?: string;
  toAccountName?: string;
}

export interface ExpenseBudget {
  id: number;
  name: string;
  monthlyAmount: number;
  financialYear: string;
  isActive: boolean;
  createdAt: string;
  categoryIds?: number[];
  categoryNames?: string[];
  spent?: number;
}

export interface ExpenseTarget {
  id: number;
  name: string;
  monthlyAmount: number;
  financialYear: string;
  isActive: boolean;
  createdAt: string;
  accountIds?: number[];
  accountNames?: string[];
  thisMonthActual?: number;
  fyAverage?: number;
}

export type RecurringFrequency = "monthly" | "quarterly" | "yearly";

export interface ExpenseRecurring {
  id: number;
  name: string;
  type: ExpenseTransactionType;
  amount: number;
  categoryId: number | null;
  accountId: number | null;
  fromAccountId: number | null;
  toAccountId: number | null;
  frequency: RecurringFrequency;
  dayOfMonth: number;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  createdAt: string;
  categoryName?: string;
  accountName?: string;
}
