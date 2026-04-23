export function extractTitle(description: string) {
  const normalized = description.replace(/\s+/g, " ").trim();

  return normalized
    .replace(/^Paid to\s+/i, "")
    .replace(/^Received from\s+/i, "")
    .replace(/^DEBIT ACHDr\s+/i, "")
    .replace(/^WDL TFR\s+/i, "")
    .replace(/^DEP TFR\s+/i, "")
    .trim();
}
