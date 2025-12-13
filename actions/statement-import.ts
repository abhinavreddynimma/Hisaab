"use server";

import { createHash } from "crypto";
import { db } from "@/db";
import {
  statementImports,
  statementRows,
  canonicalTransactions,
  canonicalTransactionSources,
} from "@/db/schema";
import { eq, and, between, sql } from "drizzle-orm";
import { assertAdminAccess } from "@/lib/auth";
import { parseSbiStatement, type ParsedStatementRow } from "@/lib/parsers/sbi";
import {
  computeFingerprint,
  findBestMatch,
  type MatchCandidate,
} from "@/lib/dedup";
import type {
  StatementSource,
  StatementImport,
  CanonicalTransaction,
  MatchStatus,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Import a statement file
// ---------------------------------------------------------------------------

export interface ImportResult {
  importId: number;
  totalRows: number;
  newTransactions: number;
  autoMatched: number;
  flaggedForReview: number;
  skippedDuplicates: number;
  errors: string[];
}

export async function importStatement(
  formData: FormData,
): Promise<ImportResult> {
  await assertAdminAccess();

  const file = formData.get("file") as File | null;
  const source = formData.get("source") as StatementSource | null;
  const password = formData.get("password") as string | null;

  if (!file) throw new Error("No file provided");
  if (!source) throw new Error("No source specified");

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileHash = createHash("sha256").update(buffer).digest("hex");

  // Check for duplicate import
  const existing = db
    .select()
    .from(statementImports)
    .where(eq(statementImports.fileHash, fileHash))
    .get();

  if (existing) {
    throw new Error(
      `This file was already imported on ${new Date(existing.createdAt).toLocaleDateString()}`,
    );
  }

  // Parse based on source
  let parsed: { rows: ParsedStatementRow[]; dateRangeStart: string | null; dateRangeEnd: string | null; errors: string[] };

  switch (source) {
    case "sbi":
      parsed = parseSbiStatement(buffer, password || undefined);
      break;
    // Future parsers:
    // case "phonepe": parsed = parsePhonePeStatement(buffer); break;
    // case "hdfc": parsed = parseHdfcStatement(buffer); break;
    default:
      throw new Error(`Parser not yet implemented for source: ${source}`);
  }

  if (parsed.rows.length === 0 && parsed.errors.length > 0) {
    // Create failed import record
    const failedImport = db
      .insert(statementImports)
      .values({
        source,
        fileName: `${Date.now()}_${file.name}`,
        originalName: file.name,
        fileHash,
        rowCount: 0,
        status: "failed",
        errorMessage: parsed.errors.join("; "),
      })
      .returning()
      .get();

    return {
      importId: failedImport.id,
      totalRows: 0,
      newTransactions: 0,
      autoMatched: 0,
      flaggedForReview: 0,
      skippedDuplicates: 0,
      errors: parsed.errors,
    };
  }

  // Create import record
  const importRecord = db
    .insert(statementImports)
    .values({
      source,
      fileName: `${Date.now()}_${file.name}`,
      originalName: file.name,
      fileHash,
      dateRangeStart: parsed.dateRangeStart,
      dateRangeEnd: parsed.dateRangeEnd,
      rowCount: parsed.rows.length,
      status: "processing",
    })
    .returning()
    .get();

  // Process rows
  const result = processImportRows(importRecord.id, parsed.rows, parsed.dateRangeStart, parsed.dateRangeEnd);

  // Mark import as completed
  db.update(statementImports)
    .set({ status: "completed" })
    .where(eq(statementImports.id, importRecord.id))
    .run();

  return {
    importId: importRecord.id,
    totalRows: parsed.rows.length,
    ...result,
    errors: parsed.errors,
  };
}

// ---------------------------------------------------------------------------
// Process parsed rows: insert + dedup + match
// ---------------------------------------------------------------------------

function processImportRows(
  importId: number,
  rows: ParsedStatementRow[],
  dateRangeStart: string | null,
  dateRangeEnd: string | null,
): { newTransactions: number; autoMatched: number; flaggedForReview: number; skippedDuplicates: number } {
  let newTransactions = 0;
  let autoMatched = 0;
  let flaggedForReview = 0;
  let skippedDuplicates = 0;

  // Load existing canonical transactions in the date range for matching
  const candidates = loadMatchCandidates(dateRangeStart, dateRangeEnd);

  for (const row of rows) {
    const fingerprint = computeFingerprint({
      date: row.date,
      amount: row.amount,
      direction: row.direction,
      reference: row.reference,
      rawDescription: row.rawDescription,
    });

    // Check if this exact row already exists in this import (shouldn't happen)
    // or in another import (re-import of overlapping data)
    const existingRow = db
      .select()
      .from(statementRows)
      .where(
        and(
          eq(statementRows.importId, importId),
          eq(statementRows.fingerprint, fingerprint),
        ),
      )
      .get();

    if (existingRow) {
      skippedDuplicates++;
      continue;
    }

    // Also check if this fingerprint exists in ANY import (cross-import dedup)
    const existingAnyImport = db
      .select({ id: statementRows.id, canonicalTransactionId: statementRows.canonicalTransactionId })
      .from(statementRows)
      .where(eq(statementRows.fingerprint, fingerprint))
      .get();

    if (existingAnyImport) {
      // Same raw row from a different import — link to same canonical if available
      const insertedRow = db
        .insert(statementRows)
        .values({
          importId,
          date: row.date,
          amount: row.amount,
          direction: row.direction,
          balance: row.balance,
          rawDescription: row.rawDescription,
          normalizedPayee: row.normalizedPayee,
          reference: row.reference,
          fingerprint: fingerprint + `:${importId}`, // make unique per import
          rawJson: row.rawJson,
          canonicalTransactionId: existingAnyImport.canonicalTransactionId,
        })
        .returning()
        .get();

      if (existingAnyImport.canonicalTransactionId) {
        // Link this row to the existing canonical transaction
        db.insert(canonicalTransactionSources)
          .values({
            canonicalTransactionId: existingAnyImport.canonicalTransactionId,
            statementRowId: insertedRow.id,
            matchType: "exact",
            confidence: 1,
          })
          .run();
        autoMatched++;
      } else {
        skippedDuplicates++;
      }
      continue;
    }

    // Insert the raw row
    const insertedRow = db
      .insert(statementRows)
      .values({
        importId,
        date: row.date,
        amount: row.amount,
        direction: row.direction,
        balance: row.balance,
        rawDescription: row.rawDescription,
        normalizedPayee: row.normalizedPayee,
        reference: row.reference,
        fingerprint,
        rawJson: row.rawJson,
      })
      .returning()
      .get();

    // Try to match against existing canonical transactions
    const match = findBestMatch(
      {
        date: row.date,
        amount: row.amount,
        direction: row.direction,
        reference: row.reference,
        normalizedPayee: row.normalizedPayee,
      },
      candidates,
    );

    if (match.type === "exact" || match.type === "strong") {
      // Link to existing canonical transaction
      db.update(statementRows)
        .set({ canonicalTransactionId: match.canonicalId })
        .where(eq(statementRows.id, insertedRow.id))
        .run();

      db.insert(canonicalTransactionSources)
        .values({
          canonicalTransactionId: match.canonicalId,
          statementRowId: insertedRow.id,
          matchType: match.type,
          confidence: match.confidence,
        })
        .run();

      autoMatched++;
    } else if (match.type === "fuzzy") {
      // Flag for manual review — create link but mark as review
      db.update(statementRows)
        .set({ canonicalTransactionId: match.canonicalId })
        .where(eq(statementRows.id, insertedRow.id))
        .run();

      db.insert(canonicalTransactionSources)
        .values({
          canonicalTransactionId: match.canonicalId,
          statementRowId: insertedRow.id,
          matchType: "fuzzy",
          confidence: match.confidence,
        })
        .run();

      // Update canonical to review status if not already matched
      db.update(canonicalTransactions)
        .set({ matchStatus: "review" })
        .where(eq(canonicalTransactions.id, match.canonicalId))
        .run();

      flaggedForReview++;
    } else {
      // No match — create new canonical transaction
      const canonical = db
        .insert(canonicalTransactions)
        .values({
          date: row.date,
          amount: row.amount,
          direction: row.direction,
          normalizedPayee: row.normalizedPayee,
          reference: row.reference,
          description: row.rawDescription,
          matchStatus: "unmatched",
        })
        .returning()
        .get();

      db.update(statementRows)
        .set({ canonicalTransactionId: canonical.id })
        .where(eq(statementRows.id, insertedRow.id))
        .run();

      db.insert(canonicalTransactionSources)
        .values({
          canonicalTransactionId: canonical.id,
          statementRowId: insertedRow.id,
          matchType: "exact",
          confidence: 1,
        })
        .run();

      // Add to candidates for matching subsequent rows in same import
      candidates.push({
        id: canonical.id,
        date: row.date,
        amount: row.amount,
        direction: row.direction,
        reference: row.reference,
        normalizedPayee: row.normalizedPayee,
      });

      newTransactions++;
    }
  }

  return { newTransactions, autoMatched, flaggedForReview, skippedDuplicates };
}

// ---------------------------------------------------------------------------
// Load existing canonical transactions for matching
// ---------------------------------------------------------------------------

function loadMatchCandidates(
  dateStart: string | null,
  dateEnd: string | null,
): MatchCandidate[] {
  // Widen the date window by 2 days on each side for fuzzy matching
  let query;
  if (dateStart && dateEnd) {
    const start = shiftDate(dateStart, -2);
    const end = shiftDate(dateEnd, 2);
    query = db
      .select({
        id: canonicalTransactions.id,
        date: canonicalTransactions.date,
        amount: canonicalTransactions.amount,
        direction: canonicalTransactions.direction,
        reference: canonicalTransactions.reference,
        normalizedPayee: canonicalTransactions.normalizedPayee,
      })
      .from(canonicalTransactions)
      .where(between(canonicalTransactions.date, start, end))
      .all();
  } else {
    query = db
      .select({
        id: canonicalTransactions.id,
        date: canonicalTransactions.date,
        amount: canonicalTransactions.amount,
        direction: canonicalTransactions.direction,
        reference: canonicalTransactions.reference,
        normalizedPayee: canonicalTransactions.normalizedPayee,
      })
      .from(canonicalTransactions)
      .all();
  }

  return query as MatchCandidate[];
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ---------------------------------------------------------------------------
// Query helpers for UI
// ---------------------------------------------------------------------------

export async function getStatementImports(): Promise<StatementImport[]> {
  await assertAdminAccess();
  return db
    .select()
    .from(statementImports)
    .orderBy(sql`${statementImports.createdAt} DESC`)
    .all() as StatementImport[];
}

export async function getCanonicalTransactions(opts?: {
  matchStatus?: MatchStatus;
  dateStart?: string;
  dateEnd?: string;
}): Promise<CanonicalTransaction[]> {
  await assertAdminAccess();

  const conditions = [];
  if (opts?.matchStatus) {
    conditions.push(eq(canonicalTransactions.matchStatus, opts.matchStatus));
  }
  if (opts?.dateStart && opts?.dateEnd) {
    conditions.push(between(canonicalTransactions.date, opts.dateStart, opts.dateEnd));
  }

  const query = conditions.length > 0
    ? db.select().from(canonicalTransactions).where(and(...conditions))
    : db.select().from(canonicalTransactions);

  return query.orderBy(sql`${canonicalTransactions.date} DESC`).all() as CanonicalTransaction[];
}

export async function getStatementRowsForImport(importId: number) {
  await assertAdminAccess();
  return db
    .select()
    .from(statementRows)
    .where(eq(statementRows.importId, importId))
    .orderBy(statementRows.date)
    .all();
}

export async function getSourcesForCanonical(canonicalId: number) {
  await assertAdminAccess();
  return db
    .select({
      source: canonicalTransactionSources,
      row: statementRows,
    })
    .from(canonicalTransactionSources)
    .innerJoin(statementRows, eq(canonicalTransactionSources.statementRowId, statementRows.id))
    .where(eq(canonicalTransactionSources.canonicalTransactionId, canonicalId))
    .all();
}

// ---------------------------------------------------------------------------
// Manual match / review actions
// ---------------------------------------------------------------------------

export async function resolveMatch(
  canonicalId: number,
  action: "confirm" | "reject" | "ignore",
) {
  await assertAdminAccess();

  const statusMap: Record<string, MatchStatus> = {
    confirm: "manual_matched",
    reject: "unmatched",
    ignore: "ignored",
  };

  db.update(canonicalTransactions)
    .set({ matchStatus: statusMap[action] })
    .where(eq(canonicalTransactions.id, canonicalId))
    .run();
}

export async function updateCanonicalCategory(
  canonicalId: number,
  categoryId: number | null,
  accountId: number | null,
) {
  await assertAdminAccess();

  db.update(canonicalTransactions)
    .set({ categoryId, accountId })
    .where(eq(canonicalTransactions.id, canonicalId))
    .run();
}
