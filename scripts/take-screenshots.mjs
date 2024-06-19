import { chromium } from "playwright";
import Database from "better-sqlite3";
import { existsSync, mkdirSync, rmSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, "..");
const SCREENSHOTS_DIR = path.join(ROOT_DIR, "docs", "screenshots");
const DB_PATH = path.join(ROOT_DIR, "data", "payroll.db");
const BASE_URL = (process.env.APP_URL || "http://localhost:3003/hisaab").replace(/\/$/, "");

function getRecordIds() {
  const defaults = {
    clientId: 1,
    invoiceId: 1,
    paidInvoiceId: 1,
    attachmentInvoiceId: 1,
    sessionsEnabled: false,
  };

  if (!existsSync(DB_PATH)) {
    return defaults;
  }

  try {
    const db = new Database(DB_PATH, { readonly: true });
    const client = db.prepare("SELECT id FROM clients ORDER BY id LIMIT 1").get();
    const invoice = db.prepare("SELECT id FROM invoices ORDER BY id DESC LIMIT 1").get();
    const paid = db.prepare("SELECT id FROM invoices WHERE status = 'paid' ORDER BY id DESC LIMIT 1").get();
    const unpaid = db.prepare("SELECT id FROM invoices WHERE status != 'paid' AND status != 'cancelled' ORDER BY id DESC LIMIT 1").get();
    const withAttachments = db
      .prepare(`
        SELECT i.id
        FROM invoices i
        WHERE i.status = 'paid'
          AND EXISTS (
            SELECT 1
            FROM invoice_attachments a
            WHERE a.invoice_id = i.id
          )
        ORDER BY i.id DESC
        LIMIT 1
      `)
      .get();

    // Check if sessions are enabled
    let sessionsEnabled = false;
    const accessRow = db.prepare("SELECT value FROM settings WHERE key = 'access_control'").get();
    if (accessRow) {
      try {
        const config = JSON.parse(accessRow.value);
        sessionsEnabled = config.sessionsEnabled === true;
      } catch {}
    }

    db.close();

    return {
      clientId: client?.id ?? defaults.clientId,
      invoiceId: invoice?.id ?? defaults.invoiceId,
      paidInvoiceId: paid?.id ?? invoice?.id ?? defaults.paidInvoiceId,
      unpaidInvoiceId: unpaid?.id ?? invoice?.id ?? defaults.invoiceId,
      attachmentInvoiceId: withAttachments?.id ?? paid?.id ?? invoice?.id ?? defaults.attachmentInvoiceId,
      sessionsEnabled,
    };
  } catch {
    return defaults;
  }
}

async function takeScreenshots() {
  if (existsSync(SCREENSHOTS_DIR)) {
    rmSync(SCREENSHOTS_DIR, { recursive: true, force: true });
  }
  mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const { clientId, invoiceId, paidInvoiceId, unpaidInvoiceId, attachmentInvoiceId, sessionsEnabled } = getRecordIds();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
  });
  const page = await context.newPage();

  const screenshot = async (name, opts = {}) => {
    const filePath = path.join(SCREENSHOTS_DIR, `${name}.png`);
    await page.screenshot({ path: filePath, fullPage: true, ...opts });
    console.log(`  Captured: ${name}.png`);
  };

  const goto = async (route) => {
    await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(300);
  };

  const clickTab = async (name) => {
    const tab = page.getByRole("tab", { name });
    if (await tab.count()) {
      await tab.first().click();
      await page.waitForTimeout(500);
      return true;
    }

    const textTab = page.locator(`text=${name}`).first();
    if (await textTab.count()) {
      await textTab.click();
      await page.waitForTimeout(500);
      return true;
    }
    return false;
  };

  let step = 1;
  const totalSteps = 22;
  const log = (label) => console.log(`${step++}/${totalSteps} ${label}`);

  console.log("Taking screenshots...\n");

  // ── Login ──

  if (sessionsEnabled) {
    log("Login Page");
    await goto("/login");
    await screenshot("login");

    // Authenticate
    console.log("  Logging in as admin...");
    await page.fill('input[type="email"]', "rahul@hisaab.dev");
    await page.fill('input[type="password"]', "demo1234");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("**/dashboard", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);
  } else {
    step++; // skip login step
  }

  // ── Dashboard ──

  log("Dashboard");
  await goto("/dashboard");
  await screenshot("dashboard");

  log("Dashboard Charts");
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(400);
  await screenshot("dashboard-charts");

  // ── Calendar (navigate to Aug 2025 for showcase) ──

  log("Calendar");
  await goto("/calendar");
  // Navigate to August 2025 — the showcase month with 2 leaves, 1 holiday, 1 extra
  const prevBtn = page.getByRole("button", { name: /previous|chevron.*left|←/i }).or(
    page.locator("button:has(svg.lucide-chevron-left)")
  );
  // Navigate backwards from current month to Aug 2025
  for (let i = 0; i < 20; i++) {
    const heading = await page.locator("h2, h3, [role='heading']").first().textContent().catch(() => "");
    if (heading && heading.includes("August") && heading.includes("2025")) break;
    if (await prevBtn.count()) {
      await prevBtn.first().click();
      await page.waitForTimeout(300);
    } else {
      break;
    }
  }
  await page.waitForTimeout(300);
  await screenshot("calendar");

  log("Calendar Day Entry");
  const dayCell = page.locator("div.grid.grid-cols-7 > button").first();
  if (await dayCell.count()) {
    await dayCell.click();
    await page.getByRole("dialog").waitFor({ state: "visible", timeout: 2500 }).catch(() => {});
  }
  await screenshot("calendar-day-entry");
  await page.keyboard.press("Escape").catch(() => {});

  log("Calendar Snapshot");
  const snapshotBtn = page.getByRole("button", { name: "Snapshot" });
  if (await snapshotBtn.count()) {
    await snapshotBtn.click();
    await page.getByRole("dialog").waitFor({ state: "visible", timeout: 2500 }).catch(() => {});
    await page.waitForTimeout(300);
  }
  await screenshot("calendar-snapshot");
  await page.keyboard.press("Escape").catch(() => {});

  // ── Clients ──

  log("Clients");
  await goto("/clients");
  await screenshot("clients");

  log("Client Detail");
  await goto(`/clients/${clientId}`);
  await screenshot("client-detail");

  log("Add Project");
  const addProjectBtn = page.getByRole("button", { name: "Add Project" });
  if (await addProjectBtn.count()) {
    await addProjectBtn.click();
    await page.getByRole("dialog").waitFor({ state: "visible", timeout: 2500 }).catch(() => {});
    await page.waitForTimeout(300);
  }
  await screenshot("client-add-project");
  await page.keyboard.press("Escape").catch(() => {});

  log("New Client Form");
  await goto("/clients/new");
  await screenshot("client-new");

  // ── Invoices ──

  log("Invoices");
  await goto("/invoices");
  await screenshot("invoices");

  log("Mark as Paid");
  await goto("/invoices");
  let capturedMarkPaid = false;
  const menuBtns = page.locator("table button[aria-haspopup='menu']");
  const menuCount = await menuBtns.count();
  for (let i = 0; i < menuCount && !capturedMarkPaid; i++) {
    await menuBtns.nth(i).click();
    await page.waitForTimeout(300);
    const markPaidItem = page.getByRole("menuitem", { name: "Mark as Paid" });
    if (await markPaidItem.count()) {
      await markPaidItem.click();
      await page.getByRole("dialog").waitFor({ state: "visible", timeout: 2500 }).catch(() => {});
      await page.waitForTimeout(300);
      await screenshot("invoice-mark-paid");
      await page.keyboard.press("Escape").catch(() => {});
      capturedMarkPaid = true;
    } else {
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(200);
    }
  }
  if (!capturedMarkPaid) {
    console.log("  Skipped: No unpaid invoices found for Mark as Paid dialog");
  }

  log("Invoice Detail");
  await goto(`/invoices/${paidInvoiceId || invoiceId}`);
  await screenshot("invoice-detail");

  log("Invoice Payment Details");
  const paymentSection = page.locator("text=Payment Details").first();
  if (await paymentSection.count()) {
    await paymentSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
  } else {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
  }
  await screenshot("invoice-payment");

  log("Invoice Attachments");
  await goto(`/invoices/${attachmentInvoiceId || paidInvoiceId || invoiceId}`);
  const attachmentsSection = page.locator("text=Attachments").first();
  if (await attachmentsSection.count()) {
    await attachmentsSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
  } else {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
  }
  await screenshot("invoice-attachments");

  log("Invoice Create Form");
  await goto("/invoices/new");
  await screenshot("invoice-create");

  // ── Tax ──

  log("Tax Overview");
  await goto("/tax");
  await screenshot("tax");

  log("Tax Projection");
  await clickTab("Projection");
  await screenshot("tax-projection");

  log("Tax Payment");
  await goto("/tax");
  const addPaymentBtn = page.getByRole("button", { name: "Add Payment" });
  if (await addPaymentBtn.count()) {
    await addPaymentBtn.click();
    await page.getByRole("dialog").waitFor({ state: "visible", timeout: 2500 }).catch(() => {});
    await page.waitForTimeout(300);
  }
  await screenshot("tax-payment");
  await page.keyboard.press("Escape").catch(() => {});

  // ── Settings ──

  log("Settings Overview");
  await goto("/settings");
  await screenshot("settings");

  log("Settings Leave Policy");
  await clickTab("Leave Policy");
  await screenshot("settings-leave-policy");

  log("Settings Invoice");
  await clickTab("Invoice Settings");
  await screenshot("settings-invoice");

  log("Settings Access (User Management)");
  await clickTab("Access");
  await page.waitForTimeout(500);
  await screenshot("settings-access");

  await browser.close();
  console.log("\nDone! All screenshots saved to docs/screenshots/");
}

takeScreenshots().catch((err) => {
  console.error("Error taking screenshots:", err);
  process.exit(1);
});
