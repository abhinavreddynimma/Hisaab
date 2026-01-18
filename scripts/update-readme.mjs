import { existsSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const readmePath = path.join(rootDir, "README.md");
const demoScriptPath = path.join(rootDir, "docs", "DEMO_SCRIPT.md");
const screenshotsDir = path.join(rootDir, "docs", "screenshots");

const features = [
  "Dashboard - Earnings, balances, recent invoices, and live exchange-rate trends",
  "Client & Project Management - Per-client projects, status toggles, and currency-aware daily rates",
  "Calendar & Day Entries - Working days, leaves, holidays, and per-day notes/project mapping",
  "Invoice Creation - Auto-populate line items from calendar entries with LUT export note",
  "Invoice Detail & Export - Printable invoice view with tax summary and SEPA/SWIFT payment snapshots",
  "Payment Reconciliation - Paid date, FX conversion, platform/bank charges, and net INR realized",
  "Invoice Attachments - Upload and manage proof documents like FIRA and bank statements after payment",
  "Tax Tracking - Advance-tax computation, quarterly payments, and projection tab",
  "Settings - Profile, domestic bank details, SEPA/SWIFT transfer details, leave policy, and invoice settings",
  "Access Control - Admin setup, viewer accounts with tags, and session-based authentication",
];

const screenshots = [
  {
    title: "Login",
    file: "login.png",
    description: "Your data stays yours. One-click sign-in keeps freelancers in and strangers out.",
  },
  {
    title: "Dashboard",
    file: "dashboard.png",
    description: "Everything you earned this year, last month, and today — in one glance. No spreadsheet gymnastics required.",
  },
  {
    title: "Dashboard Charts",
    file: "dashboard-charts.png",
    description: "Watch your income trend upward and exchange rates in real time. The graphs your accountant wishes you had.",
  },
  {
    title: "Calendar",
    file: "calendar.png",
    description: "Color-coded work days, leaves, holidays, and overtime — your entire month mapped out like a visual timesheet.",
  },
  {
    title: "Calendar Day Entry",
    file: "calendar-day-entry.png",
    description: "Click any day to log work, mark leave, or add notes. Time tracking that takes 2 seconds, not 20 minutes.",
  },
  {
    title: "Calendar Snapshot",
    file: "calendar-snapshot.png",
    description: "One-click monthly summary: working days, leaves, overtime, and balance. Perfect for client reports.",
  },
  {
    title: "Client Management",
    file: "clients.png",
    description: "All your clients at a glance — active, inactive, multi-currency. Manage a global roster from one place.",
  },
  {
    title: "Client Detail",
    file: "client-detail.png",
    description: "Deep-dive into any client: projects, rates, invoices, and contact info. Everything your next invoice needs.",
  },
  {
    title: "Add Project",
    file: "client-add-project.png",
    description: "Spin up a new project with a daily rate in seconds. Because freelancers juggle more than one gig at a time.",
  },
  {
    title: "New Client Form",
    file: "client-new.png",
    description: "Onboard a client in under a minute — name, company, address, currency. Ready to invoice on day one.",
  },
  {
    title: "Invoices",
    file: "invoices.png",
    description: "Paid, sent, cancelled — every invoice across every client, filterable and sorted. Never chase a payment blind.",
  },
  {
    title: "Mark as Paid",
    file: "invoice-mark-paid.png",
    description: "Record FX rate, platform fees, and bank charges when marking paid. Know exactly how much hit your account.",
  },
  {
    title: "Invoice Detail",
    file: "invoice-detail.png",
    description: "A print-ready invoice with line items, tax breakdown, and SEPA/SWIFT payment details baked in.",
  },
  {
    title: "Invoice Payment Details",
    file: "invoice-payment.png",
    description: "FX conversion, platform charges, bank fees — see the full money trail from client payment to your bank.",
  },
  {
    title: "Invoice Attachments",
    file: "invoice-attachments.png",
    description: "Attach FIRA certificates, bank statements, or any proof doc right on the invoice. Audit-ready in one click.",
  },
  {
    title: "Invoice Create Form",
    file: "invoice-create.png",
    description: "Auto-populated from your calendar — just pick the month and client. Your invoice writes itself.",
  },
  {
    title: "Tax Overview",
    file: "tax.png",
    description: "Advance tax paid, quarterly breakdown, and remaining liability. File day stops being a surprise.",
  },
  {
    title: "Tax Projection",
    file: "tax-projection.png",
    description: "See what you'll owe before the quarter ends. Plan ahead so tax season is a non-event.",
  },
  {
    title: "Tax Payment",
    file: "tax-payment.png",
    description: "Log each challan with amount, date, and reference number. Your tax paper trail, digitized.",
  },
  {
    title: "Settings",
    file: "settings.png",
    description: "Your profile, GSTIN, PAN, and domestic bank details — the foundation every invoice is built on.",
  },
  {
    title: "Settings - Leave Policy",
    file: "settings-leave-policy.png",
    description: "Set leaves per month and tracking start date. The app does the math — you just take the day off.",
  },
  {
    title: "Settings - Invoice Settings",
    file: "settings-invoice.png",
    description: "Invoice prefix, auto-numbering, default HSN/SAC, and tax type. Configure once, invoice forever.",
  },
  {
    title: "Settings - Access Control",
    file: "settings-access.png",
    description: "Add your accountant, CA, or lawyer as read-only viewers with tags. Share access without sharing your password.",
  },
];

const featureMarkdown = features.map((item) => `- ${item}`).join("\n");
const screenshotMarkdown = screenshots
  .map(({ title, file, description }) =>
    `### ${title}\n${description}\n\n![${title}](docs/screenshots/${file})`
  )
  .join("\n\n");

const readmeContent = `# Hisaab

A freelancer payroll management app for tracking income, clients, work days, invoices, payments, attachments, and tax obligations.

## Features

${featureMarkdown}

## Screenshots

${screenshotMarkdown}

## Demo Flow

Use \`docs/DEMO_SCRIPT.md\` as the walkthrough checklist for demos and screenshot capture order.

## Documentation Automation

- Regenerate screenshots, sync README, and run checks:
  \`\`\`bash
  npm run docs:refresh
  \`\`\`
- Only regenerate screenshots:
  \`\`\`bash
  npm run docs:screenshots
  \`\`\`
- Only sync and validate README:
  \`\`\`bash
  npm run docs:readme
  \`\`\`

## Tech Stack

- Framework: Next.js 16 (App Router, Server Actions, Turbopack)
- Language: TypeScript
- Database: SQLite with Drizzle ORM
- UI: Tailwind CSS, shadcn/ui, Radix UI
- Charts: Recharts
- Automation: Playwright

## Setup

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`
2. Initialize the database:
   \`\`\`bash
   npm run db:push
   \`\`\`
3. Start the app:
   \`\`\`bash
   npm run dev
   \`\`\`
4. Open \`http://localhost:3000/hisaab\`.

## Production Build

\`\`\`bash
npm run build
npm start
\`\`\`

## Self-Hosting with Docker

Host Hisaab on your home server (tested on Beelink Mini S13) so it runs 24/7 and is accessible to your accountant, CA, or anyone on your network.

### Prerequisites

- [Docker](https://docs.docker.com/engine/install/) and [Docker Compose](https://docs.docker.com/compose/install/) installed on your server
- Git (to clone the repo)

### Quick Start

\`\`\`bash
# Clone the repo
git clone https://github.com/your-username/hisaab.git
cd hisaab

# Build and start (runs in background, restarts automatically)
docker compose up -d --build
\`\`\`

Hisaab is now running at **http://your-server-ip:3000**

### Configuration

Create a \`.env\` file to customize settings (all optional):

\`\`\`env
# Port to expose on the host (default: 3000)
PORT=3000

# Where to store database and attachments on the host (default: ./data)
DATA_LOCATION=./data
\`\`\`

### Commands Reference

\`\`\`bash
# Start the app (build + run in background)
docker compose up -d --build

# View logs
docker compose logs -f

# Stop the app
docker compose down

# Restart the app
docker compose restart

# Rebuild after pulling new changes
git pull
docker compose up -d --build

# Check health status
docker inspect --format='{{.State.Health.Status}}' hisaab

# Back up your data (database + attachments)
cp -r ./data ./data-backup-$(date +%Y%m%d)
\`\`\`

### Data & Backups

All your data lives in one directory (\`./data\` by default):
- \`payroll.db\` — SQLite database (clients, invoices, settings, etc.)
- \`attachments/\` — uploaded invoice attachments

To back up, just copy this directory. To migrate to a new server, copy \`./data\` to the new machine and run \`docker compose up -d --build\`.

### Accessing from Other Devices

Once running, Hisaab is accessible to anyone on your local network at \`http://<server-ip>:3000\`.

To share with people outside your network (your CA, accountant, etc.), you have a few options:

1. **Tailscale / ZeroTier** (recommended) — Create a private network. Install the client on your server and their devices. No port forwarding needed, fully encrypted.
2. **Cloudflare Tunnel** — Expose your server to the internet securely without opening ports. Free tier available.
3. **Reverse proxy + port forwarding** — Use Nginx or Caddy as a reverse proxy with a domain name and Let's Encrypt SSL. Forward port 443 on your router to the server.

### Updating

\`\`\`bash
cd hisaab
git pull
docker compose up -d --build
\`\`\`

The database schema auto-migrates on startup, so updates are safe.
`;

writeFileSync(readmePath, readmeContent, "utf8");
console.log("Updated README.md");

if (!existsSync(demoScriptPath)) {
  console.warn("Warning: docs/DEMO_SCRIPT.md is missing.");
}

const missingScreenshots = screenshots
  .map((item) => item.file)
  .filter((file) => !existsSync(path.join(screenshotsDir, file)));

if (missingScreenshots.length > 0) {
  console.error("\nMissing screenshots:");
  for (const file of missingScreenshots) {
    console.error(`- docs/screenshots/${file}`);
  }
  process.exitCode = 1;
} else {
  console.log("All required screenshots are present.");
}

const requiredFeatureChecks = [
  "Invoice Attachments - Upload and manage proof documents like FIRA and bank statements after payment",
  "Payment Reconciliation - Paid date, FX conversion, platform/bank charges, and net INR realized",
  "Tax Tracking - Advance-tax computation, quarterly payments, and projection tab",
  "Settings - Profile, domestic bank details, SEPA/SWIFT transfer details, leave policy, and invoice settings",
  "Access Control - Admin setup, viewer accounts with tags, and session-based authentication",
];

const missingFeatureMentions = requiredFeatureChecks.filter(
  (line) => !readmeContent.includes(line)
);

if (missingFeatureMentions.length > 0) {
  console.error("\nREADME feature coverage check failed:");
  for (const line of missingFeatureMentions) {
    console.error(`- ${line}`);
  }
  process.exitCode = 1;
} else {
  console.log("Feature coverage checks passed.");
}
