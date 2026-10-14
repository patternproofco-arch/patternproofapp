import { test, expect } from "@playwright/test";

for (const [label, path] of [
  ["Save something", "/journal"],
  ["Review my record", "/timeline"],
  ["Get ready to share", "/access"],
]) {
  test(`fictional survivor can choose ${label}`, async ({ page }) => {
    const { mockLoggedIn } = await import("../scripts/qa/mock-session.mjs");
    await mockLoggedIn(page, { persona: "survivor" });
    const pageErrors: string[] = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const action = page.getByRole("link", { name: label, exact: true });
    await expect(action).toBeVisible({ timeout: 30_000 });
    await expect(action).toHaveAttribute("href", path);
    await action.click();
    await page.waitForURL((url) => url.pathname === path);
    await expect(page.locator("h1").first()).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
}
