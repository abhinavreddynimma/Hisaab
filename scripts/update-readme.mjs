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
];

const screenshots = [
  { title: "Dashboard", file: "dashboard.png" },
  { title: "Dashboard Charts", file: "dashboard-charts.png" },
  { title: "Calendar", file: "calendar.png" },
  { title: "Calendar Day Entry", file: "calendar-day-entry.png" },
  { title: "Calendar Snapshot", file: "calendar-snapshot.png" },
  { title: "Client Management", file: "clients.png" },
  { title: "Client Detail", file: "client-detail.png" },
  { title: "Add Project", file: "client-add-project.png" },
  { title: "New Client Form", file: "client-new.png" },
  { title: "Invoices", file: "invoices.png" },
  { title: "Invoice Detail", file: "invoice-detail.png" },
  { title: "Invoice Payment Details", file: "invoice-payment.png" },
  { title: "Invoice Attachments (FIRA / Bank Statement)", file: "invoice-attachments.png" },
  { title: "Invoice Create Form", file: "invoice-create.png" },
  { title: "Tax Overview", file: "tax.png" },
  { title: "Tax Projection", file: "tax-projection.png" },
  { title: "Tax Payment", file: "tax-payment.png" },
  { title: "Settings Overview", file: "settings.png" },
  { title: "Settings - Bank Details", file: "settings-bank.png" },
  { title: "Settings - Leave Policy", file: "settings-leave-policy.png" },
  { title: "Settings - Invoice Settings", file: "settings-invoice.png" },
];

const featureMarkdown = features.map((item) => `- ${item}`).join("\n");
const screenshotMarkdown = screenshots
  .map(({ title, file }) => `### ${title}\n![${title}](docs/screenshots/${file})`)
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
