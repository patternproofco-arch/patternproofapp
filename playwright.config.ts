import { defineConfig, devices } from "@playwright/test";

/**
 * Permanent end-to-end suite. Runs against a local dev server by default;
 * set E2E_BASE_URL to smoke-test a deployed build with fictional accounts only.
 */
const baseURL = process.env["E2E_BASE_URL"] ?? "http://localhost:8080";
const previewBuild = process.env["E2E_PREVIEW"] === "1";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env["CI"] ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-android", use: { ...devices["Pixel 7"] } },
    { name: "mobile-ios", use: { ...devices["iPhone 14"] } },
  ],
  webServer: process.env["E2E_BASE_URL"]
    ? undefined
    : {
        // Wrangler previews the Cloudflare output through the local Worker runtime.
        // CI checks the built bundle; development remains available for iteration.
        command: previewBuild
          ? "npm run preview -- --ip 127.0.0.1 --port 8080"
          : "npm run dev -- --host 127.0.0.1 --port 8080",
        url: "http://localhost:8080",
        reuseExistingServer: !process.env["CI"] && !previewBuild,
        timeout: 120_000,
      },
});
