/**
 * Screenshot the standalone scanner-belt preview.
 *
 * Loads `design/previews/scanner-belt.html` (which contains the EN variant by
 * swapping the <html> attributes), renders it in a real browser, and writes
 * PNGs for both languages at desktop, tablet and phone widths. No Next build:
 * this is a static file, so the job that runs this never starts the app.
 *
 * The belt runs on requestAnimationFrame, so each capture waits ~2.2 s for a
 * mid-crossing frame rather than the idle first paint.
 */
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = resolve(root, "design/previews/scanner-belt.html");
const out = process.env.SHOT_DIR || resolve(root, "test-results/shots");

const VIEWPORTS = [
  { width: 1440, height: 900, name: "desktop" },
  { width: 768, height: 1024, name: "tablet" },
  { width: 390, height: 844, name: "mobile" },
];

mkdirSync(out, { recursive: true });

const base = readFileSync(source, "utf8");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const written = [];

for (const lang of ["ar", "en"]) {
  const html = base.replace(
    '<html lang="ar" dir="rtl">',
    lang === "en" ? '<html lang="en" dir="ltr">' : '<html lang="ar" dir="rtl">',
  );
  const tmp = join(out, `scanner-${lang}.html`);
  writeFileSync(tmp, html);

  for (const { width, height, name } of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    await page.goto(`file://${tmp}`, { waitUntil: "load" });
    await page.waitForTimeout(2200);
    const shot = join(out, `scanner-${lang}-${name}.png`);
    await page.screenshot({ path: shot });
    await context.close();
    written.push(shot);
  }
}

await browser.close();
console.log(written.join("\n"));