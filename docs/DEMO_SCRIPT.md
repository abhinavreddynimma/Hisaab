# Hisaab — Demo Script

A step-by-step walkthrough for demoing all features of Hisaab. This script covers a complete tour of the app using the seeded demo data (a Bangalore-based freelancer billing a Paris-based client for frontend development work).

## Prerequisites

```bash
npm run seed:demo   # Populate with demo data
npm run dev         # Start the dev server
```

Open http://localhost:3000/hisaab

---

## 1. Dashboard (2-3 min)

**Navigate to:** Dashboard (sidebar)

### What to show:

**Earnings Cards (top)**
- **Total Earnings**: ~₹30.5L — cumulative INR received across all paid invoices
- **This Month**: ₹3.37L — current month's paid invoice amount
- **Next Month (Est.)**: ₹2.63L — projected earnings based on estimated working days and current exchange rate

**Calendar Overview (middle)**
- Shows 5 months at a glance (Nov 2025 – Mar 2026)
- Color-coded days: green (working), red (leave), cyan (holiday), amber (half-day), purple (extra working), grey (weekend)
- Navigate left/right to see earlier months
- Point out how holidays (French public holidays), leaves, and extra Saturday work are all visible

**Leave Balance Cards**
- **Leave Balance**: -2.5 (leaves taken exceed accrued)
- **Extra Working Days**: +7 (Saturdays worked)
- **Extra Balance**: +4.5 (net after accounting for extra days)
- Explain the formula: accrued (1.5/month × 11 months = 16.5) - taken (19) = -2.5

**Scroll down to show:**

**Monthly Breakdown Chart**
- Stacked bar chart showing working days, extra days, half days, and leaves per month
- Hover over bars to see exact counts

**Monthly Earnings Chart**
- Bar chart of INR earnings per month with an average line
- Shows seasonal variation (higher in Sept-Oct, lower in Jul due to summer leaves)

**Client Breakdown**
- Pie chart showing revenue by client (100% to TechVision SAS in demo data)

**Recent Invoices**
- Quick list of latest invoices with status badges

**Exchange Rate Chart**
- Historical EUR→INR rates showing the upward trend from ₹96 to ₹105

---

## 2. Calendar (2 min)

**Navigate to:** Calendar (sidebar)

### What to show:

**Current Month View (Feb 2026)**
- Grid layout with day-type indicators (colored dots)
- Blue dots = working days, red = leave (Feb 6), purple = extra working (Feb 7)
- Today is highlighted with a circle

**Monthly Summary (bottom)**
- Working Days: 19, Leaves: 1, Holidays: 0, Half Days: 0, Extra Working: 1
- Effective Days: 20, Leave Balance: -2.5

**Click on a day** to show the Day Entry dialog:
- Day type selector (Working, Leave, Holiday, Half Day, Extra Working)
- Project assignment dropdown
- Notes field

**Navigate to previous months** to show:
- **December 2025**: Christmas break leaves (22, 23, 26), half day (19)
- **July 2025**: Summer leaves (7, 21, 28), half days (11, 25)
- **October 2025**: Extra working Saturday (18), Halloween half day (31)

---

## 3. Clients (1-2 min)

**Navigate to:** Clients (sidebar)

### What to show:

**Client List**
- Pierre Martin / TechVision SAS — Active, EUR currency
- "Add Client" button in top-right

**Click on Pierre Martin** to show Client Detail:
- Contact info (email, phone, address in Paris)
- Currency badge (EUR)
- Edit and Deactivate buttons

**Projects Section**
- "Frontend Development" project at €130.00/day — Active
- "Add Project" button
- Explain that daily rates can be overridden per month

---

## 4. Invoices (3 min)

**Navigate to:** Invoices (sidebar)

### What to show:

**Invoice List**
- 10 invoices (HSB-01 through HSB-10), all Paid
- Status filter tabs: All (10), Draft (0), Sent (0), Paid (10), Cancelled (0)
- Total at bottom: €30,219.80
- Sorted by most recent first

**Click on HSB-01** to show Invoice Detail:
- **Header**: Invoice number, status badge (Paid), Back to List and Print buttons
- **Invoice Preview**:
  - Issue Date: 01 May 2025, Due Date: 15 May 2025
  - Period: 01 Apr 2025 – 30 Apr 2025
  - FROM: Rahul Sharma with full address, GSTIN, PAN, email, phone
  - TO: Pierre Martin / TechVision SAS with address
  - Line item: "19 working days - Frontend Development @ €130/day"
  - HSN/SAC: 998314 (management consulting)
  - Subtotal: €2,470.00, IGST (0%): €0.00, Total: €2,914.60
  - Amount in words
  - LUT note for export without IGST
  - Bank details (SEPA transfer info)

**Scroll down** to show Payment Details:
- Paid date, EUR→INR exchange rate (96.05)
- Platform charges, bank charges
- Gross INR and Net INR realized

**Show the "New Invoice" button** — explain auto-population from calendar

---

## 5. Tax Tracking (2 min)

**Navigate to:** Tax (sidebar)

### What to show:

**Header**
- "Advance Tax — FY 2025-26 · Section 44ADA (New Regime)"
- Navigate between financial years with arrows
- Print button and "Add Payment" button

**Overview Tab — Tax Computation**
- Gross Receipts (INR received): ₹30,58,993.16
- Presumptive Income (50% u/s 44ADA): ₹15,29,496.58
- Taxable Income: ₹15,29,496.58
- Slab-wise breakdown:
  - ₹0-4L: 0%
  - ₹4L-8L: 5% → ₹20,000
  - ₹8L-12L: 10% → ₹40,000
  - ₹12L-16L: 15% → ₹49,424.49
- Income Tax: ₹1,09,424.49
- Health & Education Cess (4%): ₹4,376.98
- Total Tax Liability: ₹1,13,801.47 (3.7% effective rate)
- Advance Tax Paid: -₹80,000
- **Balance Payable: ₹33,801.47**

**Quarterly Cards (bottom)**
- Q1 (Apr-Jun): ₹25,000 — Due June 15
- Q2 (Jul-Sep): ₹25,000 — Due Sept 15
- Q3 (Oct-Dec): ₹30,000 — Due Dec 15
- Q4 (Jan-Mar): No payment yet — Due March 15

**Switch to Projection tab:**
- Monthly breakdown of actual vs projected earnings
- Estimated remaining working days and projected total
- Full-year tax projection

---

## 6. Settings (1-2 min)

**Navigate to:** Settings (sidebar)

### What to show:

**Profile Tab**
- Personal info: Rahul Sharma, Bangalore
- Contact: email, phone
- Address: full Indian address
- GSTIN and PAN fields
- Scroll down: Indian bank details (SBI), SEPA transfer details (BNP Paribas), SWIFT details

**Leave Policy Tab**
- Leaves accrued per month: 1.5
- Standard working days: 22
- Tracking start date: April 2025

**Invoice Settings Tab**
- Prefix: HSB
- Next number: 11
- Default HSN/SAC: 998314
- Default tax rate: 18%
- Tax type: IGST

---

## 7. Dark Mode (30 sec)

**Click the sun/moon icon** in the top-right header to toggle dark mode.

- Show that all pages adapt to the dark theme
- Navigate briefly to Dashboard to show charts in dark mode
- Toggle back to light mode

---

## Key Talking Points

1. **Self-hosted & private** — SQLite database, no cloud dependency, your financial data stays on your machine
2. **Built for Indian freelancers** — GSTIN, PAN, Section 44ADA, advance tax quarters, INR conversion
3. **Multi-currency** — Bill in EUR, USD, GBP, etc. with automatic exchange rate tracking
4. **End-to-end workflow** — From tracking daily work → generating invoices → recording payments → computing taxes
5. **Smart automation** — Invoice line items auto-populated from calendar, tax computed automatically from paid invoices
6. **Professional invoices** — Print-ready layout with SEPA/SWIFT bank details, HSN/SAC codes, LUT compliance
7. **Modern stack** — Next.js 16, TypeScript, Tailwind, Shadcn/ui, fully responsive
