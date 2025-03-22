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
  { title: "Client Management", file: "clients.png" },
  { title: "Client Detail", file: "client-detail.png" },
  { title: "Invoices", file: "invoices.png" },
  { title: "Invoice Detail", file: "invoice-detail.png" },
  { title: "Invoice Payment Details", file: "invoice-payment.png" },
  { title: "Invoice Attachments (FIRA / Bank Statement)", file: "invoice-attachments.png" },
  { title: "Invoice Create Form", file: "invoice-create.png" },
  { title: "Tax Overview", file: "tax.png" },
  { title: "Tax Projection", file: "tax-projection.png" },
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
