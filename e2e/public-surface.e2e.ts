import { expect, test } from "@playwright/test";

test("homepage loads with its heading and no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("h1")).toBeVisible();
  expect(errors).toEqual([]);
});

test("Quick Exit leaves the site", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const exit = page.getByRole("button", { name: /(quick exit|exit safely)/i }).first();
  await expect(exit).toBeVisible();
  await page.waitForFunction(
    () => (window as unknown as { __ppQuickExitHydrated?: boolean }).__ppQuickExitHydrated === true,
    undefined,
    { timeout: 30_000 },
  );
  const exitRequest = page.waitForRequest(
    (request) => {
      try {
        return new URL(request.url()).hostname.endsWith("weather.com");
      } catch {
        return false;
      }
    },
    { timeout: 45_000 },
  );
  await exit.click();
  await expect(page.getByText("PATTERNPROOF")).toHaveCount(0, { timeout: 5_000 });
  const requested = await exitRequest;
  expect(new URL(requested.url()).hostname).toMatch(/(^|\.)weather\.com$/);
});

test("version marker identifies the running build", async ({ request }) => {
  const res = await request.get("/version.json");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(typeof body.commit).toBe("string");
  expect(body.commit.length).toBeGreaterThan(0);
});

test("signing in is required for the survivor dashboard", async ({ page }) => {
  await page.request.get("/dashboard");
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/(auth|signin)/, { timeout: 45_000 });
});

for (const path of ["/pricing", "/for-attorneys", "/for-organizations", "/demo"]) {
  test(`marketing route ${path} renders`, async ({ page }) => {
    const res = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator("h1")).toBeVisible();
  });
}
