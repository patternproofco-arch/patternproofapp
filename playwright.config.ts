import { defineConfig, devices } from "@playwright/test";

/**
 * Permanent end-to-end suite. Runs against a local dev server by default;
 * set E2E_BASE_URL to smoke-test a deployed build with fictional accounts only.
 */
const baseURL = process.env["E2E_BASE_URL"] ?? "http://localhost:8080";

export default defineConfig({
  testDir: "./e2e",
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
        command: "bun run dev",
        url: "http://localhost:8080",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
