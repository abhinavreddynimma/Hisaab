import { createHash } from "crypto";

/**
 * Dedup engine for unified statement ingestion.
 *
 * Fingerprinting: each statement row gets a fingerprint from its core fields.
 * Matching tiers:
 *   1. Exact: same reference (UTR/txn ID) → always same transaction
 *   2. Strong: same date + same amount + same direction + similar payee
 *   3. Fuzzy: same day + same amount + same direction → flag for review
 */

// ---------------------------------------------------------------------------
// Fingerprinting
// ---------------------------------------------------------------------------

export function computeFingerprint(fields: {
  date: string;
  amount: number;
  direction: "credit" | "debit";
  reference?: string | null;
  rawDescription: string;
}): string {
  // If we have a reference (UTR, txn ID), use it as the primary fingerprint
  // component — it's the most reliable dedup signal.
  const key = fields.reference
    ? `ref:${fields.reference}`
    : `desc:${fields.date}|${fields.amount.toFixed(2)}|${fields.direction}|${fields.rawDescription.trim().toLowerCase()}`;

  return createHash("sha256").update(key).digest("hex").slice(0, 32);
}

// ---------------------------------------------------------------------------
// Payee normalization
// ---------------------------------------------------------------------------

const NOISE_WORDS = [
  "upi", "neft", "imps", "rtgs", "transfer", "payment", "txn", "ref",
  "credited", "debited", "by", "to", "from", "via", "for",
  "inb", "mob", "int", "ach", "ecs", "nach", "si",
];

const NOISE_RE = new RegExp(`\\b(${NOISE_WORDS.join("|")})\\b`, "gi");

export function normalizePayee(raw: string): string {
  let s = raw;
  // Remove common reference patterns: UTR numbers, transaction IDs, dates
  s = s.replace(/\b[A-Z]{4}\d{13,}\b/g, ""); // UTR pattern (e.g., SBIN123456789012345)
  s = s.replace(/\b\d{12,}\b/g, ""); // long number strings (txn IDs)
  s = s.replace(/\b\d{2}[-/]\d{2}[-/]\d{2,4}\b/g, ""); // dates
  s = s.replace(/\b[A-Za-z0-9._%+-]+@[a-z]+\b/g, ""); // UPI handles
  // Remove noise words
  s = s.replace(NOISE_RE, "");
  // Collapse whitespace and trim
  s = s.replace(/[^a-zA-Z0-9\s]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  return s || raw.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Reference extraction
// ---------------------------------------------------------------------------

/**
 * Try to pull a UTR / transaction reference from a raw description string.
 * SBI statements often embed UTR in the narration.
 */
export function extractReference(description: string): string | null {
  // UTR pattern: bank prefix (4 alpha) + 13-16 digits
  const utrMatch = description.match(/\b([A-Z]{4}\d{13,16})\b/i);
  if (utrMatch) return utrMatch[1].toUpperCase();

  // CMS reference
  const cmsMatch = description.match(/\bCMS(\d{9,})\b/i);
  if (cmsMatch) return `CMS${cmsMatch[1]}`;

  // Cheque number
  const chqMatch = description.match(/\bCH[QE]?\s*(?:NO\.?\s*)?(\d{6})\b/i);
  if (chqMatch) return `CHQ${chqMatch[1]}`;

  // Generic long number that might be a reference
  const longNum = description.match(/\b(\d{12,20})\b/);
  if (longNum) return longNum[1];

  return null;
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

export interface MatchCandidate {
  id: number;
  date: string;
  amount: number;
  direction: "credit" | "debit";
  reference: string | null;
  normalizedPayee: string | null;
}

export type MatchResult =
  | { type: "exact"; canonicalId: number; confidence: 1 }
  | { type: "strong"; canonicalId: number; confidence: number }
  | { type: "fuzzy"; canonicalId: number; confidence: number }
  | { type: "none" };

/**
 * Find the best match for a statement row among existing canonical transactions.
 */
export function findBestMatch(
  row: {
    date: string;
    amount: number;
    direction: "credit" | "debit";
    reference: string | null;
    normalizedPayee: string | null;
  },
  candidates: MatchCandidate[],
): MatchResult {
  // Tier 1: Exact reference match
  if (row.reference) {
    const exactMatch = candidates.find(
      (c) => c.reference && c.reference === row.reference
    );
    if (exactMatch) {
      return { type: "exact", canonicalId: exactMatch.id, confidence: 1 };
    }
  }

  // Filter to same direction + same amount
  const amountMatches = candidates.filter(
    (c) =>
      c.direction === row.direction &&
      Math.abs(c.amount - row.amount) < 0.01
  );

  if (amountMatches.length === 0) return { type: "none" };

  // Tier 2: Strong match — same date + similar payee
  for (const c of amountMatches) {
    if (c.date === row.date && row.normalizedPayee && c.normalizedPayee) {
      const similarity = payeeSimilarity(row.normalizedPayee, c.normalizedPayee);
      if (similarity > 0.6) {
        return { type: "strong", canonicalId: c.id, confidence: 0.8 + similarity * 0.2 };
      }
    }
  }

  // Tier 3: Fuzzy — same date + same amount (no payee match needed)
  for (const c of amountMatches) {
    if (c.date === row.date) {
      return { type: "fuzzy", canonicalId: c.id, confidence: 0.5 };
    }
  }

  // Tier 3b: Fuzzy — within 1 day window + same amount
  const rowDate = new Date(row.date);
  for (const c of amountMatches) {
    const cDate = new Date(c.date);
    const dayDiff = Math.abs(rowDate.getTime() - cDate.getTime()) / (1000 * 60 * 60 * 24);
    if (dayDiff <= 1) {
      return { type: "fuzzy", canonicalId: c.id, confidence: 0.3 };
    }
  }

  return { type: "none" };
}

// ---------------------------------------------------------------------------
// String similarity (simple token overlap)
// ---------------------------------------------------------------------------

function payeeSimilarity(a: string, b: string): number {
  const tokensA = new Set(a.split(/\s+/).filter(Boolean));
  const tokensB = new Set(b.split(/\s+/).filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let overlap = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) overlap++;
  }
  return (2 * overlap) / (tokensA.size + tokensB.size);
}
