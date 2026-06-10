// Shared EUR-INR rate / deduction maths derived from paid invoices.
//
// Three call sites (invoice→expense sync, dashboard, tax computation) all
// computed a EUR-weighted average rate, a deductions percentage, and/or the
// most-recent spot rate from a set of paid invoices — with subtly different
// fallbacks and clamping. This helper computes every piece once; each caller
// picks the fields it needs and applies its own fallback, so behaviour is
// preserved exactly while the core formula lives in one place.

export interface PaidInvoiceRateRow {
  total: number | null;
  eurToInrRate: number | null;
  platformCharges?: number | null;
  bankCharges?: number | null;
  paidDate?: string | null;
}

export interface InvoiceFxStats {
  /** Count of rows that have a usable (truthy) EUR-INR rate. */
  rated: number;
  /** Sum of EUR totals across rated rows. */
  totalEur: number;
  /** EUR-weighted average rate; 0 when there is no rated EUR volume. */
  avgRate: number;
  /** Rate of the most-recently-paid rated invoice; falls back to avgRate. */
  latestRate: number;
  /** deductions / gross INR, uncapped; 0 when gross is 0. */
  deductionPctRaw: number;
  /** deductionPctRaw clamped to [0, 0.10]. */
  deductionPct: number;
}

const DEDUCTION_CAP = 0.10;

export function computeInvoiceFxStats(rows: PaidInvoiceRateRow[]): InvoiceFxStats {
  const rated = rows.filter((r) => r.eurToInrRate);
  const totalEur = rated.reduce((s, r) => s + (r.total ?? 0), 0);
  const avgRate = totalEur > 0
    ? rated.reduce((s, r) => s + (r.eurToInrRate ?? 0) * (r.total ?? 0), 0) / totalEur
    : 0;

  const grossInr = totalEur * avgRate;
  const totalDeductions = rated.reduce(
    (s, r) => s + (r.platformCharges ?? 0) + (r.bankCharges ?? 0),
    0,
  );
  const deductionPctRaw = grossInr > 0 ? totalDeductions / grossInr : 0;
  const deductionPct = Math.min(Math.max(0, deductionPctRaw), DEDUCTION_CAP);

  const latest = [...rated]
    .filter((r) => r.paidDate)
    .sort((a, b) => (b.paidDate ?? "").localeCompare(a.paidDate ?? ""))[0];
  const latestRate = latest?.eurToInrRate ?? avgRate;

  return { rated: rated.length, totalEur, avgRate, latestRate, deductionPctRaw, deductionPct };
}
