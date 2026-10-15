import { test, expect } from "@playwright/test";

for (const [label, path] of [
  ["Add a Note", "/journal"],
  ["See my notes", "/journal"],
  ["Get ready to share", "/access"],
]) {
  test(`fictional survivor can choose ${label}`, async ({ page }) => {
    const { mockLoggedIn } = await import("../scripts/qa/mock-session.mjs");
    await mockLoggedIn(page, { persona: "survivor" });
    // These actions live in the full Home ("Show everything"), remembered per device.
    await page.addInitScript(() => localStorage.setItem("pp.home.view", "all"));
    const pageErrors: string[] = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const action = page.getByRole("link", { name: label, exact: true }).first();
    await expect(action).toBeVisible({ timeout: 30_000 });
    await expect(action).toHaveAttribute("href", path);
    await action.click();
    await page.waitForURL((url) => url.pathname === path);
    await expect(page.locator("h1").first()).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
}
