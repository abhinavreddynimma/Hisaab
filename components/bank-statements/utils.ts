export function extractTitle(desc: string): string {
  const clean = desc.replace(/\n/g, " ").trim();
  // NEFT credit: extract sender name
  const neftMatch = clean.match(/NEFT\*[^*]+\*[^*]+\*([^*]+)\*/);
  if (neftMatch) return neftMatch[1].trim();
  // UPI: extract payee name
  const upiMatch = clean.match(/UPI\/DR\/\d+\/([^/]+)\//);
  if (upiMatch) return upiMatch[1].trim();
  // IMPS: extract recipient name
  const impsMatch = clean.match(/IMPS\/\d+\/[^-]+-\w+-([^/]+)\//);
  if (impsMatch) return impsMatch[1].trim();
  // SBI internal transfer: extract recipient
  const sbiMatch = clean.match(/Transfer to (.+?) \d/);
  if (sbiMatch) return sbiMatch[1].trim();
  // ACH debit: extract description
  const achMatch = clean.match(/ACHDr\s+\S+\s+\d+\s+(.+)/);
  if (achMatch) return achMatch[1].trim();
  // Fallback: first meaningful chunk
  const parts = clean.replace(/^(DEP TFR|WDL TFR|DEBIT)\s+/, "").split(/\s{2,}/);
  return parts[0].substring(0, 60);
}
