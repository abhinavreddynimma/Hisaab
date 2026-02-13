export const DAY_TYPES = {
  working: { label: "Working", color: "bg-blue-500", textColor: "text-blue-700", bgLight: "bg-blue-50 dark:bg-blue-950" },
  leave: { label: "Leave", color: "bg-red-500", textColor: "text-red-700", bgLight: "bg-red-50 dark:bg-red-950" },
  holiday: { label: "Holiday", color: "bg-green-500", textColor: "text-green-700", bgLight: "bg-green-50 dark:bg-green-950" },
  half_day: { label: "Half Day", color: "bg-sky-500", textColor: "text-sky-700", bgLight: "bg-sky-50 dark:bg-sky-950" },
  extra_working: { label: "Extra Working", color: "bg-purple-500", textColor: "text-purple-700", bgLight: "bg-purple-50 dark:bg-purple-950" },
  weekend: { label: "Weekend", color: "bg-gray-400", textColor: "text-gray-500", bgLight: "bg-gray-50 dark:bg-gray-900" },
} as const;

export type DayType = keyof typeof DAY_TYPES;

export const TAX_QUARTERS = {
  Q1: { label: "Q1 (Apr–Jun)", dueDate: "June 15", cumPercent: 15 },
  Q2: { label: "Q2 (Jul–Sep)", dueDate: "Sept 15", cumPercent: 45 },
  Q3: { label: "Q3 (Oct–Dec)", dueDate: "Dec 15", cumPercent: 75 },
  Q4: { label: "Q4 (Jan–Mar)", dueDate: "March 15", cumPercent: 100 },
} as const;

export function getCurrentFinancialYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (month >= 4) return `${year}-${String(year + 1).slice(2)}`;
  return `${year - 1}-${String(year).slice(2)}`;
}

export const INVOICE_STATUSES = {
  draft: { label: "Draft", variant: "secondary" as const, className: "bg-gradient-to-r from-slate-100 to-gray-200 text-slate-600 border-slate-200/60 dark:from-slate-800 dark:to-gray-700 dark:text-slate-300 dark:border-slate-600" },
  sent: { label: "Sent", variant: "default" as const, className: "bg-gradient-to-r from-blue-100 to-indigo-200 text-blue-700 border-blue-200/60 dark:from-blue-900 dark:to-indigo-800 dark:text-blue-300 dark:border-blue-700" },
  paid: { label: "Paid", variant: "outline" as const, className: "bg-gradient-to-r from-emerald-100 to-green-200 text-emerald-700 border-emerald-200/60 dark:from-emerald-900 dark:to-green-800 dark:text-emerald-300 dark:border-emerald-700" },
  cancelled: { label: "Cancelled", variant: "destructive" as const, className: "bg-gradient-to-r from-red-100 to-rose-200 text-red-700 border-red-200/60 dark:from-red-900 dark:to-rose-800 dark:text-red-300 dark:border-red-700" },
} as const;

export type InvoiceStatus = keyof typeof INVOICE_STATUSES;

export const SUPPORTED_CURRENCIES = [
  { code: "EUR", symbol: "€", name: "Euro", pluralName: "Euros" },
  { code: "USD", symbol: "$", name: "US Dollar", pluralName: "US Dollars" },
  { code: "GBP", symbol: "£", name: "British Pound", pluralName: "British Pounds" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", pluralName: "Australian Dollars" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar", pluralName: "Canadian Dollars" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", pluralName: "Singapore Dollars" },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc", pluralName: "Swiss Francs" },
] as const;

export function getCurrencySymbol(code: string): string {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code)?.symbol ?? code;
}

export function getCurrencyName(code: string, plural = false): string {
  const c = SUPPORTED_CURRENCIES.find((cur) => cur.code === code);
  if (!c) return code;
  return plural ? c.pluralName : c.name;
}

export const GST_RATES = [0, 5, 12, 18, 28] as const;

export const DEFAULT_HSN_SAC = "998314"; // Management consulting services

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

// Mon-Sun layout for European-style calendars (used in snapshot)
export const WEEKDAYS_EU = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/**
 * Compute Easter Sunday for a given year using the Anonymous Gregorian algorithm.
 */
function computeEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Returns all French public holidays for a given year as "YYYY-MM-DD" strings.
 * Includes both fixed holidays and Easter-based variable holidays.
 */
export function getFrenchHolidays(year: number): Map<string, string> {
  const easter = computeEaster(year);
  const easterMonday = addDays(easter, 1);
  const ascension = addDays(easter, 39);
  const whitMonday = addDays(easter, 50);

  const holidays = new Map<string, string>();

  // Fixed holidays
  holidays.set(`${year}-01-01`, "New Year's Day");
  holidays.set(`${year}-05-01`, "Labour Day");
  holidays.set(`${year}-05-08`, "Victory in Europe Day");
  holidays.set(`${year}-07-14`, "Bastille Day");
  holidays.set(`${year}-08-15`, "Assumption of Mary");
  holidays.set(`${year}-11-01`, "All Saints' Day");
  holidays.set(`${year}-11-11`, "Armistice Day");
  holidays.set(`${year}-12-25`, "Christmas Day");

  // Variable holidays (Easter-based)
  holidays.set(formatDateStr(easterMonday), "Easter Monday");
  holidays.set(formatDateStr(ascension), "Ascension Thursday");
  holidays.set(formatDateStr(whitMonday), "Whit Monday");

  return holidays;
}
