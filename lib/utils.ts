import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatEuro(amount: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(amount);
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

function convertChunk(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ONES[n];
  if (n < 100) {
    const t = TENS[Math.floor(n / 10)];
    const o = ONES[n % 10];
    return o ? `${t}-${o}` : t;
  }
  const h = `${ONES[Math.floor(n / 100)]} Hundred`;
  const rem = n % 100;
  return rem ? `${h} and ${convertChunk(rem)}` : h;
}

export function numberToWords(amount: number): string {
  const euros = Math.floor(amount);
  const cents = Math.round((amount - euros) * 100);

  const scales = ["", " Thousand", " Million", " Billion"];
  let remaining = euros;
  const parts: string[] = [];
  let scaleIndex = 0;

  if (remaining === 0) {
    parts.push("Zero");
  } else {
    while (remaining > 0) {
      const chunk = remaining % 1000;
      if (chunk > 0) {
        parts.unshift(convertChunk(chunk) + scales[scaleIndex]);
      }
      remaining = Math.floor(remaining / 1000);
      scaleIndex++;
    }
  }

  let result = parts.join(" ") + " Euro" + (euros !== 1 ? "s" : "");
  if (cents > 0) {
    result += ` and ${convertChunk(cents)} Cent${cents !== 1 ? "s" : ""}`;
  }
  return result;
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatMonthYear(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function getMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}
