import { expect, test, type Page } from "@playwright/test";

/**
 * Tracker gate (Guardian ruling): no Google tag on a private first load, and
 * the GA kill switch is set on private routes.
 *
 * Every third-party tracker request is aborted, so running this suite never
 * sends a real hit to the production GA property or to Leave a Dot / Stripe.
 */
const THIRD_PARTY =
  /googletagmanager\.com|google-analytics\.com|analytics\.google\.com|leaveadot\.com|js\.stripe\.com/;

async function blockAndRecord(page: Page): Promise<string[]> {
  const attempted: string[] = [];
  await page.route(THIRD_PARTY, (route) => {
    attempted.push(route.request().url());
    return route.abort();
  });
  return attempted;
}

const gaDisabled = (page: Page) =>
  page.evaluate(
    () => (window as unknown as Record<string, unknown>)["ga-disable-G-PXNVVNXEV5"] === true,
  );

test("private first load: no gtag.js tag, no Google/Stripe request, kill switch set", async ({
  page,
}) => {
  const attempted = await blockAndRecord(page);
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  // /dashboard redirects signed-out visitors to sign-in — also a private page.
  await page.waitForLoadState("networkidle").catch(() => {});
  await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(0);
  expect(await gaDisabled(page)).toBe(true);
  expect(attempted).toEqual([]);
});

test("invite link first load: no gtag.js tag and kill switch set", async ({ page }) => {
  const attempted = await blockAndRecord(page);
  await page.goto("/survivor-invite/e2e-not-a-real-token", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(0);
  expect(await gaDisabled(page)).toBe(true);
  expect(attempted.filter((u) => /google/.test(u))).toEqual([]);
});

test("public marketing page: kill switch clear and gtag.js lazy-injected (request aborted)", async ({
  page,
}) => {
  await blockAndRecord(page);
  await page.goto("/pricing", { waitUntil: "domcontentloaded" });
  expect(await gaDisabled(page)).toBe(false);
  await expect(page.locator('script[src*="googletagmanager.com/gtag/js"]')).toHaveCount(1, {
    timeout: 30_000,
  });
});

// A loaded widget can retain observers after its DOM nodes are removed. The
// launch build omits it entirely, including the marketing page before sign-in.
test("marketing to sign-in never loads the external feedback widget", async ({ page }) => {
  const attempted = await blockAndRecord(page);
  await page.goto("/pricing", { waitUntil: "domcontentloaded" });
  await expect(page.locator('script[src*="googletagmanager.com/gtag/js"]')).toHaveCount(1);
  await expect(page.locator('script[src*="leaveadot.com"]')).toHaveCount(0);
  await page.getByRole("link", { name: "Sign in", exact: true }).first().click();
  await expect(page).toHaveURL(/\/signin/);
  expect(await gaDisabled(page)).toBe(true);
  expect(attempted.filter((url) => /leaveadot\.com/.test(url))).toEqual([]);
});
