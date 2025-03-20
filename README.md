# Hisaab

A freelancer payroll management app for tracking income, clients, invoices, work days, and tax obligations. Built for India-based freelancers billing international clients.

Built with Next.js, SQLite, and Drizzle ORM.

## Screenshots

### Dashboard
At-a-glance summary of total earnings (INR), current month revenue, and next month projections. A multi-month calendar highlights working days, leaves, holidays, and extra days. Leave balance cards show accrued vs. taken leaves and extra working days.

![Dashboard](docs/screenshots/dashboard.png)

### Calendar
Full monthly calendar view for tracking each day — mark days as working, leave, holiday, half-day, or extra working. Bottom summary shows totals for the month along with leave balance.

![Calendar](docs/screenshots/calendar.png)

### Clients
Manage client profiles with company details, contact info, currency, and active/inactive status.

![Clients](docs/screenshots/clients.png)

### Client Detail
View client details, associated projects with daily rates, and quickly add new projects.

![Client Detail](docs/screenshots/client-detail.png)

### Invoices
List of all invoices with filtering by status (Draft, Sent, Paid, Cancelled). Shows invoice number, client, billing period, amount, paid date, and status at a glance.

![Invoices](docs/screenshots/invoices.png)

### Invoice Detail
Professional invoice preview with from/to details, GSTIN/PAN, line items with HSN/SAC codes, tax calculations (CGST/SGST/IGST), total in words, and bank/SEPA/SWIFT payment details. Print and PDF export supported.

![Invoice Detail](docs/screenshots/invoice-detail.png)

### Tax Tracking
Automatic tax computation under Section 44ADA (presumptive income at 50%). Shows slab-wise breakdown, cess, total liability, advance tax payments by quarter, and balance payable. Includes a projection tab for estimating full-year tax.

![Tax](docs/screenshots/tax.png)

### Settings
Configure your profile (name, address, GSTIN, PAN), bank details (Indian bank, SEPA, SWIFT), leave policy (accrual rate, standard working days), and invoice settings (prefix, numbering, default HSN/SAC, tax type).

![Settings](docs/screenshots/settings.png)

## Features

- **Dashboard** — Earnings summary, multi-month calendar overview, leave balance, monthly breakdown charts (working days, earnings), client revenue pie chart, recent invoices, and EUR-INR exchange rate history
- **Client Management** — Create and manage clients with full address, currency (EUR, USD, GBP, AUD, CAD, SGD, CHF), and multiple projects per client with configurable daily rates
- **Calendar** — Track working days, leaves, holidays, half-days, and extra working days with per-day project assignment and notes
- **Invoices** — Auto-generate line items from calendar entries, tax calculations (CGST/SGST for domestic, IGST for exports under LUT), professional preview layout, PDF export, and payment recording with exchange rate conversion
- **Tax Tracking** — Automatic computation under Section 44ADA with slab-wise breakdown, quarterly advance tax tracking (Indian FY Apr-Mar), and full-year projections
- **Settings** — User profile with GSTIN/PAN, Indian bank + SEPA + SWIFT transfer details, configurable leave policy, and invoice numbering preferences
- **Light/Dark Mode** — Full theme support with toggle

## Tech Stack

- **Framework:** Next.js 16 (App Router, Server Actions, Turbopack)
- **Language:** TypeScript
- **Database:** SQLite with Drizzle ORM
- **UI:** Tailwind CSS, Shadcn/ui, Radix UI
- **Charts:** Recharts

## Prerequisites

- Node.js 18+
- npm

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Initialize the database**

   ```bash
   npm run db:push
   ```

   This creates the SQLite database at `data/payroll.db`.

3. **Start the dev server**

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000/hisaab](http://localhost:3000/hisaab)

## Demo Data

To populate the app with realistic demo data (a full financial year of invoices, calendar entries, and tax payments):

```bash
npm run seed:demo
```

## Production Build

```bash
npm run build
npm start
```
