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

    db.close();

    return {
      clientId: client?.id ?? defaults.clientId,
      invoiceId: invoice?.id ?? defaults.invoiceId,
      paidInvoiceId: paid?.id ?? invoice?.id ?? defaults.paidInvoiceId,
      unpaidInvoiceId: unpaid?.id ?? invoice?.id ?? defaults.invoiceId,
      attachmentInvoiceId: withAttachments?.id ?? paid?.id ?? invoice?.id ?? defaults.attachmentInvoiceId,
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

  const { clientId, invoiceId, paidInvoiceId, unpaidInvoiceId, attachmentInvoiceId } = getRecordIds();

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

  console.log("Taking screenshots...\n");

  console.log("1/22 Dashboard");
  await goto("/dashboard");
  await screenshot("dashboard");

  console.log("2/22 Dashboard Charts");
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(400);
  await screenshot("dashboard-charts");

  console.log("3/22 Calendar");
  await goto("/calendar");
  await screenshot("calendar");

  console.log("4/22 Calendar Day Entry");
  const dayCell = page.locator("div.grid.grid-cols-7 > button").first();
  if (await dayCell.count()) {
    await dayCell.click();
    await page.getByRole("dialog").waitFor({ state: "visible", timeout: 2500 }).catch(() => {});
  }
  await screenshot("calendar-day-entry");
  await page.keyboard.press("Escape").catch(() => {});

  console.log("5/22 Calendar Snapshot");
  await goto("/calendar");
  const snapshotBtn = page.getByRole("button", { name: "Snapshot" });
  if (await snapshotBtn.count()) {
    await snapshotBtn.click();
    await page.getByRole("dialog").waitFor({ state: "visible", timeout: 2500 }).catch(() => {});
    await page.waitForTimeout(300);
  }
  await screenshot("calendar-snapshot");
  await page.keyboard.press("Escape").catch(() => {});

  console.log("6/22 Clients");
  await goto("/clients");
  await screenshot("clients");

  console.log("7/22 Client Detail");
  await goto(`/clients/${clientId}`);
  await screenshot("client-detail");

  console.log("8/22 Add Project");
  const addProjectBtn = page.getByRole("button", { name: "Add Project" });
  if (await addProjectBtn.count()) {
    await addProjectBtn.click();
    await page.getByRole("dialog").waitFor({ state: "visible", timeout: 2500 }).catch(() => {});
    await page.waitForTimeout(300);
  }
  await screenshot("client-add-project");
  await page.keyboard.press("Escape").catch(() => {});

  console.log("9/22 New Client Form");
  await goto("/clients/new");
  await screenshot("client-new");

  console.log("10/22 Invoices");
  await goto("/invoices");
  await screenshot("invoices");

  console.log("11/22 Mark as Paid");
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

  console.log("12/22 Invoice Detail");

  await goto(`/invoices/${paidInvoiceId || invoiceId}`);
  await screenshot("invoice-detail");

  console.log("13/22 Invoice Payment Details");
  const paymentSection = page.locator("text=Payment Details").first();
  if (await paymentSection.count()) {
    await paymentSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
  } else {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
  }
  await screenshot("invoice-payment");

  console.log("14/22 Invoice Attachments");
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

  console.log("15/22 Invoice Create Form");
  await goto("/invoices/new");
  await screenshot("invoice-create");

  console.log("16/22 Tax Overview");
  await goto("/tax");
  await screenshot("tax");

  console.log("17/22 Tax Projection");
  await clickTab("Projection");
  await screenshot("tax-projection");

  console.log("18/22 Tax Payment");
  await goto("/tax");
  const addPaymentBtn = page.getByRole("button", { name: "Add Payment" });
  if (await addPaymentBtn.count()) {
    await addPaymentBtn.click();
    await page.getByRole("dialog").waitFor({ state: "visible", timeout: 2500 }).catch(() => {});
    await page.waitForTimeout(300);
  }
  await screenshot("tax-payment");
  await page.keyboard.press("Escape").catch(() => {});

  console.log("19/22 Settings Overview");
  await goto("/settings");
  await screenshot("settings");

  console.log("20/22 Settings Bank");
  const sepaHeading = page.locator("text=SEPA Transfer Details").first();
  if (await sepaHeading.count()) {
    await sepaHeading.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
  }
  await screenshot("settings-bank");

  console.log("21/22 Settings Leave Policy");
  await clickTab("Leave Policy");
  await screenshot("settings-leave-policy");

  console.log("22/22 Settings Invoice");
  await clickTab("Invoice Settings");
  await screenshot("settings-invoice");

  await browser.close();
  console.log("\nDone! All screenshots saved to docs/screenshots/");
}

takeScreenshots().catch((err) => {
  console.error("Error taking screenshots:", err);
  process.exit(1);
});
