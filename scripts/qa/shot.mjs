#!/usr/bin/env node
// Screenshot an authenticated page against a running dev server, using a
// mocked Supabase session. See README.md in this directory for setup.
//
// Usage:
//   node scripts/qa/shot.mjs <persona> <path> <out.png> [baseUrl]
//
// Example:
//   npx vite dev --port 4174 &
//   node scripts/qa/shot.mjs survivor /dashboard /tmp/dashboard.png
//   node scripts/qa/shot.mjs attorney /clients /tmp/clients.png
//   node scripts/qa/shot.mjs advocate /advocate-cases /tmp/advocate.png

import { chromium } from "playwright";
import { mockLoggedIn } from "./mock-session.mjs";

const [, , persona, path, out, baseUrl] = process.argv;

if (!persona || !path || !out) {
  console.error("Usage: node scripts/qa/shot.mjs <persona> <path> <out.png> [baseUrl]");
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("pageerror", (err) => console.error("PAGEERROR:", err.message));

await mockLoggedIn(page, { persona });

const url = `${baseUrl || "http://127.0.0.1:4174"}${path}`;
try {
  const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
  console.log("status:", resp?.status());
} catch (e) {
  console.error("goto error:", e.message);
}
await page.waitForTimeout(3000);
console.log("final url:", page.url());
await page.screenshot({ path: out, fullPage: true });
console.log("saved:", out);
await browser.close();
