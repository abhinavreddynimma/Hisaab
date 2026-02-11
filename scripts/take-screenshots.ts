/**
 * Takes screenshots of the running app for GitHub showcase.
 * Requires the dev server to be running.
 * Usage: npx tsx scripts/take-screenshots.ts
 */

import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";

const BASE_URL = process.env.BASE_URL || "http://localhost:3001";
const OUTPUT_DIR = path.join(__dirname, "../docs/screenshots");

const pages = [
  { path: "/dashboard", name: "dashboard", waitFor: 3500 },
  { path: "/calendar", name: "calendar", waitFor: 2000 },
  { path: "/clients", name: "clients", waitFor: 2000 },
  { path: "/clients/1", name: "client-detail", waitFor: 2000 },
  { path: "/invoices", name: "invoices", waitFor: 2000 },
  { path: "/invoices/1", name: "invoice-detail", waitFor: 2000 },
  { path: "/tax", name: "tax", waitFor: 2000 },
  { path: "/settings", name: "settings", waitFor: 2000 },
];

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log("Launching browser...");
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ["--no-sandbox"],
  });

  const page = await browser.newPage();

  // Navigate first to set light mode
  await page.goto(BASE_URL, { waitUntil: "networkidle2", timeout: 30000 });
  await page.evaluate(() => {
    localStorage.setItem("theme", "light");
  });

  for (const p of pages) {
    const url = `${BASE_URL}${p.path}`;
    console.log(`Capturing ${p.name} (${url})...`);

    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    // Ensure light mode is applied
    await page.evaluate(() => {
      localStorage.setItem("theme", "light");
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
      document.documentElement.style.colorScheme = "light";
    });

    // Wait for content to render and charts to animate
    await new Promise((r) => setTimeout(r, p.waitFor));

    const filePath = path.join(OUTPUT_DIR, `${p.name}.png`);
    // Viewport screenshot only (not fullPage) for good aspect ratio
    await page.screenshot({ path: filePath, fullPage: false });
    console.log(`  Saved: ${filePath}`);
  }

  await browser.close();
  console.log("\nAll screenshots captured!");
}

main().catch((err) => {
  console.error("Screenshot failed:", err);
  process.exit(1);
});
