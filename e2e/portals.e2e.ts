import { expect, test } from "@playwright/test";

/**
 * Account-level portal regression. Skipped unless fictional QA credentials are
 * supplied. Never point these at real accounts or real survivor data.
 *
 *   E2E_SURVIVOR_EMAIL / E2E_SURVIVOR_PASSWORD
 *   E2E_ATTORNEY_EMAIL / E2E_ATTORNEY_PASSWORD
 *   E2E_ADVOCATE_EMAIL / E2E_ADVOCATE_PASSWORD
 */

const creds = (role: string) => ({
  email: process.env[`E2E_${role}_EMAIL`],
  password: process.env[`E2E_${role}_PASSWORD`],
});

async function signIn(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/signin", { waitUntil: "domcontentloaded" });
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
}

test.describe("survivor portal", () => {
  const { email, password } = creds("SURVIVOR");
  test.skip(!email || !password, "fictional survivor credentials not supplied");

  test("reaches the dashboard and core destinations", async ({ page }) => {
    await signIn(page, email!, password!);
    await page.waitForURL(/dashboard|onboarding/, { timeout: 30_000 });
    for (const path of ["/timeline", "/evidence", "/journal"]) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await expect(page.locator("h1")).toBeVisible();
    }
  });
});

test.describe("attorney portal", () => {
  const { email, password } = creds("ATTORNEY");
  test.skip(!email || !password, "fictional attorney credentials not supplied");

  test("completes setup or lands in the caseload without paying first", async ({ page }) => {
    await signIn(page, email!, password!);
    await page.waitForURL(/caseload|setup|subscribe/, { timeout: 30_000 });
    expect(page.url()).not.toMatch(/\/subscribe/);
  });
});

test.describe("advocate portal", () => {
  const { email, password } = creds("ADVOCATE");
  test.skip(!email || !password, "fictional advocate credentials not supplied");

  test("reaches the advocate home", async ({ page }) => {
    await signIn(page, email!, password!);
    await page.waitForURL(/advocate|org-portal|advocate-setup/, { timeout: 30_000 });
    await expect(page.locator("h1")).toBeVisible();
  });
});

test.describe("cross-account isolation", () => {
  const { email, password } = creds("SURVIVOR");
  test.skip(!email || !password, "fictional survivor credentials not supplied");

  test("a survivor cannot open professional portal routes", async ({ page }) => {
    await signIn(page, email!, password!);
    await page.waitForURL(/dashboard|onboarding/, { timeout: 30_000 });
    await page.goto("/caseload", { waitUntil: "domcontentloaded" });
    await expect(page).not.toHaveURL(/\/caseload$/);
  });
});
