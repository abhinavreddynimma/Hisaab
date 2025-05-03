# Hisaab Demo Script

Use this flow for consistent demos and docs refresh.

**Important:** Start the server with the demo database before capturing screenshots:

```bash
npm run dev:demo
```

## 1. Dashboard
- Open `/hisaab/dashboard`
- Confirm cards, recent invoices, and exchange-rate trends are visible
- Screenshot: `docs/screenshots/dashboard.png`
- Screenshot: `docs/screenshots/dashboard-charts.png`

## 2. Calendar
- Open `/hisaab/calendar`
- Show month view and summary
- Open any day to show the **Day Entry** dialog
- Screenshot: `docs/screenshots/calendar.png`
- Screenshot: `docs/screenshots/calendar-day-entry.png`

## 3. Clients
- Open `/hisaab/clients`
- Open the first client details page
- Screenshot: `docs/screenshots/clients.png`
- Screenshot: `docs/screenshots/client-detail.png`

## 4. Invoices
- Open `/hisaab/invoices`
- Open a paid invoice
- Show invoice preview with SEPA/SWIFT payment details
- Show **Payment Details** section
- Show **Attachments** section with files like FIRA/bank statement if present
- Screenshot: `docs/screenshots/invoices.png`
- Screenshot: `docs/screenshots/invoice-detail.png`
- Screenshot: `docs/screenshots/invoice-payment.png`
- Screenshot: `docs/screenshots/invoice-attachments.png`
- Screenshot: `docs/screenshots/invoice-create.png`

## 5. Tax
- Open `/hisaab/tax`
- Show **Overview** tab
- Switch to **Projection** tab
- Screenshot: `docs/screenshots/tax.png`
- Screenshot: `docs/screenshots/tax-projection.png`

## 6. Settings
- Open `/hisaab/settings`
- Show Profile tab with bank detail sections
- Switch to Leave Policy tab
- Switch to Invoice Settings tab
- Screenshot: `docs/screenshots/settings.png`
- Screenshot: `docs/screenshots/settings-bank.png`
- Screenshot: `docs/screenshots/settings-leave-policy.png`
- Screenshot: `docs/screenshots/settings-invoice.png`

## Refresh Command

```bash
npm run docs:refresh
```
