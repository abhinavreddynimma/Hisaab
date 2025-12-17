/**
 * Records a cinematic walkthrough of the app for Twitter/X.
 * Requires dev server running on localhost:3001.
 * Usage: npx tsx scripts/record-demo.ts
 */

import puppeteer from "puppeteer";
import { PuppeteerScreenRecorder } from "puppeteer-screen-recorder";
import path from "path";
import fs from "fs";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const OUTPUT_DIR = path.join(__dirname, "../docs");

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function smoothScroll(page: puppeteer.Page, distance: number, duration: number = 1500) {
  await page.evaluate(`
    new Promise((resolve) => {
      const start = window.scrollY;
      const dist = ${distance};
      const dur = ${duration};
      const startTime = Date.now();
      const step = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / dur, 1);
        const ease = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        window.scrollTo(0, start + dist * ease);
        if (progress < 1) requestAnimationFrame(step);
        else resolve();
      };
      step();
    })
  `);
}

async function scrollToTop(page: puppeteer.Page) {
  await page.evaluate(`window.scrollTo({ top: 0, behavior: "smooth" })`);
  await sleep(500);
}

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

  // Set light mode
  await page.goto(BASE_URL, { waitUntil: "networkidle2", timeout: 30000 });
  await page.evaluate(`localStorage.setItem("theme", "light")`);

  const recorderConfig = {
    followNewTab: false,
    fps: 30,
    videoFrame: { width: 1440, height: 900 },
    aspectRatio: "16:9" as const,
  };

  const recorder = new PuppeteerScreenRecorder(page, recorderConfig);
  const outputPath = path.join(OUTPUT_DIR, "demo-raw.mp4");
  await recorder.start(outputPath);
  console.log("Recording started...");

  // ── 1. DASHBOARD ──
  console.log("  Recording dashboard...");
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle2" });
  await page.evaluate(`
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light");
    document.documentElement.style.colorScheme = "light";
  `);
  await sleep(2500); // Show stats cards
  await smoothScroll(page, 400, 1200); // Scroll to calendar overview
  await sleep(2000);
  await smoothScroll(page, 400, 1200); // Scroll to leave balance
  await sleep(1500);
  await smoothScroll(page, 450, 1200); // Scroll to charts
  await sleep(2000);
  await smoothScroll(page, 450, 1200); // Scroll to more charts
  await sleep(2000);
  await smoothScroll(page, 400, 1200); // Recent invoices + exchange rate
  await sleep(2000);

  // ── 2. CALENDAR ──
  console.log("  Recording calendar...");
  await page.goto(`${BASE_URL}/calendar`, { waitUntil: "networkidle2" });
  await page.evaluate(`
    document.documentElement.classList.add("light");
    document.documentElement.style.colorScheme = "light";
  `);
  await sleep(2000);

  // Navigate to a month with varied data (October 2025)
  // Click previous month arrow several times
  const prevButton = 'button:has(> svg.lucide-chevron-left)';
  for (let i = 0; i < 4; i++) {
    await page.click(prevButton).catch(() => {});
    await sleep(600);
  }
  await sleep(1500);

  // Go back to current month
  const todayButton = 'button:has-text("Today")';
  try {
    await page.evaluate(`
      (() => {
        const btns = document.querySelectorAll("button");
        for (const btn of btns) {
          if (btn.textContent && btn.textContent.trim() === "Today") {
            btn.click();
            break;
          }
        }
      })()
    `);
  } catch {}
  await sleep(1500);

  // Scroll to see month summary
  await smoothScroll(page, 200, 800);
  await sleep(1500);

  // ── 3. CLIENTS ──
  console.log("  Recording clients...");
  await page.goto(`${BASE_URL}/clients`, { waitUntil: "networkidle2" });
  await page.evaluate(`
    document.documentElement.classList.add("light");
    document.documentElement.style.colorScheme = "light";
  `);
  await sleep(1500);

  // Click on client to see details
  await page.goto(`${BASE_URL}/clients/1`, { waitUntil: "networkidle2" });
  await page.evaluate(`
    document.documentElement.classList.add("light");
    document.documentElement.style.colorScheme = "light";
  `);
  await sleep(2000);
  await smoothScroll(page, 300, 1000);
  await sleep(1500);

  // ── 4. INVOICES ──
  console.log("  Recording invoices...");
  await page.goto(`${BASE_URL}/invoices`, { waitUntil: "networkidle2" });
  await page.evaluate(`
    document.documentElement.classList.add("light");
    document.documentElement.style.colorScheme = "light";
  `);
  await sleep(2000);
  await smoothScroll(page, 400, 1200); // Scroll through invoice list
  await sleep(1500);

  // Click on an invoice detail
  await page.goto(`${BASE_URL}/invoices/1`, { waitUntil: "networkidle2" });
  await page.evaluate(`
    document.documentElement.classList.add("light");
    document.documentElement.style.colorScheme = "light";
  `);
  await sleep(2000);
  await smoothScroll(page, 500, 1500); // Scroll through invoice
  await sleep(2000);
  await smoothScroll(page, 500, 1500); // More invoice details
  await sleep(1500);

  // ── 5. TAX ──
  console.log("  Recording tax...");
  await page.goto(`${BASE_URL}/tax`, { waitUntil: "networkidle2" });
  await page.evaluate(`
    document.documentElement.classList.add("light");
    document.documentElement.style.colorScheme = "light";
  `);
  await sleep(2000);
  await smoothScroll(page, 400, 1200); // Scroll through tax computation
  await sleep(2000);
  await smoothScroll(page, 400, 1200); // Show quarterly payments
  await sleep(2000);

  // ── 6. SETTINGS ──
  console.log("  Recording settings...");
  await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle2" });
  await page.evaluate(`
    document.documentElement.classList.add("light");
    document.documentElement.style.colorScheme = "light";
  `);
  await sleep(1500);
  await smoothScroll(page, 400, 1200);
  await sleep(1500);

  // ── 7. DARK MODE TOGGLE ──
  console.log("  Recording dark mode toggle...");
  await scrollToTop(page);
  await sleep(500);
  // Click the theme toggle button (sun/moon icon in top-right)
  await page.evaluate(`
    localStorage.setItem("theme", "dark");
    document.documentElement.classList.remove("light");
    document.documentElement.classList.add("dark");
    document.documentElement.style.colorScheme = "dark";
  `);
  await sleep(1500);

  // Navigate to dashboard in dark mode
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle2" });
  await page.evaluate(`
    localStorage.setItem("theme", "dark");
    document.documentElement.classList.remove("light");
    document.documentElement.classList.add("dark");
    document.documentElement.style.colorScheme = "dark";
  `);
  await sleep(2500);
  await smoothScroll(page, 600, 1500);
  await sleep(2000);

  // ── END ──
  console.log("Stopping recording...");
  await recorder.stop();
  console.log(`Raw recording saved: ${outputPath}`);

  await browser.close();
  console.log("Done! Now run ffmpeg post-processing.");
}

main().catch((err) => {
  console.error("Recording failed:", err);
  process.exit(1);
});
