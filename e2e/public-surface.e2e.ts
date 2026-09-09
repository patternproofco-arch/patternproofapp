import { expect, test } from "@playwright/test";

/**
 * Public-surface regression. No accounts, no data: safe to run against a
 * deployed build. Account-level flows live in e2e/portals.spec.ts and require
 * fictional QA credentials.
 */

test("homepage loads with its heading and no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("h1")).toBeVisible();
  expect(errors).toEqual([]);
});

test("Quick Exit leaves the site", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const exit = page.getByRole("button", { name: /quick exit/i }).first();
  await expect(exit).toBeVisible();
  await exit.click();
  await page.waitForURL(/weather\.com/, { timeout: 20_000 });
});

test("version marker identifies the running build", async ({ request }) => {
  const res = await request.get("/version.json");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(typeof body.commit).toBe("string");
  expect(body.commit.length).toBeGreaterThan(0);
});

test("signing in is required for the survivor dashboard", async ({ page }) => {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/(auth|signin)/, { timeout: 20_000 });
});

for (const path of ["/pricing", "/for-attorneys", "/for-organizations", "/sample-case"]) {
  test(`marketing route ${path} renders`, async ({ page }) => {
    const res = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator("h1")).toBeVisible();
  });
}
