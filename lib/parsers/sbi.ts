import * as XLSX from "xlsx";
import { extractReference, normalizePayee } from "../dedup";

export interface ParsedStatementRow {
  date: string; // "YYYY-MM-DD"
  amount: number; // always positive
  direction: "credit" | "debit";
  balance: number | null;
  rawDescription: string;
  normalizedPayee: string | null;
  reference: string | null;
  rawJson: string; // original row as JSON
}

export interface ParseResult {
  rows: ParsedStatementRow[];
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  errors: string[];
}

/**
 * Parse an SBI bank statement Excel file.
 *
 * SBI Excel format (typical):
 *   Row headers: Txn Date | Value Date | Description | Ref No./Cheque No. | Debit | Credit | Balance
 *   Sometimes: Date | Narration | Chq./Ref.No. | Value Dt | Withdrawal Amt. | Deposit Amt. | Closing Balance
 *
 * Files may be password-protected (handled by caller passing buffer after decryption,
 * or by xlsx library if it supports the password).
 */
export function parseSbiStatement(
  buffer: Buffer,
  password?: string,
): ParseResult {
  const errors: string[] = [];

  const workbook = XLSX.read(buffer, {
    type: "buffer",
    password,
    cellDates: true,
  });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { rows: [], dateRangeStart: null, dateRangeEnd: null, errors: ["No sheets found in workbook"] };
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  if (rawRows.length === 0) {
    return { rows: [], dateRangeStart: null, dateRangeEnd: null, errors: ["No data rows found"] };
  }

  // Detect column mapping from headers
  const columns = detectColumns(Object.keys(rawRows[0]));
  if (!columns) {
    return {
      rows: [],
      dateRangeStart: null,
      dateRangeEnd: null,
      errors: [`Could not detect SBI column mapping. Headers: ${Object.keys(rawRows[0]).join(", ")}`],
    };
  }

  const rows: ParsedStatementRow[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    try {
      const parsed = parseRow(raw, columns);
      if (parsed) rows.push(parsed);
    } catch (e) {
      errors.push(`Row ${i + 1}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Sort by date ascending
  rows.sort((a, b) => a.date.localeCompare(b.date));

  const dateRangeStart = rows.length > 0 ? rows[0].date : null;
  const dateRangeEnd = rows.length > 0 ? rows[rows.length - 1].date : null;

  return { rows, dateRangeStart, dateRangeEnd, errors };
}

// ---------------------------------------------------------------------------
// Column detection
// ---------------------------------------------------------------------------

interface ColumnMap {
  date: string;
  description: string;
  reference: string | null;
  debit: string | null;
  credit: string | null;
  balance: string | null;
}

function detectColumns(headers: string[]): ColumnMap | null {
  const lower = headers.map((h) => h.toLowerCase().trim());

  // Try common SBI header patterns
  const dateCol = findHeader(lower, headers, ["txn date", "txn_date", "transaction date", "date", "trans date"]);
  const descCol = findHeader(lower, headers, ["description", "narration", "particulars", "details"]);
  const refCol = findHeader(lower, headers, [
    "ref no./cheque no.", "ref no", "chq./ref.no.", "chq/ref no", "reference",
    "cheque no", "ref_no", "reference no",
  ]);
  const debitCol = findHeader(lower, headers, ["debit", "withdrawal amt.", "withdrawal", "debit amount", "dr"]);
  const creditCol = findHeader(lower, headers, ["credit", "deposit amt.", "deposit", "credit amount", "cr"]);
  const balanceCol = findHeader(lower, headers, ["balance", "closing balance", "running balance"]);

  if (!dateCol || !descCol) return null;

  return {
    date: dateCol,
    description: descCol,
    reference: refCol,
    debit: debitCol,
    credit: creditCol,
    balance: balanceCol,
  };
}

function findHeader(lowerHeaders: string[], originalHeaders: string[], patterns: string[]): string | null {
  for (const pattern of patterns) {
    const idx = lowerHeaders.findIndex((h) => h.includes(pattern));
    if (idx !== -1) return originalHeaders[idx];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Row parsing
// ---------------------------------------------------------------------------

function parseRow(raw: Record<string, unknown>, columns: ColumnMap): ParsedStatementRow | null {
  const dateVal = raw[columns.date];
  const date = parseDate(dateVal);
  if (!date) return null; // skip non-data rows (headers, footers, summaries)

  const description = String(raw[columns.description] || "").trim();
  if (!description) return null;

  // Parse amounts
  const debitAmt = columns.debit ? parseAmount(raw[columns.debit]) : 0;
  const creditAmt = columns.credit ? parseAmount(raw[columns.credit]) : 0;

  // If neither debit nor credit column found, try to infer from description or single amount column
  if (!debitAmt && !creditAmt) return null;

  const direction: "credit" | "debit" = creditAmt > 0 ? "credit" : "debit";
  const amount = creditAmt > 0 ? creditAmt : debitAmt;
  if (amount <= 0) return null;

  const balance = columns.balance ? parseAmount(raw[columns.balance]) : null;

  // Extract reference from dedicated column or from description
  const refFromCol = columns.reference ? String(raw[columns.reference] || "").trim() : null;
  const reference = (refFromCol && refFromCol.length > 3 ? refFromCol : null) || extractReference(description);

  const normalizedPayee = normalizePayee(description);

  return {
    date,
    amount,
    direction,
    balance: balance || null,
    rawDescription: description,
    normalizedPayee: normalizedPayee || null,
    reference,
    rawJson: JSON.stringify(raw),
  };
}

function parseDate(val: unknown): string | null {
  if (!val) return null;

  // xlsx with cellDates: true returns Date objects
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return formatDateYMD(val);
  }

  const s = String(val).trim();
  if (!s || s === "-") return null;

  // Try DD/MM/YYYY or DD-MM-YYYY (Indian format)
  const ddmmyyyy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    if (!isNaN(date.getTime())) return formatDateYMD(date);
  }

  // Try DD Mon YYYY (e.g., "14 Apr 2026")
  const ddmonyyyy = s.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/);
  if (ddmonyyyy) {
    const date = new Date(s);
    if (!isNaN(date.getTime())) return formatDateYMD(date);
  }

  // Try YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return s;

  return null;
}

function formatDateYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseAmount(val: unknown): number {
  if (typeof val === "number") return Math.abs(val);
  if (!val) return 0;
  const s = String(val).replace(/[,\s₹]/g, "").trim();
  if (!s || s === "-") return 0;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.abs(n);
}
