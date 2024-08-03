# Hisaab Demo Script

Use this flow for consistent demos and docs refresh.

**Important:** Start the server with the demo database before capturing screenshots:

```bash
npm run seed:demo   # Seed fresh demo data
npm run dev:demo    # Start with demo database
```

**Demo credentials:** rahul@hisaab.dev / demo1234

---

## 1. Login
- Open `/hisaab/login`
- Show the login form with email and password fields
- Log in as Rahul Sharma (admin)
- Screenshot: `docs/screenshots/login.png`

## 2. Dashboard
- Open `/hisaab/dashboard`
- Confirm cards, recent invoices, and exchange-rate trends are visible
- Scroll down to show income charts and FX trends
- Screenshot: `docs/screenshots/dashboard.png`
- Screenshot: `docs/screenshots/dashboard-charts.png`

## 3. Calendar
- Open `/hisaab/calendar`
- Navigate to **August 2025** — showcase month with:
  - 2 leave days (Aug 18, 22)
  - 1 public holiday (Aug 15 — Assumption)
  - 1 extra working Saturday (Aug 9)
- Open any day to show the **Day Entry** dialog
- Click **Snapshot** to show monthly summary
- Screenshot: `docs/screenshots/calendar.png`
- Screenshot: `docs/screenshots/calendar-day-entry.png`
- Screenshot: `docs/screenshots/calendar-snapshot.png`

## 4. Clients
- Open `/hisaab/clients`
- Show 2 active clients (Pierre Martin — EUR, Sarah Johnson — USD) and 2 inactive
- Open Pierre Martin's detail page, show projects and invoices
- Click **Add Project** to show the dialog
- Navigate to `/hisaab/clients/new` to show the new client form
- Screenshot: `docs/screenshots/clients.png`
- Screenshot: `docs/screenshots/client-detail.png`
- Screenshot: `docs/screenshots/client-add-project.png`
- Screenshot: `docs/screenshots/client-new.png`

## 5. Invoices
- Open `/hisaab/invoices`
- Show the full list: paid, sent, cancelled statuses across multiple clients
- Find the "sent" invoice (HSB-18) and use the menu to open **Mark as Paid** dialog
- Open a paid invoice to show the detail view with line items and SEPA/SWIFT info
- Scroll to **Payment Details** section (FX rate, platform charges, bank charges)
- Show **Attachments** section with files like FIRA/bank statement if present
- Navigate to `/hisaab/invoices/new` to show the create form
- Screenshot: `docs/screenshots/invoices.png`
- Screenshot: `docs/screenshots/invoice-mark-paid.png`
- Screenshot: `docs/screenshots/invoice-detail.png`
- Screenshot: `docs/screenshots/invoice-payment.png`
- Screenshot: `docs/screenshots/invoice-attachments.png`
- Screenshot: `docs/screenshots/invoice-create.png`

## 6. Tax
- Open `/hisaab/tax`
- Show **Overview** tab with quarterly payments (Q1–Q3 for FY 2025-26)
- Switch to **Projection** tab
- Click **Add Payment** to show the payment dialog
- Screenshot: `docs/screenshots/tax.png`
- Screenshot: `docs/screenshots/tax-projection.png`
- Screenshot: `docs/screenshots/tax-payment.png`

## 7. Settings
- Open `/hisaab/settings`
- Show Profile tab with personal info, GSTIN/PAN, domestic bank, and SEPA/SWIFT details
- Switch to **Leave Policy** tab — show -4.5 balance and 8 extra working days
- Switch to **Invoice Settings** tab — show prefix, HSN/SAC, tax type
- Switch to **Access** tab — show admin user, active viewer (Priya Patel, accountant), and disabled viewer (Amit Kumar, lawyer)
- Screenshot: `docs/screenshots/settings.png`
- Screenshot: `docs/screenshots/settings-leave-policy.png`
- Screenshot: `docs/screenshots/settings-invoice.png`
- Screenshot: `docs/screenshots/settings-access.png`

---

## Feature Coverage Checklist

| Feature | Screenshots |
|---------|------------|
| Login / Authentication | `login.png` |
| Dashboard (earnings, balances, charts) | `dashboard.png`, `dashboard-charts.png` |
| Calendar (day entries, snapshot) | `calendar.png`, `calendar-day-entry.png`, `calendar-snapshot.png` |
| Client & Project Management | `clients.png`, `client-detail.png`, `client-add-project.png`, `client-new.png` |
| Invoice List (paid/sent/cancelled) | `invoices.png` |
| Mark as Paid (FX, fees) | `invoice-mark-paid.png` |
| Invoice Detail & Export | `invoice-detail.png` |
| Payment Reconciliation | `invoice-payment.png` |
| Invoice Attachments (FIRA) | `invoice-attachments.png` |
| Invoice Creation | `invoice-create.png` |
| Tax Tracking & Projection | `tax.png`, `tax-projection.png`, `tax-payment.png` |
| Settings (Profile, Bank, SEPA/SWIFT) | `settings.png` |
| Leave Policy | `settings-leave-policy.png` |
| Invoice Settings | `settings-invoice.png` |
| Access Control (Users, Tags) | `settings-access.png` |

## Refresh Command

```bash
npm run docs:refresh
```
