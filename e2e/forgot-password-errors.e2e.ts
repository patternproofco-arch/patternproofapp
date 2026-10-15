import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

// Live 2026-10-15: an unmatched Auth error showed "Check your email" and no email came.
test("forgot password shows a calm retry error on any Auth error, success only on no error", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/auth/v1/recover**", async (route) => {
    calls += 1;
    if (calls === 1) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ code: 500, error_code: "unexpected_failure", msg: "Something odd" }),
      });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    }
  });
  await page.goto("/forgot-password");
  await expect(page.locator("[data-quick-exit]").first()).toBeVisible();
  await page.getByLabel("Email").fill("fictional-user@example.invalid");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByTestId("forgot-password-error")).toContainText(
    "We couldn't send a reset link right now",
  );
  await expect(page.getByRole("heading", { name: "Check your email." })).toHaveCount(0);
  // Email stays filled so retry is one tap.
  await expect(page.getByLabel("Email")).toHaveValue("fictional-user@example.invalid");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email." })).toBeVisible();
  expect(calls).toBe(2);
});
